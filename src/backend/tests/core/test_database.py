import pytest
from sqlalchemy import text

from app.core.config import get_database_url
from app.core.database import get_db, get_engine


def test_database_url_precisa_ser_configurada(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_database_url()


def test_sessao_abre_e_executa_consulta(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    get_engine.cache_clear()
    session_generator = get_db()
    session = next(session_generator)
    assert session.scalar(text("SELECT 1")) == 1
    session_generator.close()
    get_engine().dispose()
    get_engine.cache_clear()
