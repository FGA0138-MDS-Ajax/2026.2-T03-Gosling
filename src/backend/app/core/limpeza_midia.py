"""Remove uploads abandonados, preservando fotos de vagas e de perfis."""

import asyncio
import logging
import re
import time

from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.database import get_engine
from app.core.midia import PADRAO_IMAGEM, PADRAO_MODELO, bloqueio_midia, pasta_midia
from app.midias.models import ArquivoMidia
from app.midias.repository import urls_referenciadas

PRAZO_UPLOAD_SEM_VINCULO = 24 * 60 * 60
INTERVALO_LIMPEZA = 60 * 60
logger = logging.getLogger(__name__)


def limpar_imagens_orfas(session: Session) -> int:
    with bloqueio_midia:
        limite = time.time() - PRAZO_UPLOAD_SEM_VINCULO
        em_uso = {
            url.rsplit("/", 1)[-1]
            for url in urls_referenciadas(session)
            if url.startswith("/api/v1/midia/")
        }
        removidas = 0
        for arquivo in pasta_midia().glob("*"):
            if (
                re.fullmatch(f"(?:{PADRAO_IMAGEM}|{PADRAO_MODELO})", arquivo.name)
                and not arquivo.is_symlink()
                and arquivo.is_file()
                and arquivo.name not in em_uso
                and arquivo.stat().st_mtime < limite
            ):
                registro = session.get(ArquivoMidia, arquivo.name)
                arquivo.unlink(missing_ok=True)
                if registro is not None:
                    session.delete(registro)
                removidas += 1
        if removidas:
            session.commit()
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
