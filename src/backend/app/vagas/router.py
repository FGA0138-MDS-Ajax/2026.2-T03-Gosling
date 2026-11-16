
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
    prefix="/api/v1/vagas",
    tags=["Vagas"],
)


# ============================================================
# DEPENDÊNCIAS
# ============================================================

def get_vaga_service(
    session: Annotated[Session, Depends(get_db)],
) -> VagaService:
    return VagaService(VagaRepository(session))


# ============================================================
# LISTAGEM DE VAGAS
# ============================================================

@router.get(
    "",
    response_model=ListaVagasResponse,
    summary="Listar vagas disponíveis",
)
def listar_vagas(
    service: Annotated[VagaService, Depends(get_vaga_service)],
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ListaVagasResponse:
    return service.listar(pagina, por_pagina)


# ============================================================
# PUBLICAÇÃO DE VAGAS
# ============================================================

@router.post(
    "",
    response_model=VagaPublica,
    status_code=status.HTTP_201_CREATED,
    summary="Publicar uma nova vaga",
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


# ============================================================
# ATUALIZAÇÃO DE VAGAS
# ============================================================

@router.put(
    "/{vaga_id}",
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados ou estado da vaga",
)
def atualizar_vaga(
    vaga_id: int,
    dados: AtualizarVagaRequest,
    organizacao_id: Annotated[
        int,
        Depends(get_organizacao_logada),
    ],
    service: Annotated[
        VagaService,
        Depends(get_vaga_service),
    ],
):
    try:
        return service.atualizar_vaga(
            vaga_id=vaga_id,
            organizacao_id=organizacao_id,
            dados=dados,
        )

    except VagaNaoEncontradaException as erro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(erro),
        ) from erro

    except AcessoNegadoVagaException as erro:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(erro),
        ) from erro

    except AlteracaoHorarioNaoPermitidaException as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(erro),
        ) from erro
