from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core import database


def test_migracao_preserva_contas_e_permite_upgrade_e_downgrade(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'migracao.db'}")
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    try:
        command.upgrade(config, "0005_layout_voluntario_vaga")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO usuarios (id, nome, email, senha_hash, perfil) "
                    "VALUES (1, 'Anterior', 'anterior@example.com', "
                    "'hash', 'VOLUNTARIO')"
                )
            )
            connection.execute(text("INSERT INTO voluntarios (id) VALUES (1)"))

        command.upgrade(config, "head")
        inspector = inspect(engine)
        assert "candidaturas" in inspector.get_table_names()
        assert {i["name"] for i in inspector.get_indexes("candidaturas")} == {
            "ix_candidaturas_voluntario_status",
            "ix_candidaturas_vaga_id",
        }
        assert inspector.get_unique_constraints("candidaturas")[0]["column_names"] == [
            "voluntario_id",
            "vaga_id",
        ]
        assert {
            f["referred_table"] for f in inspector.get_foreign_keys("candidaturas")
        } == {
            "voluntarios",
            "vagas",
        }

        command.downgrade(config, "0005_layout_voluntario_vaga")
        assert "candidaturas" not in inspect(engine).get_table_names()
        with engine.connect() as connection:
            assert connection.scalar(
                text("SELECT nome FROM usuarios WHERE id = 1")
            ) == ("Anterior")
            assert (
                connection.scalar(text("SELECT id FROM voluntarios WHERE id = 1")) == 1
            )
        command.upgrade(config, "head")
        assert "candidaturas" in inspect(engine).get_table_names()
    finally:
        engine.dispose()
