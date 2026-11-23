from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.candidaturas.repository import CandidaturaRepository
from app.candidaturas.schemas import EventoCalendario, IntervaloCalendario
from app.candidaturas.service import CalendarioService
from app.core.database import get_db
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico

router = APIRouter(prefix="/voluntarios/me", tags=["Calendário"])


def get_calendario_service(
    session: Annotated[Session, Depends(get_db)],
) -> CalendarioService:
    return CalendarioService(CandidaturaRepository(session))


@router.get("/calendario", response_model=list[EventoCalendario])
def consultar_calendario(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.VOLUNTARIO))],
    intervalo: Annotated[IntervaloCalendario, Query()],
    service: Annotated[CalendarioService, Depends(get_calendario_service)],
) -> list[EventoCalendario]:
    """Encontros ativos que cruzam [inicio, fim), em dias de Brasília."""
    return service.consultar(usuario.id, intervalo)
