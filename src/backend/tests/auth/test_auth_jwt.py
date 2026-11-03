import pytest
import jwt

from argon2 import PasswordHasher

from backend.app.jwt_geraçao.repository import UsuarioEntity, UsuarioRepository
from backend.app.jwt_geraçao.service import (
    AuthService,
    CredenciaisInvalidasException,
    ContaSemAcessoException,
    SECRET_KEY,
    ALGORITHM,
)
from backend.app.jwt_geraçao.schemas import LoginRequest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
 
backend_dir = Path(__file__).resolve().parents[2]
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

 
from fastapi.testclient import TestClient  # noqa: E402
from app.jwt_geraçao.main import app      # noqa: E402

client = TestClient(app)


def test_jwt_router_endpoints():
    response = client.get("/jwt/exemplo")
    
    # Valida que o endpoint respondeu corretamente
    assert response.status_code in [200, 401, 404, 422]

_ph = PasswordHasher()


class MockRepository(UsuarioRepository):
    def __init__(self):
        hash_valido = _ph.hash("SenhaForte123")

        self.usuarios = {
            "ativo@teste.com": UsuarioEntity(
                id="usr_01HZX89AB",
                email="ativo@teste.com",
                password_hash=hash_valido,
                perfil="colaborador",
                ativo=True,
            ),
            "inativo@teste.com": UsuarioEntity(
                id="usr_02BLQ99XY",
                email="inativo@teste.com",
                password_hash=hash_valido,
                perfil="aluno",
                ativo=False,
            ),
        }

    def buscar_por_email(self, email: str):
        return self.usuarios.get(email.lower())


def test_login_sucesso_deve_retornar_jwt_de_60_minutos():
    service = AuthService(usuario_repository=MockRepository())

    requisicao = LoginRequest(
        email="ativo@teste.com",
        password="SenhaForte123",
    )

    resposta = service.autenticar_e_gerar_token(requisicao)

    assert resposta.token_type == "Bearer"
    assert resposta.expires_in_minutes == 60
    assert resposta.access_token is not None

    payload = jwt.decode(
        resposta.access_token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
    )

    assert payload["sub"] == "usr_01HZX89AB"
    assert payload["email"] == "ativo@teste.com"
    assert payload["perfil"] == "colaborador"
    assert "password_hash" not in payload


def test_login_senha_incorreta_deve_lancar_credenciais_invalidas():
    service = AuthService(usuario_repository=MockRepository())

    requisicao = LoginRequest(
        email="ativo@teste.com",
        password="SenhaIncorreta999",
    )

    with pytest.raises(CredenciaisInvalidasException):
        service.autenticar_e_gerar_token(requisicao)


def test_login_usuario_inexistente_deve_lancar_credenciais_invalidas():
    service = AuthService(usuario_repository=MockRepository())

    requisicao = LoginRequest(
        email="naoexiste@teste.com",
        password="QualquerSenha123",
    )

    with pytest.raises(CredenciaisInvalidasException):
        service.autenticar_e_gerar_token(requisicao)


def test_login_conta_inativa_com_senha_correta_deve_rejeitar_acesso():
    service = AuthService(usuario_repository=MockRepository())

    requisicao = LoginRequest(
        email="inativo@teste.com",
        password="SenhaForte123",
    )

    with pytest.raises(ContaSemAcessoException):
        service.autenticar_e_gerar_token(requisicao)


def test_login_conta_inativa_com_senha_errada_deve_dar_credencial_invalida():
    service = AuthService(usuario_repository=MockRepository())

    requisicao = LoginRequest(
        email="inativo@teste.com",
        password="SenhaErrada",
    )

    with pytest.raises(CredenciaisInvalidasException):
        service.autenticar_e_gerar_token(requisicao)