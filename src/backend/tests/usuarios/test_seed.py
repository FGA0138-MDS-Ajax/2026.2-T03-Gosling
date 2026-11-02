import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import Base, get_engine
from app.usuarios.models import Usuario
from app.usuarios.seed import main


def test_seed_exige_senha(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    with pytest.raises(RuntimeError, match="DEMO_PASSWORD"):
        main()


def test_seed_cria_contas_uma_vez(
    monkeypatch: pytest.MonkeyPatch, tmp_path, capsys
) -> None:
    monkeypatch.setenv("DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'demo.db'}")
    monkeypatch.setenv("DEMO_PASSWORD", "SenhaDeTeste123!")
    get_engine.cache_clear()
    engine = get_engine()
    Base.metadata.create_all(engine)
    main()
    main()
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Usuario)) == 3
    assert "0 contas" in capsys.readouterr().out
    engine.dispose()
    get_engine.cache_clear()
