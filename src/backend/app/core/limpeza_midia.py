"""Remove uploads abandonados, preservando fotos de vagas e de perfis."""

import asyncio
import logging
import re
import time

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.database import get_engine
from app.core.midia import bloqueio_midia, pasta_midia
from app.usuarios.models import Voluntario
from app.vagas.models import Vaga

PRAZO_UPLOAD_SEM_VINCULO = 24 * 60 * 60
INTERVALO_LIMPEZA = 60 * 60
logger = logging.getLogger(__name__)


def limpar_imagens_orfas(session: Session) -> int:
    with bloqueio_midia:
        limite = time.time() - PRAZO_UPLOAD_SEM_VINCULO
        em_uso = set(session.scalars(select(Voluntario.foto_url)))
        for fotos in session.scalars(select(Vaga.fotos)):
            em_uso.update(fotos or [])
        for documentos in session.scalars(select(Vaga.documentos_exigidos)):
            em_uso.update(doc.get("modelo_url") for doc in documentos or [])
        for dados in session.scalars(
            select(Vaga.rascunho).where(Vaga.rascunho.is_not(None))
        ):
            em_uso.update(dados.get("fotos", []))
            em_uso.update(
                doc.get("modelo_url") for doc in dados.get("documentos_exigidos", [])
            )
        removidas = 0
        for arquivo in pasta_midia().glob("*.webp"):
            if (
                re.fullmatch(r"[a-f0-9]{32}\.webp", arquivo.name)
                and not arquivo.is_symlink()
                and arquivo.is_file()
                and f"/api/v1/midia/{arquivo.name}" not in em_uso
                and arquivo.stat().st_mtime < limite
            ):
                arquivo.unlink(missing_ok=True)
                removidas += 1
        return removidas


def executar_limpeza_midia() -> None:
    with Session(get_engine()) as session:
        limpar_imagens_orfas(session)


async def limpar_midias_periodicamente() -> None:
    while True:
        await asyncio.sleep(INTERVALO_LIMPEZA)
        try:
            await run_in_threadpool(executar_limpeza_midia)
        except Exception:
            logger.exception("Falha na limpeza de mídia; nova tentativa em uma hora.")
