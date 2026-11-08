import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.jwt_geraçao.main import app
from app.usuarios.enums import TipoOrganizacao
from app.usuarios.models import Organizacao, Usuario, Voluntario


@pytest.fixture
def jwt_secret(monkeypatch: pytest.MonkeyPatch) -> str:
    secret = "segredo-ficticio-da-api-" + "a" * 40
    monkeypatch.setenv("JWT_SECRET_KEY", secret)
    return secret


@pytest.fixture(scope="session")
def senha_hash() -> str:
    return hash_password("SenhaDeTeste123!")


@pytest.fixture
def db() -> Iterator[Session]:
    database_url = os.getenv("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    options = (
        {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
        if database_url.startswith("sqlite")
        else {}
    )
    engine = create_engine(database_url, **options)
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            yield session
        transaction.rollback()
    engine.dispose()


@pytest.fixture
def contas(db: Session, senha_hash: str) -> dict[str, Usuario]:
    usuarios = {
        "voluntario": Voluntario(
            nome="Ana", email="voluntario@example.com", senha_hash=senha_hash
        ),
        "organizacao": Organizacao(
            nome="ONG Exemplo", email="ong@example.com", senha_hash=senha_hash
        ),
        "administrador": Usuario(
            nome="Admin", email="admin@example.com", senha_hash=senha_hash
        ),
        "inativo": Voluntario(
            nome="Conta inativa",
            email="inativo@example.com",
            senha_hash=senha_hash,
            ativo=False,
        ),
        "projeto": Organizacao(
            nome="Projeto Exemplo",
            email="projeto@example.com",
            senha_hash=senha_hash,
            tipo=TipoOrganizacao.PROJETO_SOCIAL,
        ),
    }
    db.add_all(usuarios.values())
    db.flush()
    return usuarios


@pytest.fixture
def client(db: Session, jwt_secret: str) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as api:
        yield api
    app.dependency_overrides.clear()
