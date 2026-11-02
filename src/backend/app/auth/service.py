from jwt.exceptions import InvalidTokenError
from pwdlib.exceptions import UnknownHashError

from app.auth.schemas import LoginResponse, SessaoResponse
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.errors import NaoAutenticadoError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.usuarios.schemas import UsuarioPublico
from app.usuarios.service import UsuarioService

DUMMY_HASH = hash_password("senha-ficticia-para-verificacao")
INVALID_CREDENTIALS = "E-mail ou senha inválidos."


class AuthService:
    def __init__(self, usuarios: UsuarioService):
        self.usuarios = usuarios

    def login(self, email: str, senha: str) -> LoginResponse:
        usuario = self.usuarios.buscar_por_email(email)
        senha_hash = usuario.senha_hash if usuario is not None else DUMMY_HASH
        try:
            senha_valida = verify_password(senha, senha_hash)
        except UnknownHashError:
            senha_valida = False
        if usuario is None or not senha_valida or not usuario.ativo:
            raise NaoAutenticadoError(INVALID_CREDENTIALS)

        token = create_access_token(usuario.id, usuario.perfil.value)
        payload = decode_access_token(token)
        return LoginResponse(
            access_token=token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            expires_at=payload["exp"],
            usuario=UsuarioPublico.model_validate(usuario.model_dump()),
        )

    def obter_sessao(self, token: str) -> SessaoResponse:
        try:
            payload = decode_access_token(token)
            usuario_id = int(payload["sub"])
            if usuario_id <= 0:
                raise ValueError("ID inválido")
        except (InvalidTokenError, ValueError, TypeError) as error:
            raise NaoAutenticadoError() from error
        usuario = self.usuarios.buscar_por_id(usuario_id)
        if (
            usuario is None
            or not usuario.ativo
            or usuario.perfil.value != payload["perfil"]
        ):
            raise NaoAutenticadoError()
        return SessaoResponse(
            usuario=UsuarioPublico.model_validate(usuario.model_dump()),
            expires_at=payload["exp"],
        )
