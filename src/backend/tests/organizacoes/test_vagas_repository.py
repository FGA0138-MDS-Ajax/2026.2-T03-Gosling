import pytest
from sqlalchemy import text

from app.voluntarios.me.vagas.repository import VagaRepository


@pytest.fixture(autouse=True)
def criar_tabelas_no_sqlite(db):
    if db.get_bind().dialect.name != "sqlite":
        return

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


@pytest.fixture
def repo(db):
    return VagaRepository(db)


@pytest.fixture
def org_id(contas):
    return contas["organizacao"].id


@pytest.fixture
def outra_org_id(contas):
    return contas["projeto"].id


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
            "INSERT INTO vagas "
            "(id, organizacao_id, titulo, estado_vaga, "
            "cidade, estado_uf, data_criacao) "
            "VALUES "
            "(:id, :organizacao_id, :titulo, :estado_vaga, "
            ":cidade, :estado_uf, :data_criacao)"
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


def inserir_candidatura(db, id: int, vaga_id: int, voluntario_id: int):
    db.execute(
        text(
            "INSERT INTO candidaturas (id, vaga_id, voluntario_id) "
            "VALUES (:id, :vaga_id, :voluntario_id)"
        ),
        {"id": id, "vaga_id": vaga_id, "voluntario_id": voluntario_id},
    )
    db.flush()


@pytest.fixture
def cinco_vagas(db, org_id):
    for i in range(1, 6):
        inserir_vaga(
            db,
            id=i,
            organizacao_id=org_id,
            titulo=f"Vaga {i}",
            data_criacao=f"2026-01-0{i} 10:00:00",
        )


def test_organizacao_sem_vagas_retorna_lista_vazia_e_total_zero(repo, org_id):
    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=org_id)

    assert vagas == []
    assert total == 0


def test_retorna_somente_vagas_da_organizacao_informada(
    repo, db, org_id, outra_org_id
):
    inserir_vaga(db, id=1, organizacao_id=org_id, titulo="Vaga da org")
    inserir_vaga(db, id=2, organizacao_id=outra_org_id, titulo="Vaga alheia")

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=org_id)

    assert total == 1
    assert len(vagas) == 1
    assert vagas[0]["titulo"] == "Vaga da org"


def test_retorna_dados_essenciais_e_estado_da_vaga(repo, db, org_id):
    inserir_vaga(
        db,
        id=1,
        organizacao_id=org_id,
        titulo="Instrutor Java",
        estado_vaga="ENCERRADA",
        cidade="Gama",
        estado_uf="DF",
    )

    vagas, _ = repo.listar_vagas_por_organizacao(organizacao_id=org_id)

    vaga = vagas[0]
    assert str(vaga["id"]) == "1"
    assert vaga["titulo"] == "Instrutor Java"
    assert vaga["estado_vaga"] == "ENCERRADA"
    assert vaga["cidade"] == "Gama"
    assert vaga["estado_uf"] == "DF"
    assert "data_criacao" in vaga
    assert vaga["total_candidaturas"] == 0


def test_conta_candidaturas_por_vaga_sem_misturar_outras_vagas(
    repo, db, contas, org_id, outra_org_id
):
    voluntario = contas["voluntario"].id
    outro_voluntario = contas["inativo"].id
    inserir_vaga(db, id=1, organizacao_id=org_id, titulo="Com candidatos")
    inserir_vaga(db, id=2, organizacao_id=org_id, titulo="Sem candidatos")
    inserir_vaga(db, id=3, organizacao_id=outra_org_id, titulo="Vaga alheia")
    inserir_candidatura(db, id=1, vaga_id=1, voluntario_id=voluntario)
    inserir_candidatura(db, id=2, vaga_id=1, voluntario_id=outro_voluntario)
    inserir_candidatura(db, id=3, vaga_id=3, voluntario_id=voluntario)

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=org_id)

    contagem = {v["titulo"]: v["total_candidaturas"] for v in vagas}
    assert contagem == {"Com candidatos": 2, "Sem candidatos": 0}
    assert total == 2


def test_ordena_da_mais_recente_para_a_mais_antiga(repo, db, org_id):
    inserir_vaga(
        db, 1, org_id, titulo="Antiga", data_criacao="2026-01-01 08:00:00"
    )
    inserir_vaga(
        db, 2, org_id, titulo="Recente", data_criacao="2026-03-01 08:00:00"
    )
    inserir_vaga(
        db, 3, org_id, titulo="Intermediária", data_criacao="2026-02-01 08:00:00"
    )

    vagas, _ = repo.listar_vagas_por_organizacao(organizacao_id=org_id)

    titulos = [v["titulo"] for v in vagas]
    assert titulos == ["Recente", "Intermediária", "Antiga"]


def test_paginacao_retorna_fatia_correta_e_total_geral(repo, org_id, cinco_vagas):
    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=org_id, pagina=2, tamanho_pagina=2
    )

    assert total == 5
    assert [v["titulo"] for v in vagas] == ["Vaga 3", "Vaga 2"]


def test_ultima_pagina_pode_ter_menos_itens(repo, org_id, cinco_vagas):
    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=org_id, pagina=3, tamanho_pagina=2
    )

    assert total == 5
    assert [v["titulo"] for v in vagas] == ["Vaga 1"]


def test_pagina_alem_do_fim_retorna_vazio_mas_mantem_o_total(
    repo, org_id, cinco_vagas
):
    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=org_id, pagina=4, tamanho_pagina=2
    )

    assert vagas == []
    assert total == 5


def test_usa_paginacao_padrao_de_dez_itens(repo, db, org_id):
    for i in range(1, 13):
        inserir_vaga(
            db,
            id=i,
            organizacao_id=org_id,
            titulo=f"Vaga {i}",
            data_criacao=f"2026-01-{i:02d} 10:00:00",
        )

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=org_id)

    assert len(vagas) == 10
    assert total == 12