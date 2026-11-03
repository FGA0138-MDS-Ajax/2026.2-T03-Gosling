from typing import Annotated

from fastapi import APIRouter, Depends

from backend.app.jwt_geração.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico

router = APIRouter(tags=["Contas"])


@router.get("/voluntarios/me", response_model=UsuarioPublico)
def voluntario_me(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.VOLUNTARIO))],
) -> UsuarioPublico:
    return usuario


@router.get("/organizacoes/me", response_model=UsuarioPublico)
def organizacao_me(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
) -> UsuarioPublico:
    return usuario


@router.get("/admin/me", response_model=UsuarioPublico)
def administrador_me(
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ADMINISTRADOR))],
) -> UsuarioPublico:
    return usuario
