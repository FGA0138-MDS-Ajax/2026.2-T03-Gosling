from unittest.mock import MagicMock

from app.voluntarios.me.vagas.repository import VagaRepository


def montar_repo(total=5, linhas=None):
    session = MagicMock()
    resultado = session.execute.return_value
    resultado.scalar_one.return_value = total
    resultado.mappings.return_value.all.return_value = linhas or []
    return VagaRepository(session), session


def test_retorna_vagas_e_total():
    repo, _ = montar_repo(total=5, linhas=[{"id": 1, "titulo": "Vaga A"}])

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert vagas == [{"id": 1, "titulo": "Vaga A"}]
    assert total == 5


def test_sem_vagas_retorna_lista_vazia_e_total_zero():
    repo, _ = montar_repo(total=0, linhas=[])

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert vagas == []
    assert total == 0


def test_contagem_filtra_pela_organizacao():
    repo, session = montar_repo()

    repo.listar_vagas_por_organizacao(organizacao_id=10)

    params_contagem = session.execute.call_args_list[0].args[1]
    assert params_contagem == {"organizacao_id": 10}


def test_calcula_offset_a_partir_da_pagina():
    repo, session = montar_repo()

    repo.listar_vagas_por_organizacao(
        organizacao_id=10, pagina=3, tamanho_pagina=4
    )

    params = session.execute.call_args_list[1].args[1]
    assert params == {"organizacao_id": 10, "limite": 4, "offset": 8}


def test_usa_paginacao_padrao():
    repo, session = montar_repo()

    repo.listar_vagas_por_organizacao(organizacao_id=10)

    params = session.execute.call_args_list[1].args[1]
    assert params["limite"] == 10
    assert params["offset"] == 0


def test_executa_consulta_de_contagem_e_consulta_de_listagem():
    repo, session = montar_repo()

    repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert session.execute.call_count == 2