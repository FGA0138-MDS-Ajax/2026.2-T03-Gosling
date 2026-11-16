"""Imagens públicas, validadas e recodificadas sem os metadados do arquivo original."""

import io
import os
import re
import warnings
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError

router = APIRouter(prefix="/midia", tags=["Mídia pública"])
MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000


def pasta_midia() -> Path:
    return Path(os.getenv("UPLOAD_DIR", "uploads")).resolve()


async def salvar_imagem(request: Request, *, avatar: bool = False) -> str:
    if request.headers.get("content-type", "").split(";")[0] not in (
        "image/jpeg",
        "image/png",
        "image/webp",
    ):
        raise HTTPException(415, "Envie uma imagem JPG, PNG ou WebP.")
    conteudo = bytearray()
    async for parte in request.stream():
        conteudo.extend(parte)
        if len(conteudo) > MAX_BYTES:
            raise HTTPException(413, "A imagem deve ter até 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(conteudo)) as original:
                if original.format not in ("JPEG", "PNG", "WEBP"):
                    raise ValueError("Formato inválido")
                if original.width * original.height > MAX_PIXELS:
                    raise ValueError("Resolução excessiva")
                imagem = ImageOps.exif_transpose(original).convert("RGB")
                imagem.thumbnail((512, 512) if avatar else (1920, 1920))
                saida = io.BytesIO()
                imagem.save(saida, format="WEBP", quality=85)
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            422, "Imagem inválida. Use JPG, PNG ou WebP com até 20 megapixels."
        ) from None
    pasta = pasta_midia()
    pasta.mkdir(parents=True, exist_ok=True)
    nome = f"{uuid4().hex}.webp"
    (pasta / nome).write_bytes(saida.getvalue())
    return f"/api/v1/midia/{nome}"


def remover_imagem_local(url: str | None) -> None:
    if url and re.fullmatch(r"/api/v1/midia/[a-f0-9]{32}\.webp", url):
        (pasta_midia() / url.rsplit("/", 1)[1]).unlink(missing_ok=True)


@router.get("/{nome}")
def consultar_imagem(nome: str):
    if not re.fullmatch(r"[a-f0-9]{32}\.webp", nome):
        raise HTTPException(404, "Imagem não encontrada.")
    arquivo = pasta_midia() / nome
    if not arquivo.is_file():
        raise HTTPException(404, "Imagem não encontrada.")
    return FileResponse(
        arquivo,
        media_type="image/webp",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=86400",
        },
    )
