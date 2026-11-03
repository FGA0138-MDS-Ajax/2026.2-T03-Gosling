import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

from backend.app.jwt_geração.repository import UsuarioRepository
from backend.app.jwt_geração.schemas import LoginRequest, LoginResponse


SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "chave_secreta_padrao_para_ambiente_dev_32_bytes_minimo"
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
TOKEN_ISSUER = "api-faculdade"

_DUMMY_ARGON2_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "c29tZXNhbHRmb3JkdW1teTE$"
    "kQy69jYJ073cM86B7f2yW/yN95t630lW2t1NqC8O01Q"
)


class CredenciaisInvalidasException(Exception):
    pass


class ContaSemAcessoException(Exception):
    pass


class AuthService:
    def __init__(self, usuario_repository: UsuarioRepository):
        self.repository = usuario_repository
        self.ph = PasswordHasher()

    def autenticar_e_gerar_token(
        self,
        login_data: LoginRequest
    ) -> LoginResponse:

        usuario = self.repository.buscar_por_email(login_data.email)

        if not usuario:
            try:
                self.ph.verify(
                    _DUMMY_ARGON2_HASH,
                    login_data.password
                )
            except Exception:
                pass

            raise CredenciaisInvalidasException(
                "E-mail ou senha inválidos."
            )

        try:
            self.ph.verify(
                usuario.password_hash,
                login_data.password
            )
        except (VerifyMismatchError, VerificationError):
            raise CredenciaisInvalidasException(
                "E-mail ou senha inválidos."
            )

        if not usuario.ativo:
            raise ContaSemAcessoException(
                "Esta conta está desativada ou sem permissão de acesso."
            )

        agora = datetime.now(timezone.utc)
        expiracao = agora + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

        payload = {
            "sub": str(usuario.id),
            "email": usuario.email,
            "perfil": usuario.perfil,
            "iat": agora,
            "exp": expiracao,
            "iss": TOKEN_ISSUER,
        }

        token_jwt = jwt.encode(
            payload,
            SECRET_KEY,
            algorithm=ALGORITHM
        )

        return LoginResponse(
            access_token=token_jwt,
            token_type="Bearer",
            expires_in_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
        )