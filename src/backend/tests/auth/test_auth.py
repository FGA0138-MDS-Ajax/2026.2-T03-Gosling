from datetime import UTC, datetime

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.usuarios.models import Usuario


def entrar(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": "SenhaDeTeste123!"},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("conta", ["voluntario", "organizacao", "administrador"])
def test_login_emite_jwt_por_perfil_sem_expor_senha(
    conta: str, client: TestClient, contas: dict[str, Usuario], jwt_secret: str
) -> None:
    usuario = contas[conta]
    resultado = entrar(client, usuario.email)
    payload = jwt.decode(resultado["access_token"], jwt_secret, algorithms=["HS256"])
    assert payload["sub"] == str(usuario.id)
    assert payload["perfil"] == usuario.perfil.value
    assert payload["exp"] - payload["iat"] == 3600
    assert resultado["expires_in"] == 3600
    assert resultado["expires_at"] == payload["exp"]
    assert resultado["usuario"]["perfil"] == usuario.perfil.value
    assert "senha_hash" not in resultado["usuario"]
    assert "ativo" not in resultado["usuario"]
    assert resultado["token_type"] == "bearer"


def test_login_aceita_email_com_caixa_diferente(
    client: TestClient, contas: dict[str, Usuario]
) -> None:
    resultado = entrar(client, "VOLUNTARIO@EXAMPLE.COM")
    assert resultado["usuario"]["id"] == contas["voluntario"].id


@pytest.mark.parametrize(
    ("email", "senha"),
    [
        ("voluntario@example.com", "senha-errada"),
        ("ausente@example.com", "SenhaDeTeste123!"),
        ("inativo@example.com", "SenhaDeTeste123!"),
    ],
)
def test_login_nega_credenciais_invalidas_e_conta_inativa(
    email: str, senha: str, client: TestClient, contas: dict[str, Usuario]
) -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "senha": senha})
    assert response.status_code == 401
    assert response.json() == {"detail": "E-mail ou senha inválidos."}
    assert response.headers["www-authenticate"] == "Bearer"
    assert "access_token" not in response.json()


def test_hash_invalido_no_banco_nao_autentica(
    client: TestClient, contas: dict[str, Usuario], db: Session
) -> None:
    contas["voluntario"].senha_hash = "hash-invalido"
    db.flush()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "voluntario@example.com", "senha": "SenhaDeTeste123!"},
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": "invalido", "senha": "abc"},
        {"email": "voluntario@example.com", "senha": ""},
        {"email": "voluntario@example.com", "senha": "abc", "perfil": "ADMINISTRADOR"},
    ],
)
def test_login_valida_entrada_sem_permitir_escolher_perfil(
    body: dict, client: TestClient
) -> None:
    assert client.post("/api/v1/auth/login", json=body).status_code == 422


@pytest.mark.parametrize(
    ("conta", "tipo"),
    [("organizacao", "ONG"), ("projeto", "PROJETO_SOCIAL")],
)
def test_login_preserva_tipo_da_organizacao(
    conta: str, tipo: str, client: TestClient, contas: dict[str, Usuario]
) -> None:
    resultado = entrar(client, contas[conta].email)
    assert resultado["usuario"]["tipo"] == tipo


def test_me_retorna_usuario_da_sessao(
    client: TestClient, contas: dict[str, Usuario]
) -> None:
    resultado = entrar(client, contas["voluntario"].email)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {resultado['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json()["usuario"] == resultado["usuario"]
    assert response.json()["expires_at"] == resultado["expires_at"]
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "authorization", [None, "Basic abc", "Bearer invalido", "Bearer "]
)
def test_recurso_protegido_rejeita_token_ausente_ou_malformado(
    authorization: str | None, client: TestClient
) -> None:
    headers = {"Authorization": authorization} if authorization else {}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.parametrize("problema", ["expirado", "assinatura", "perfil", "id"])
def test_recurso_protegido_rejeita_sessao_invalida(
    problema: str, client: TestClient, contas: dict[str, Usuario], jwt_secret: str
) -> None:
    usuario = contas["voluntario"]
    now = int(datetime.now(UTC).timestamp())
    payload = {
        "sub": str(usuario.id),
        "perfil": "VOLUNTARIO",
        "iat": now - 120,
        "exp": now + 3600,
    }
    secret = jwt_secret
    if problema == "expirado":
        payload["exp"] = now - 60
    elif problema == "assinatura":
        secret = "outra-assinatura-" + "b" * 48
    elif problema == "perfil":
        payload["perfil"] = "ADMINISTRADOR"
    else:
        payload["sub"] = "id-invalido"
    token = jwt.encode(payload, secret, algorithm="HS256")
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


@pytest.mark.parametrize("operacao", ["suspender", "excluir"])
def test_token_de_conta_sem_acesso_nao_abre_recurso(
    operacao: str, client: TestClient, contas: dict[str, Usuario], db: Session
) -> None:
    resultado = entrar(client, contas["voluntario"].email)
    if operacao == "suspender":
        contas["voluntario"].ativo = False
    else:
        db.delete(contas["voluntario"])
    db.flush()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {resultado['access_token']}"},
    )
    assert response.status_code == 401


@pytest.mark.parametrize("conta", ["voluntario", "organizacao", "administrador"])
@pytest.mark.parametrize("recurso", ["voluntarios", "organizacoes", "admin"])
def test_cada_perfil_acessa_apenas_seu_fluxo(
    conta: str, recurso: str, client: TestClient, contas: dict[str, Usuario]
) -> None:
    resultado = entrar(client, contas[conta].email)
    response = client.get(
        f"/api/v1/{recurso}/me",
        headers={"Authorization": f"Bearer {resultado['access_token']}"},
    )
    permitido = {
        "voluntario": "voluntarios",
        "organizacao": "organizacoes",
        "administrador": "admin",
    }[conta]
    assert response.status_code == (200 if recurso == permitido else 403)


def test_login_nao_permite_cache(
    client: TestClient, contas: dict[str, Usuario]
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": contas["voluntario"].email, "senha": "SenhaDeTeste123!"},
    )
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"


def test_id_negativo_nao_e_autenticado(client: TestClient, jwt_secret: str) -> None:
    token = create_access_token(-1, "VOLUNTARIO")
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401
