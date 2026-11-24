import json
from importlib import import_module
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core import database


def test_mapeia_aliases_preserva_categorias_e_nao_publica_interesses_privados(
    tmp_path,
    monkeypatch,
):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'causas.db'}")
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    nomes_privados = ["Animais", "Assistência Social", "Interesse privado anterior"]
    try:
        command.upgrade(config, "0007_vagas_salvas")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES "
                    "(1, 'Anterior', 'anterior@example.com', 'hash', 'VOLUNTARIO'), "
                    "(2, 'ONG anterior', 'ong-anterior@example.com', "
                    "'hash', 'ORGANIZACAO')"
                )
            )
            connection.execute(
                text("INSERT INTO voluntarios (id, causas) VALUES (1, :causas)"),
                {"causas": json.dumps(nomes_privados)},
            )
            connection.execute(text("INSERT INTO organizacoes (id) VALUES (2)"))
            connection.execute(
                text(
                    "INSERT INTO causas (id, nome, nome_normalizado) VALUES "
                    "(101, 'Animais', 'animais'), "
                    "(102, 'Proteção animal', 'proteção animal'), "
                    "(103, 'Assistência Social', 'assistência social'), "
                    "(104, 'Cultura', 'cultura'), "
                    "(105, 'Proteção ambiental', 'proteção ambiental')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO vagas (id, organizacao_id, causa_id, titulo, "
                    "descricao, atividades, modalidade, local, periodo, "
                    "carga_horaria, numero_vagas, "
                    "status) VALUES (10, 2, 101, 'Anterior', 'Descrição anterior', "
                    "'Atividades anteriores', 'REMOTO', 'Online', "
                    "'MANHA', 1, 10, 'ABERTA')"
                )
            )

        command.upgrade(config, "head")
        with engine.begin() as connection:
            rows = connection.execute(text("SELECT * FROM causas")).mappings().all()
            por_codigo = {row["codigo"]: row for row in rows}
            assert sum(bool(row["ativo"]) for row in rows) == 8
            assert por_codigo["protecao-animal"]["id"] == 102
            assert por_codigo["cultura"]["id"] == 104
            assert json.loads(por_codigo["protecao-animal"]["aliases"]) == ["Animais"]
            assert por_codigo["legado-101"]["nome"] == "Animais"
            assert not por_codigo["legado-101"]["ativo"]
            assert por_codigo["legado-103"]["nome"] == "Assistência Social"
            assert por_codigo["legado-105"]["nome"] == "Proteção ambiental"
            assert all(row["nome"] != "Interesse privado anterior" for row in rows)
            assert (
                connection.scalar(text("SELECT causa_id FROM vagas WHERE id=10")) == 102
            )
            perfil = (
                connection.execute(
                    text("SELECT causas, causa_ids FROM voluntarios WHERE id=1")
                )
                .mappings()
                .one()
            )
            assert json.loads(perfil["causas"]) == nomes_privados
            assert json.loads(perfil["causa_ids"]) == [102, 103]

            # Reexecutar o preenchimento não duplica registros nem referências.
            import_module(
                "migrations.versions.0008_catalogo_causas"
            ).preencher_catalogo(connection)
            assert connection.scalar(text("SELECT COUNT(*) FROM causas")) == len(rows)

        command.downgrade(config, "0007_vagas_salvas")
        assert "codigo" not in {
            c["name"] for c in inspect(engine).get_columns("causas")
        }
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT COUNT(*) FROM causas")) == len(rows)
            assert (
                json.loads(
                    connection.scalar(text("SELECT causas FROM voluntarios WHERE id=1"))
                )
                == nomes_privados
            )
    finally:
        engine.dispose()
