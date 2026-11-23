
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.candidaturas.repository import CandidaturaRepository
from app.candidaturas.schemas import EventoCalendario, IntervaloCalendario
from app.candidaturas.service import (
    CalendarioService,
    CandidaturaDuplicadaException,
    CandidaturaService,
    VagaNaoAbertaException,
    VagaNaoEncontradaException,
)
from app.core.database import get_db
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico
from app.vagas.repository import VagaRepository


calendario_router = APIRouter(
    prefix="/voluntarios/me",
    tags=["Calendário"],
)

candidaturas_router = APIRouter(
    prefix="/vagas",
    tags=["Candidaturas"],
)

router = APIRouter()

router.include_router(calendario_router)
router.include_router(candidaturas_router)


def get_calendario_service(
    session: Annotated[Session, Depends(get_db)],
) -> CalendarioService:
    return CalendarioService(CandidaturaRepository(session))


def get_candidatura_service(
    session: Annotated[Session, Depends(get_db)],
) -> CandidaturaService:
    return CandidaturaService(
        candidatura_repository=CandidaturaRepository(session),
        vaga_repository=VagaRepository(session),
    )


@calendario_router.get(
    "/calendario",
    response_model=list[EventoCalendario],
)
def consultar_calendario(
    usuario: Annotated[
        UsuarioPublico,
        Depends(require_perfil(Perfil.VOLUNTARIO)),
    ],
    intervalo: Annotated[IntervaloCalendario, Query()],
    service: Annotated[
        CalendarioService,
        Depends(get_calendario_service),
    ],
) -> list[EventoCalendario]:
    return service.consultar(usuario.id, intervalo)


@candidaturas_router.post(
    "/{vaga_id}/candidaturas",
    status_code=status.HTTP_201_CREATED,
)
def criar_candidatura(
    vaga_id: int,
    usuario: Annotated[
        UsuarioPublico,
        Depends(require_perfil(Perfil.VOLUNTARIO)),
    ],
    service: Annotated[
        CandidaturaService,
        Depends(get_candidatura_service),
    ],
):
    try:
        return service.candidatar(
            vaga_id=vaga_id,
            voluntario_id=usuario.id,
        )

    except VagaNaoEncontradaException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    except VagaNaoAbertaException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except CandidaturaDuplicadaException as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
