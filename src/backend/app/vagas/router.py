from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import require_perfil
from app.jwt_geraçao.dependencies import get_organizacao_logada
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico
from app.vagas.repository import VagaRepository
from app.vagas.schemas import (
    AtualizarVagaRequest,
    CadastroVagaRequest,
    ListaVagasResponse,
    VagaPublica,
)
from app.vagas.service import (
    AcessoNegadoVagaException,
    AlteracaoHorarioNaoPermitidaException,
    VagaNaoEncontradaException,
    VagaService,
)


router = APIRouter(
    prefix="/api/v1/organizacoes",
    tags=["Organizações"],
)


def get_vaga_service(
    session: Annotated[Session, Depends(get_db)],
) -> VagaService:
    """Provedor de dependência para a camada de serviço de vagas."""
    return VagaService(VagaRepository(session))


@router.get(
    "",
    response_model=ListaVagasResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar vagas públicas",
)
def listar_vagas(
    service: Annotated[VagaService, Depends(get_vaga_service)],
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ListaVagasResponse:
    return service.listar(pagina, por_pagina)


@router.post(
    "",
    response_model=VagaPublica,
    status_code=status.HTTP_201_CREATED,
    summary="Publicar nova vaga",
)
def publicar_vaga(
    dados: CadastroVagaRequest,
    usuario: Annotated[
        UsuarioPublico,
        Depends(require_perfil(Perfil.ORGANIZACAO)),
    ],
    service: Annotated[VagaService, Depends(get_vaga_service)],
) -> VagaPublica:
    return service.publicar(usuario.id, dados)


@router.get(
    "/me/vagas",
    response_model=ListaVagasResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar vagas da organização autenticada",
    description=(
        "Retorna as vagas pertencentes à organização identificada no token JWT."
    ),
)
def listar_minhas_vagas(
    organizacao_id: str = Depends(get_organizacao_logada),
    service: VagaService = Depends(get_vaga_service),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
):
    return service.listar_por_organizacao(
        organizacao_id=organizacao_id,
        pagina=pagina,
        por_pagina=por_pagina,
    )


@router.put(
    "/{vaga_id}",
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados ou estado da vaga",
    description=(
        "Permite alteração somente à organização proprietária da vaga. "
        "Bloqueia alteração de horários caso existam candidaturas ativas."
    ),
)
def atualizar_vaga(
    vaga_id: str,
    dados: AtualizarVagaRequest,
    organizacao_id: str = Depends(get_organizacao_logada),
    service: VagaService = Depends(get_vaga_service),
):
    try:
        return service.atualizar_vaga(
            vaga_id=vaga_id,
            organizacao_id=organizacao_id,
            dados=dados,
        )
    except VagaNaoEncontradaException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except AcessoNegadoVagaException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except AlteracaoHorarioNaoPermitidaException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )