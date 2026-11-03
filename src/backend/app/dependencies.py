from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.schemas import SessaoResponse
from app.auth.service import AuthService
from app.core.database import get_db
from app.core.errors import AcessoNegadoError, NaoAutenticadoError
from app.usuarios.enums import Perfil
from app.usuarios.repository import UsuarioRepository
from app.usuarios.schemas import UsuarioPublico
from app.usuarios.service import UsuarioService

bearer = HTTPBearer(auto_error=False)


def get_auth_service(session: Annotated[Session, Depends(get_db)]) -> AuthService:
    usuarios = UsuarioService(UsuarioRepository(session))
    return AuthService(usuarios)


def get_sessao(
    response: Response,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> SessaoResponse:
    if credentials is None:
        raise NaoAutenticadoError()
    response.headers["Cache-Control"] = "no-store"
    return auth.obter_sessao(credentials.credentials)


def require_perfil(
    perfil: Perfil,
) -> Callable[..., UsuarioPublico]:
    def authorize(
        sessao: Annotated[SessaoResponse, Depends(get_sessao)],
    ) -> UsuarioPublico:
        if sessao.usuario.perfil != perfil:
            raise AcessoNegadoError()
        return sessao.usuario

    return authorize