"""Recebe mídia validada e oferece acesso conforme os vínculos do arquivo."""

import io
import os
import re
import warnings
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.auth.schemas import SessaoResponse
from app.core.database import get_db
from app.dependencies import get_sessao
from app.midias.models import ArquivoMidia, UsoMidia
from app.midias.repository import arquivo_publicado, urls_referenciadas

router = APIRouter(prefix="/midia", tags=["Mídia"])
Banco = Annotated[Session, Depends(get_db)]
Sessao = Annotated[SessaoResponse, Depends(get_sessao)]
MAX_PIXELS = 20_000_000
FORMATOS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
PADRAO_IMAGEM = r"[a-f0-9]{32}\.webp"
PADRAO_MODELO = r"[a-f0-9]{32}\.pdf"
bloqueio_midia = Lock()


@dataclass(frozen=True)
class RegraImagem:
    limite_mb: int
    tipos: tuple[str, ...]
    minimo: tuple[int, int] = (1, 1)
    reduzir_para: tuple[int, int] | None = None


TIPOS_INSTITUCIONAIS = ("image/jpeg", "image/png")
REGRAS_IMAGEM = {
    UsoMidia.FOTO_VAGA: RegraImagem(10, tuple(FORMATOS), reduzir_para=(1920, 1920)),
    UsoMidia.AVATAR: RegraImagem(5, tuple(FORMATOS), reduzir_para=(512, 512)),
    UsoMidia.LOGO: RegraImagem(5, TIPOS_INSTITUCIONAIS, minimo=(400, 400)),
    UsoMidia.CAPA: RegraImagem(5, TIPOS_INSTITUCIONAIS, minimo=(1600, 600)),
    UsoMidia.GALERIA: RegraImagem(5, TIPOS_INSTITUCIONAIS, reduzir_para=(1920, 1920)),
}


class MidiaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    nome: str
    formato: str
    tamanho_bytes: int
    largura: int | None
    altura: int | None


def pasta_midia() -> Path:
    return Path(os.getenv("UPLOAD_DIR", "uploads")).resolve()


async def ler_conteudo(request: Request, limite_mb: int) -> bytearray:
    limite = limite_mb * 1024 * 1024
    conteudo = bytearray()
    async for parte in request.stream():
        if len(conteudo) + len(parte) > limite:
            raise HTTPException(413, f"O arquivo deve ter até {limite_mb} MB.")
        conteudo.extend(parte)
    return conteudo


def recodificar_imagem(conteudo: bytearray, tipo: str, regra: RegraImagem):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(conteudo)) as original:
                if original.format != FORMATOS[tipo]:
                    raise ValueError("Formato não corresponde ao arquivo.")
                if original.width * original.height > MAX_PIXELS:
                    raise ValueError("Resolução excessiva.")
                orientada = ImageOps.exif_transpose(original)
                tem_transparencia = (
                    "A" in orientada.getbands() or "transparency" in orientada.info
                )
                imagem = orientada.convert("RGBA" if tem_transparencia else "RGB")
                largura_minima, altura_minima = regra.minimo
                if imagem.width < largura_minima or imagem.height < altura_minima:
                    raise HTTPException(
                        422,
                        f"Use uma imagem de pelo menos {largura_minima} × "
                        f"{altura_minima} pixels.",
                    )
                if regra.reduzir_para is not None:
                    imagem.thumbnail(regra.reduzir_para)
                saida = io.BytesIO()
                imagem.save(saida, format="WEBP", quality=85)
                return saida.getvalue(), imagem.size
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            422, "Imagem inválida. Confira o formato e o limite de 20 megapixels."
        ) from None


def registrar_arquivo(
    db: Session,
    titular_id: int,
    uso: UsoMidia,
    nome: str,
    formato: str,
    conteudo: bytes | bytearray,
    dimensoes: tuple[int | None, int | None],
) -> ArquivoMidia:
    extensao = "pdf" if formato == "application/pdf" else "webp"
    arquivo = ArquivoMidia(
        arquivo=f"{uuid4().hex}.{extensao}",
        titular_id=titular_id,
        uso=uso,
        nome=nome,
        formato=formato,
        tamanho_bytes=len(conteudo),
        largura=dimensoes[0],
        altura=dimensoes[1],
    )
    pasta = pasta_midia()
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / arquivo.arquivo).write_bytes(conteudo)
    db.add(arquivo)
    return arquivo


async def salvar_imagem(
    request: Request, db: Session, titular_id: int, uso: UsoMidia
) -> ArquivoMidia:
    regra = REGRAS_IMAGEM[uso]
    tipo = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if tipo not in regra.tipos:
        formatos = (
            "JPG ou PNG" if regra.tipos == TIPOS_INSTITUCIONAIS else "JPG, PNG ou WebP"
        )
        raise HTTPException(415, f"Envie uma imagem {formatos}.")
    conteudo = await ler_conteudo(request, regra.limite_mb)
    recodificado, dimensoes = await run_in_threadpool(
        recodificar_imagem, conteudo, tipo, regra
    )
    return registrar_arquivo(
        db, titular_id, uso, "Imagem", "image/webp", recodificado, dimensoes
    )


async def salvar_modelo(
    request: Request, db: Session, titular_id: int, nome: str
) -> ArquivoMidia:
    tipo = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if tipo != "application/pdf":
        raise HTTPException(415, "Envie um modelo em PDF.")
    conteudo = await ler_conteudo(request, 5)
    if not re.match(rb"%PDF-(1\.[0-7]|2\.0)[\r\n]", conteudo) or not re.search(
        rb"%%EOF\s*\Z", conteudo[-1024:]
    ):
        raise HTTPException(422, "O arquivo não é um PDF válido.")

    nome = nome.replace("\\", "/").rsplit("/", 1)[-1].strip()
    nome = "".join(caractere for caractere in nome if caractere.isprintable())
    if not nome.lower().endswith(".pdf"):
        nome = "Modelo de termo.pdf"
    return registrar_arquivo(
        db, titular_id, UsoMidia.MODELO_TERMO, nome, tipo, conteudo, (None, None)
    )


def confirmar_upload(db: Session, arquivo: ArquivoMidia) -> MidiaResponse:
    resposta = MidiaResponse.model_validate(arquivo)
    nome = arquivo.arquivo
    try:
        db.commit()
    except Exception:
        db.rollback()
        (pasta_midia() / nome).unlink(missing_ok=True)
        raise
    return resposta


def remover_imagem_sem_vinculo(db: Session, url: str | None) -> None:
    if not url or not re.fullmatch(f"/api/v1/midia/{PADRAO_IMAGEM}", url):
        return
    with bloqueio_midia:
        if url in urls_referenciadas(db):
            return
        nome = url.rsplit("/", 1)[1]
        (pasta_midia() / nome).unlink(missing_ok=True)
        registro = db.get(ArquivoMidia, nome)
        if registro:
            db.delete(registro)
            db.commit()


def resposta_arquivo(nome: str, tipo: str, *, nome_publico=None, privado=False):
    arquivo = pasta_midia() / nome
    if arquivo.is_symlink() or not arquivo.is_file():
        raise HTTPException(404, "Arquivo não encontrado.")
    return FileResponse(
        arquivo,
        media_type=tipo,
        filename=nome_publico,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store" if privado else "public, no-cache",
        },
    )


@router.get("/privada/{nome}")
def consultar_midia_privada(nome: str, sessao: Sessao, db: Banco):
    if not re.fullmatch(f"(?:{PADRAO_IMAGEM}|{PADRAO_MODELO})", nome):
        raise HTTPException(404, "Arquivo não encontrado.")
    midia = db.get(ArquivoMidia, nome)
    if midia is None or midia.titular_id != sessao.usuario.id:
        raise HTTPException(404, "Arquivo não encontrado.")
    nome_publico = midia.nome if midia.uso == UsoMidia.MODELO_TERMO else None
    return resposta_arquivo(
        nome, midia.formato, nome_publico=nome_publico, privado=True
    )


@router.get("/modelos/{nome}")
def baixar_modelo(nome: str, db: Banco):
    if not re.fullmatch(PADRAO_MODELO, nome):
        raise HTTPException(404, "Modelo não encontrado.")
    midia = db.get(ArquivoMidia, nome)
    if (
        midia is None
        or midia.uso != UsoMidia.MODELO_TERMO
        or not arquivo_publicado(db, midia)
    ):
        raise HTTPException(404, "Modelo não encontrado.")
    return resposta_arquivo(nome, "application/pdf", nome_publico=midia.nome)


@router.get("/{nome}")
def consultar_imagem(nome: str, db: Banco):
    if not re.fullmatch(PADRAO_IMAGEM, nome):
        raise HTTPException(404, "Imagem não encontrada.")
    midia = db.get(ArquivoMidia, nome)
    if midia and not arquivo_publicado(db, midia):
        raise HTTPException(404, "Imagem não encontrada.")
    return resposta_arquivo(nome, "image/webp")
