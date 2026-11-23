import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.midia import PADRAO_IMAGEM, PADRAO_MODELO, pasta_midia
from app.midias.models import ArquivoMidia, MidiaVaga, UsoMidia
from app.vagas.models import Vaga


def preparar_midias(
    db: Session,
    titular_id: int,
    dados: dict,
    dados_anteriores: dict | None = None,
) -> tuple[dict, set[str]]:
    fotos = dados.get("fotos", [])
    if len(fotos) > 8 or len(fotos) != len(set(fotos)):
        raise HTTPException(422, "Selecione até oito fotos distintas.")
    if not dados.get("enquadramento_fotos", {}).keys() <= set(fotos):
        raise HTTPException(
            422, "Selecione uma foto válida para ajustar o enquadramento."
        )

    anteriores = dados_anteriores or {}
    referencias_antigas = set(anteriores.get("fotos", []))
    referencias_antigas.update(
        doc.get("modelo_url") for doc in anteriores.get("documentos_exigidos", [])
    )
    arquivos = set()
    for url in fotos:
        registro = validar_arquivo_local(
            db, titular_id, url, {UsoMidia.FOTO_VAGA}, referencias_antigas
        )
        if registro is not None:
            arquivos.add(registro.arquivo)

    identificadores = set()
    documentos = []
    for item in dados.get("documentos_exigidos", []):
        documento = dict(item)
        documento["id"] = documento.get("id") or str(uuid4())
        if documento["id"] in identificadores:
            raise HTTPException(422, "Cada documento exigido deve ter um ID próprio.")
        identificadores.add(documento["id"])

        url = documento.get("modelo_url")
        formato_termo = url and url.startswith("/api/v1/midia/modelos/")
        if formato_termo and documento.get("tipo") != "TERMO":
            raise HTTPException(422, "Associe o modelo PDF a um termo de adesão.")
        usos = {UsoMidia.MODELO_TERMO} if formato_termo else {UsoMidia.FOTO_VAGA}
        registro = validar_arquivo_local(db, titular_id, url, usos, referencias_antigas)
        if registro is not None:
            arquivos.add(registro.arquivo)
        documentos.append(documento)

    return {**dados, "documentos_exigidos": documentos}, arquivos


def validar_arquivo_local(
    db: Session,
    titular_id: int,
    url: str | None,
    usos: set[UsoMidia],
    anteriores=(),
) -> ArquivoMidia | None:
    if not url or not url.startswith("/api/v1/midia/"):
        return None

    nome = url.rsplit("/", 1)[1]
    padrao = PADRAO_MODELO if UsoMidia.MODELO_TERMO in usos else PADRAO_IMAGEM
    if not re.fullmatch(padrao, nome):
        raise HTTPException(422, "Selecione um arquivo de mídia válido.")

    arquivo = pasta_midia() / nome
    midia = db.get(ArquivoMidia, nome)
    if arquivo.is_symlink() or not arquivo.is_file():
        raise HTTPException(422, "O arquivo expirou. Selecione-o novamente.")
    if midia is None and padrao == PADRAO_IMAGEM and url in anteriores:
        return None
    if midia is None or midia.titular_id != titular_id or midia.uso not in usos:
        raise HTTPException(422, "Arquivo indisponível para este uso na sua conta.")
    if midia.url != url:
        raise HTTPException(422, "Selecione um arquivo de mídia válido.")
    return midia


def sincronizar_vinculos(db: Session, vaga: Vaga, arquivos: set[str]) -> None:
    db.execute(delete(MidiaVaga).where(MidiaVaga.vaga_id == vaga.id))
    db.add_all(
        MidiaVaga(vaga_id=vaga.id, arquivo=arquivo) for arquivo in sorted(arquivos)
    )


def dados_modelos(db: Session, documentos: list[dict]) -> list[dict]:
    resultado = []
    for documento in documentos:
        dados = dict(documento)
        resultado.append(dados)
        url = documento.get("modelo_url")
        if not url or not url.startswith("/api/v1/midia/modelos/"):
            continue
        midia = db.get(ArquivoMidia, url.rsplit("/", 1)[1])
        if midia and midia.uso == UsoMidia.MODELO_TERMO:
            dados["modelo"] = {
                "nome": midia.nome,
                "formato": midia.formato,
                "tamanho_bytes": midia.tamanho_bytes,
            }
    return resultado
