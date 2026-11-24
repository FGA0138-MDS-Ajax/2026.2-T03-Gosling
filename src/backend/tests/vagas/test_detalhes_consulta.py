"""Issue #43 (CN05-RF14): consulta pública completa de uma vaga."""

import pytest

from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga
from tests.vagas.test_publicacao import autenticar, publicar

pytest_plugins = ["tests.vagas.test_publicacao"]

CHAVES_PUBLICAS_ORGANIZACAO = {"id", "nome", "homologada", "descricao"}


@pytest.fixture
def contatos_reservados(db, contas):
    ong = contas["organizacao"]
    ong.telefone = "61988887777"
    ong.responsavel = "Responsável Reservado"
    ong.cnpj = "11222333000181"
    db.flush()
    return (ong.email, ong.telefone, ong.responsavel, ong.cnpj, ong.senha_hash)


def test_ocorrencias_em_fusos_diferentes_saem_ordenadas_e_em_utc(
    client, db, contas, dados_vaga
):
    dados_vaga["ocorrencias"] = [
        {"inicio": "2026-12-10T19:00:00-03:00", "fim": "2026-12-10T21:00:00-03:00"},
        {"inicio": "2026-12-01T12:00:00Z", "fim": "2026-12-01T15:00:00Z"},
        {"inicio": "2026-12-05T08:00:00-05:00", "fim": "2026-12-05T10:00:00-05:00"},
    ]
    publicado = publicar(client, autenticar(client, contas), dados_vaga)
    db.expire_all()

    ocorrencias = client.get(f"/api/v1/vagas/{publicado['id']}").json()["ocorrencias"]

    assert [(o["inicio"], o["fim"]) for o in ocorrencias] == [
        ("2026-12-01T12:00:00Z", "2026-12-01T15:00:00Z"),
        ("2026-12-05T13:00:00Z", "2026-12-05T15:00:00Z"),
        ("2026-12-10T22:00:00Z", "2026-12-11T00:00:00Z"),
    ]


def test_encontro_noturno_em_brasilia_vira_o_dia_em_utc(client, db, contas, dados_vaga):
    dados_vaga["periodo"] = "NOITE"
    dados_vaga["ocorrencias"] = [
        {"inicio": "2026-12-16T22:00:00-03:00", "fim": "2026-12-16T23:30:00-03:00"}
    ]
    publicado = publicar(client, autenticar(client, contas), dados_vaga)
    db.expire_all()

    ocorrencia = client.get(f"/api/v1/vagas/{publicado['id']}").json()["ocorrencias"][0]

    assert ocorrencia["inicio"] == "2026-12-17T01:00:00Z"
    assert ocorrencia["fim"] == "2026-12-17T02:30:00Z"


@pytest.mark.parametrize("conta", [None, "voluntario", "organizacao"])
def test_detalhe_e_o_mesmo_para_visitante_e_usuarios_autenticados(
    client, db, contas, dados_vaga, contatos_reservados, conta
):
    publicado = publicar(client, autenticar(client, contas), dados_vaga)
    db.expire_all()
    headers = autenticar(client, contas, conta) if conta else {}

    resposta = client.get(f"/api/v1/vagas/{publicado['id']}", headers=headers)

    assert resposta.status_code == 200
    vaga = resposta.json()
    assert vaga == publicado
    assert vaga["candidaturas_disponiveis"] is False
    assert set(vaga["organizacao"]) == CHAVES_PUBLICAS_ORGANIZACAO
    for reservado in contatos_reservados:
        assert reservado not in resposta.text


def test_listagem_publica_tambem_nao_expoe_contatos(
    client, db, contas, dados_vaga, contatos_reservados
):
    publicar(client, autenticar(client, contas), dados_vaga)
    db.expire_all()

    resposta = client.get("/api/v1/vagas")

    assert resposta.status_code == 200
    item = resposta.json()["itens"][0]
    assert set(item["organizacao"]) == CHAVES_PUBLICAS_ORGANIZACAO
    for reservado in contatos_reservados:
        assert reservado not in resposta.text


def test_vaga_indisponivel_nao_aparece_nem_para_a_propria_organizacao(
    client, db, contas, dados_vaga
):
    headers = autenticar(client, contas)
    publicado = publicar(client, headers, dados_vaga)
    db.get(Vaga, publicado["id"]).status = StatusVaga.SUSPENSA
    db.flush()

    for cabecalhos in ({}, headers, autenticar(client, contas, "voluntario")):
        resposta = client.get(f"/api/v1/vagas/{publicado['id']}", headers=cabecalhos)
        assert resposta.status_code == 404
        assert resposta.json()["detail"] == "Vaga não encontrada ou indisponível."


@pytest.mark.parametrize("identificador", ["0", "-1", "abc"])
def test_identificadores_invalidos_sao_recusados(client, identificador):
    assert client.get(f"/api/v1/vagas/{identificador}").status_code == 422
