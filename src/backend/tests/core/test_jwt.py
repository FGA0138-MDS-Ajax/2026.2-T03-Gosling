from datetime import UTC, datetime
from typing import Any

import jwt
import pytest

from app.core.security import create_access_token, decode_access_token


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch: pytest.MonkeyPatch) -> str:
    secret = "segredo-exclusivo-dos-testes-" + "a" * 40
    monkeypatch.setenv("JWT_SECRET_KEY", secret)
    return secret


@pytest.fixture
def payload() -> dict[str, Any]:
    now = int(datetime.now(UTC).timestamp())
    return {"sub": "7", "perfil": "VOLUNTARIO", "iat": now, "exp": now + 3600}


@pytest.mark.parametrize("perfil", ["VOLUNTARIO", "ORGANIZACAO", "ADMINISTRADOR"])
def test_cria_token_com_perfil_e_validade_de_60_minutos(
    perfil: str, jwt_secret: str
) -> None:
    before = int(datetime.now(UTC).timestamp())
    token = create_access_token(user_id=7, perfil=perfil)
    decoded = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    assert decoded["sub"] == "7"
    assert decoded["perfil"] == perfil
    assert before <= decoded["iat"] <= int(datetime.now(UTC).timestamp())
    assert decoded["exp"] - decoded["iat"] == 3600
    assert decode_access_token(token) == decoded


def test_rejeita_token_expirado(payload: dict[str, Any], jwt_secret: str) -> None:
    payload["iat"] -= 7200
    payload["exp"] = int(datetime.now(UTC).timestamp()) - 60
    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


def test_rejeita_assinatura_invalida(payload: dict[str, Any]) -> None:
    token = jwt.encode(payload, "outra-chave-de-testes-" + "b" * 40, algorithm="HS256")
    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(token)


def test_rejeita_algoritmo_nao_permitido(
    payload: dict[str, Any], jwt_secret: str
) -> None:
    token = jwt.encode(payload, jwt_secret, algorithm="HS384")
    with pytest.raises(jwt.InvalidAlgorithmError):
        decode_access_token(token)


@pytest.mark.parametrize("claim", ["sub", "perfil", "iat", "exp"])
def test_rejeita_token_sem_campo_obrigatorio(
    claim: str, payload: dict[str, Any], jwt_secret: str
) -> None:
    payload.pop(claim)
    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    with pytest.raises(jwt.MissingRequiredClaimError):
        decode_access_token(token)


@pytest.mark.parametrize("token", ["", "nao-e-um-jwt", "a.b.c"])
def test_rejeita_token_malformado(token: str) -> None:
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)


@pytest.mark.parametrize("secret", [None, "", "curta"])
def test_rejeita_chave_ausente_ou_fraca(
    secret: str | None, monkeypatch: pytest.MonkeyPatch
) -> None:
    if secret is None:
        monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    else:
        monkeypatch.setenv("JWT_SECRET_KEY", secret)
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        create_access_token(user_id=7, perfil="VOLUNTARIO")
