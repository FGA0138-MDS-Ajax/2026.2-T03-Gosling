from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core import database


def test_migracao_preserva_textos_e_regiao_anterior_sem_inventar_coordenadas(
    tmp_path,
    monkeypatch,
):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'localizacao.db'}")
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    try:
        command.upgrade(config, "0008_catalogo_causas")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO usuarios (id,nome,email,senha_hash,perfil) VALUES "
                    "(1,'Anterior','anterior@example.com','hash','VOLUNTARIO'),"
                    "(2,'ONG','ong@example.com','hash','ORGANIZACAO')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO voluntarios (id,cidade,estado) VALUES (1,'Ceilândia','DF')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO organizacoes (id,endereco) VALUES (2,'Endereço sem CEP')"
                )
            )
            for identificador, modalidade, local in (
                (1, "PRESENCIAL", "Endereço próprio da atividade"),
                (2, "REMOTO", "Reunião online"),
            ):
                connection.execute(
                    text(
                        "INSERT INTO vagas (id,organizacao_id,causa_id,titulo,descricao,"
                        "atividades,modalidade,local,periodo,carga_horaria,numero_vagas,"
                        "status) VALUES (:id,2,(SELECT id FROM causas LIMIT 1),'Anterior',"
                        "'Descrição anterior','Atividades anteriores',:modalidade,:local,"
                        "'MANHA',1,10,'ABERTA')"
                    ),
                    {"id": identificador, "modalidade": modalidade, "local": local},
                )
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert connection.execute(
                text("SELECT cidade,estado,cep,latitude,longitude FROM voluntarios")
            ).one() == ("Ceilândia", "DF", None, None, None)
            assert connection.execute(
                text("SELECT endereco,cep,latitude,longitude FROM organizacoes")
            ).one() == ("Endereço sem CEP", None, None, None)
            assert connection.execute(
                text(
                    "SELECT local,origem_localizacao,latitude,longitude FROM vagas "
                    "ORDER BY id"
                )
            ).all() == [
                ("Endereço próprio da atividade", "LEGADO", None, None),
                ("Reunião online", "REMOTA", None, None),
            ]
        command.downgrade(config, "0008_catalogo_causas")
        assert "latitude" not in {
            c["name"] for c in inspect(engine).get_columns("vagas")
        }
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT endereco FROM organizacoes WHERE id=2"))
                == "Endereço sem CEP"
            )
            assert (
                connection.scalar(text("SELECT cidade FROM voluntarios WHERE id=1"))
                == "Ceilândia"
            )
    finally:
        engine.dispose()
