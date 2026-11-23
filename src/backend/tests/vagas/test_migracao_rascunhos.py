from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from app.core import database


def test_migracao_preserva_vaga_publicada_e_encontro(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'rascunhos.db'}")
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))

    try:
        command.upgrade(config, "0009_localizacao")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO usuarios (id,nome,email,senha_hash,perfil) VALUES "
                    "(1,'ONG','ong@example.com','hash','ORGANIZACAO')"
                )
            )
            connection.execute(text("INSERT INTO organizacoes (id) VALUES (1)"))
            connection.execute(
                text(
                    "INSERT INTO vagas (id,organizacao_id,causa_id,titulo,descricao,"
                    "atividades,modalidade,local,periodo,carga_horaria,numero_vagas,"
                    "status) "
                    "VALUES (1,1,(SELECT id FROM causas LIMIT 1),'Vaga anterior',"
                    "'Descrição anterior','Atividades anteriores','PRESENCIAL',"
                    "'Brasília','MANHA',3,2,'ABERTA')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO ocorrencias_vaga (id,vaga_id,inicio,fim) VALUES "
                    "(1,1,'2099-11-16 12:00:00','2099-11-16 15:00:00')"
                )
            )

        command.upgrade(config, "head")
        with engine.begin() as connection:
            anterior = connection.execute(
                text(
                    "SELECT titulo,status,versao,criado_em,rascunho "
                    "FROM vagas WHERE id=1"
                )
            ).one()
            assert anterior == ("Vaga anterior", "ABERTA", 1, None, None)
            assert (
                connection.scalar(
                    text("SELECT vaga_id FROM ocorrencias_vaga WHERE id=1")
                )
                == 1
            )
            connection.execute(
                text(
                    "INSERT INTO vagas (id,organizacao_id,status) "
                    "VALUES (2,1,'RASCUNHO')"
                )
            )
            with pytest.raises(IntegrityError):
                connection.execute(text("UPDATE vagas SET status='ABERTA' WHERE id=2"))

        with pytest.raises(RuntimeError, match="não suporta os rascunhos"):
            command.downgrade(config, "0009_localizacao")

        with engine.begin() as connection:
            connection.execute(text("DELETE FROM vagas WHERE id=2"))
        command.downgrade(config, "0009_localizacao")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT titulo FROM vagas WHERE id=1")) == (
                "Vaga anterior"
            )
    finally:
        engine.dispose()
