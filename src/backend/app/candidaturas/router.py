from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.candidaturas.repository import CandidaturaRepository
from app.candidaturas.schemas import (
    CandidaturaRegistrada,
    EventoCalendario,
    IntervaloCalendario,
)
from app.candidaturas.service import (
    CalendarioService,
    CandidaturaDuplicadaException,
    CandidaturaService,
    ConflitoHorarioException,
    VagaNaoAbertaException,
    VagaNaoEncontradaException,
)
from app.core.database import get_db
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico

router = APIRouter()


def get_calendario_service(
    session: Annotated[Session, Depends(get_db)],
) -> CalendarioService:
    return CalendarioService(CandidaturaRepository(session))


def get_candidatura_service(
    session: Annotated[Session, Depends(get_db)],
) -> CandidaturaService:
    return CandidaturaService(CandidaturaRepository(session))


@router.get(
    "/voluntarios/me/calendario",
    tags=["Calendário"],
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


@router.post(
    "/vagas/{vaga_id}/candidaturas",
    tags=["Candidaturas"],
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
    documentos_exigidos: Annotated[list[int] | None, Form(max_length=20)] = None,
    arquivos: Annotated[list[UploadFile] | None, File(max_length=20)] = None,
) -> CandidaturaRegistrada:
    try:
        return service.candidatar(
            vaga_id=vaga_id,
            voluntario_id=usuario.id,
            indices=documentos_exigidos or [],
            arquivos=arquivos or [],
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
            detail={"codigo": "CANDIDATURA_DUPLICADA", "mensagem": str(e)},
        ) from e
    except ConflitoHorarioException as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "codigo": "CONFLITO_HORARIO",
                "mensagem": "Há compromissos nos horários desta vaga.",
                "conflitos": [item.model_dump(mode="json") for item in e.conflitos],
            },
        ) from e


@router.get(
    "/candidaturas/{candidatura_id}/comprovante",
    tags=["Candidaturas"],
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def baixar_comprovante(
    candidatura_id: int,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.VOLUNTARIO))],
    service: Annotated[CandidaturaService, Depends(get_candidatura_service)],
) -> Response:
    pdf = service.comprovante(candidatura_id, usuario.id, usuario.nome)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": (
                f'attachment; filename="comprovante-candidatura-{candidatura_id}.pdf"'
            ),
        },
    )
