import pytest
from sqlalchemy import text

from app.voluntarios.me.vagas.repository import VagaRepository


@pytest.fixture
def repo(db):
    db.execute(
        text(
            "CREATE TABLE vagas ("
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
            "CREATE TABLE candidaturas ("
            "id INTEGER PRIMARY KEY, "
            "vaga_id INTEGER NOT NULL)"
        )
    )
    return VagaRepository(db)


def inserir_vaga(
    db,
    id,
    organizacao_id,
    titulo,
    data="2026-01-01 10:00:00",
    estado="ABERTA",
    cidade="Brasília",
    uf="DF",
):
    db.execute(
        text(
            "INSERT INTO vagas "
            "(id, organizacao_id, titulo, estado_vaga, cidade, estado_uf, data_criacao) "
            "VALUES (:id, :org, :titulo, :estado, :cidade, :uf, :data)"
        ),
        {
            "id": id,
            "org": organizacao_id,
            "titulo": titulo,
            "estado": estado,
            "cidade": cidade,
            "uf": uf,
            "data": data,
        },
    )


def inserir_candidaturas(db, vaga_id, quantidade):
    if quantidade:
        db.execute(
            text("INSERT INTO candidaturas (vaga_id) VALUES (:vaga_id)"),
            [{"vaga_id": vaga_id}] * quantidade,
        )


def test_organizacao_sem_vagas_retorna_lista_vazia_e_total_zero(repo):
    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=1)

    assert vagas == []
    assert total == 0


def test_retorna_somente_vagas_da_organizacao_informada(repo, db):
    inserir_vaga(db, 1, 10, "Vaga A")
    inserir_vaga(db, 2, 10, "Vaga B")
    inserir_vaga(db, 3, 20, "Vaga de outra organização")

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert total == 2
    assert {v["titulo"] for v in vagas} == {"Vaga A", "Vaga B"}


def test_retorna_dados_essenciais_e_estado_da_vaga(repo, db):
    inserir_vaga(
        db, 1, 10, "Instrutor Java", estado="ENCERRADA", cidade="Gama", uf="DF"
    )

    vagas, _ = repo.listar_vagas_por_organizacao(organizacao_id=10)

    vaga = vagas[0]
    assert vaga["id"] == 1
    assert vaga["titulo"] == "Instrutor Java"
    assert vaga["estado_vaga"] == "ENCERRADA"
    assert vaga["cidade"] == "Gama"
    assert vaga["estado_uf"] == "DF"
    assert "data_criacao" in vaga
    assert "total_candidaturas" in vaga


def test_conta_candidaturas_por_vaga_incluindo_vaga_sem_candidatos(repo, db):
    inserir_vaga(db, 1, 10, "Com candidatos", data="2026-01-02 10:00:00")
    inserir_vaga(db, 2, 10, "Sem candidatos", data="2026-01-01 10:00:00")
    inserir_candidaturas(db, vaga_id=1, quantidade=3)

    vagas, _ = repo.listar_vagas_por_organizacao(organizacao_id=10)

    contagem = {v["titulo"]: v["total_candidaturas"] for v in vagas}
    assert contagem == {"Com candidatos": 3, "Sem candidatos": 0}


def test_candidaturas_de_outra_vaga_nao_sao_contadas(repo, db):
    inserir_vaga(db, 1, 10, "Minha vaga")
    inserir_vaga(db, 2, 20, "Vaga alheia")
    inserir_candidaturas(db, vaga_id=2, quantidade=5)

    vagas, _ = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert vagas[0]["total_candidaturas"] == 0


def test_ordena_da_mais_recente_para_a_mais_antiga(repo, db):
    inserir_vaga(db, 1, 10, "Antiga", data="2026-01-01 08:00:00")
    inserir_vaga(db, 2, 10, "Recente", data="2026-03-01 08:00:00")
    inserir_vaga(db, 3, 10, "Intermediária", data="2026-02-01 08:00:00")

    vagas, _ = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert [v["titulo"] for v in vagas] == ["Recente", "Intermediária", "Antiga"]


@pytest.fixture
def cinco_vagas(db, repo):
    for i in range(1, 6):
        inserir_vaga(db, i, 10, f"Vaga {i}", data=f"2026-01-0{i} 10:00:00")


def test_primeira_pagina_respeita_o_tamanho(repo, cinco_vagas):
    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=10, pagina=1, tamanho_pagina=2
    )

    assert [v["titulo"] for v in vagas] == ["Vaga 5", "Vaga 4"]
    assert total == 5


def test_ultima_pagina_pode_ter_menos_itens(repo, cinco_vagas):
    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=10, pagina=3, tamanho_pagina=2
    )

    assert [v["titulo"] for v in vagas] == ["Vaga 1"]
    assert total == 5


def test_pagina_alem_do_fim_retorna_vazio_mas_mantem_o_total(repo, cinco_vagas):
    vagas, total = repo.listar_vagas_por_organizacao(
        organizacao_id=10, pagina=4, tamanho_pagina=2
    )

    assert vagas == []
    assert total == 5


def test_paginas_nao_repetem_itens(repo, cinco_vagas):
    pagina_1, _ = repo.listar_vagas_por_organizacao(10, pagina=1, tamanho_pagina=2)
    pagina_2, _ = repo.listar_vagas_por_organizacao(10, pagina=2, tamanho_pagina=2)

    ids_1 = {v["id"] for v in pagina_1}
    ids_2 = {v["id"] for v in pagina_2}
    assert ids_1.isdisjoint(ids_2)


def test_valores_padrao_de_paginacao(repo, db):
    for i in range(1, 13):
        inserir_vaga(db, i, 10, f"Vaga {i}", data=f"2026-01-{i:02d} 10:00:00")

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert len(vagas) == 10
    assert total == 12