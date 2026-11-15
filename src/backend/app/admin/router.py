from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.admin.repository import AdminRepository
from app.admin.schemas import (
    ContaAdminPublica,
    CriarContaRequest,
    ListaContasResponse,
)
from app.admin.service import AdminService
from app.auth.schemas import LoginRequest, LoginResponse
from app.auth.service import AuthService
from app.core.database import get_db
from app.dependencies import get_auth_service, require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico

router = APIRouter(prefix="/admin", tags=["Administração"])
Administrador = Annotated[
    UsuarioPublico, Depends(require_perfil(Perfil.ADMINISTRADOR))
]


def get_admin_service(
    session: Annotated[Session, Depends(get_db)],
) -> AdminService:
    return AdminService(AdminRepository(session))


@router.post("/login", response_model=LoginResponse)
def login_administrativo(
    dados: LoginRequest,
    response: Response,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> LoginResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return auth.login(
        str(dados.email), dados.senha.get_secret_value(),
        perfil_exigido=Perfil.ADMINISTRADOR,
    )


@router.get("/usuarios", response_model=ListaContasResponse)
def listar_cadastros(
    administrador: Administrador,
    service: Annotated[AdminService, Depends(get_admin_service)],
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
    busca: Annotated[str, Query(max_length=150)] = "",
    perfil: Perfil | None = None,
    ativo: bool | None = None,
):
    return service.listar(pagina, por_pagina, busca.strip(), perfil, ativo)


@router.get("/usuarios/{usuario_id}", response_model=ContaAdminPublica)
def consultar_cadastro(
    usuario_id: int,
    administrador: Administrador,
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    return service.consultar(usuario_id)


@router.post("/usuarios", response_model=ContaAdminPublica, status_code=201)
def criar_cadastro(
    dados: CriarContaRequest,
    administrador: Administrador,
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    return service.criar(dados)


@router.delete("/usuarios/{usuario_id}", status_code=204)
def excluir_cadastro(
    usuario_id: int,
    administrador: Administrador,
    service: Annotated[AdminService, Depends(get_admin_service)],
    excluir_vagas: bool = False,
):
    service.excluir(administrador.id, usuario_id, excluir_vagas)
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
