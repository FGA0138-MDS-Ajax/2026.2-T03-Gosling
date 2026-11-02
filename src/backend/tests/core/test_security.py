import pytest

from app.core.security import hash_password, verify_password


def test_gera_hash_argon2() -> None:
    password = "senha123"
    hashed_password = hash_password(password)
    assert hashed_password.startswith("$argon2id$")
    assert hashed_password != password
    assert verify_password(password, hashed_password) is True
    assert verify_password("senha_incorreta", hashed_password) is False


@pytest.mark.parametrize(
    ("password", "expected"),
    [("Senha123", True), ("senha_incorreta", False), ("", False)],
)
def test_aceita_senha_correta(password: str, expected: bool) -> None:
    hashed = hash_password("Senha123")
    assert verify_password(password, hashed) is expected


def test_mesma_senha_gera_hash_diferente() -> None:
    password = "senha123"
    first_hash = hash_password(password)
    second_hash = hash_password(password)
    assert first_hash != second_hash
    assert verify_password(password, first_hash)
    assert verify_password(password, second_hash)
