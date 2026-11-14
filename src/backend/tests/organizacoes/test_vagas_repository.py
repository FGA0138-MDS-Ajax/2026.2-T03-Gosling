import pytest
from sqlalchemy import text
from app.voluntarios.me.vagas.repository import VagaRepository


@pytest.fixture(autouse=True)
def setup_database(db):
    dialect = db.bind.dialect.name

    if dialect == "sqlite":
        db.execute(
            text(
                "CREATE TABLE IF NOT EXISTS vagas ("
                "id INTEGER PRIMARY KEY, "
                "organizacao_id INTEGER NOT NULL, "
                "titulo TEXT NOT NULL, "
                "estado_vaga TEXT NOT NULL, "
                "cidade TEXT, "
                "estado_uf TEXT, "
                "data_criacao TEXT NOT NULL)"
            )
        )
        db.execute(
            text(
                "CREATE TABLE IF NOT EXISTS candidaturas ("
                "id INTEGER PRIMARY KEY, "
                "vaga_id INTEGER NOT NULL, "
                "voluntario_id INTEGER NOT NULL, "
                "status TEXT)"
            )
        )

    db.execute(text("DELETE FROM candidaturas"))
    db.execute(text("DELETE FROM vagas"))
    db.flush()


@pytest.fixture
def repo(db):
    return VagaRepository(db)


def inserir_vaga(
    db,
    id: int,
    organizacao_id: int,
    titulo: str = "Vaga Teste",
    estado_vaga: str = "ABERTA",
    cidade: str | None = "Brasília",
    estado_uf: str | None = "DF",
    data_criacao: str = "2026-01-01 10:00:00",
):
    db.execute(
        text(
            "INSERT INTO vagas (id, organizacao_id, titulo, estado_vaga, cidade, estado_uf, data_criacao) "
            "VALUES (:id, :organizacao_id, :titulo, :estado_vaga, :cidade, :estado_uf, :data_criacao)"
        ),
        {
            "id": id,
            "organizacao_id": organizacao_id,
            "titulo": titulo,
            "estado_vaga": estado_vaga,
            "cidade": cidade,
            "estado_uf": estado_uf,
            "data_criacao": data_criacao,
        },
    )
    db.flush()


def test_organizacao_sem_vagas_retorna_lista_vazia_e_total_zero(repo):
    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=1)

    assert vagas == []
    assert total == 0


def test_retorna_somente_vagas_da_organizacao_informada(repo, db):
    inserir_vaga(db, id=1, organizacao_id=1, titulo="Vaga Org 1")
    inserir_vaga(db, id=2, organizacao_id=2, titulo="Vaga Org 2")

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=1)

    assert total == 1
    assert len(vagas) == 1
    assert vagas[0]["titulo"] == "Vaga Org 1"


def test_paginacao_retorna_fatia_correta_e_total_geral(repo, db):
    for i in range(1, 6):
        inserir_vaga(
            db,
            id=i,
            organizacao_id=1,
            titulo=f"Vaga {i}",
            data_criacao=f"2026-01-0{i} 10:00:00",
        )

    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=1, pagina=2, tamanho_pagina=2
    )

    assert total == 5
    assert len(vagas) == 2