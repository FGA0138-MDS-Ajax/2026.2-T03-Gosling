from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.repository import UsuarioRepository
from app.usuarios.schemas import (
    AtualizarOrganizacaoRequest,
    CadastroOrganizacaoRequest,
    OrganizacaoPublica,
    UsuarioPublico,
)
from app.usuarios.service import OrganizacaoService

router = APIRouter(tags=["Contas"])


def get_organizacao_service(
    session: Annotated[Session, Depends(get_db)],
) -> OrganizacaoService:
    return OrganizacaoService(UsuarioRepository(session))


@router.post(
    "/organizacoes",
    response_model=OrganizacaoPublica,
    status_code=201,
)
def cadastrar_organizacao(
    payload: CadastroOrganizacaoRequest,
    service: Annotated[OrganizacaoService, Depends(get_organizacao_service)],
) -> OrganizacaoPublica:
    return service.cadastrar(payload)


@router.get("/organizacoes/me", response_model=OrganizacaoPublica)
def organizacao_me(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[OrganizacaoService, Depends(get_organizacao_service)],
) -> OrganizacaoPublica:
    return service.consultar(usuario.id)


@router.put("/organizacoes/me", response_model=OrganizacaoPublica)
def atualizar_organizacao_me(
    payload: AtualizarOrganizacaoRequest,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[OrganizacaoService, Depends(get_organizacao_service)],
) -> OrganizacaoPublica:
    return service.atualizar(usuario.id, payload)


@router.get("/voluntarios/me", response_model=UsuarioPublico)
def voluntario_me(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.VOLUNTARIO))],
) -> UsuarioPublico:
    return usuario


@router.get("/admin/me", response_model=UsuarioPublico)
def administrador_me(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ADMINISTRADOR))],
) -> UsuarioPublico:
    return usuario
