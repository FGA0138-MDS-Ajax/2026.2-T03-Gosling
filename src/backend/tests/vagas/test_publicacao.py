from copy import deepcopy
from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.usuarios.catalogos import Causa
from app.vagas.enums import StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga


@pytest.fixture
def dados_vaga():
    return {
        "titulo": "Oficina de leitura",
        "descricao": "Leitura compartilhada com a comunidade.",
        "atividades": "Organizar livros e apoiar as atividades de leitura.",
        "causa": "Educação",
        "modalidade": "PRESENCIAL",
        "local": "Brasília, DF",
        "periodo": "MANHA",
        "carga_horaria": 3,
        "numero_vagas": 10,
        "ocorrencias": [
            {
                "inicio": "2026-11-16T09:00:00-03:00",
                "fim": "2026-11-16T12:00:00-03:00",
            }
        ],
    }


def autenticar(client, contas, conta="organizacao"):
    resposta = client.post(
        "/api/v1/auth/login",
        json={"email": contas[conta].email, "senha": "SenhaDeTeste123!"},
    )
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def publicar(client, headers, dados):
    resposta = client.post("/api/v1/vagas", headers=headers, json=dados)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def quantidade(db, modelo):
    return db.scalar(select(func.count()).select_from(modelo))


def test_publica_e_consulta_sem_autenticacao_apos_nova_sessao(
    client, db, contas, dados_vaga
):
    headers = autenticar(client, contas)
    resultado = publicar(client, headers, dados_vaga)
    assert resultado["organizacao"] == {
        "id": contas["organizacao"].id, "nome": contas["organizacao"].nome,
    }
    assert resultado["status"] == "ABERTA"
    assert resultado["ocorrencias"][0]["inicio"] == "2026-11-16T12:00:00Z"
    assert resultado["ocorrencias"][0]["fim"] == "2026-11-16T15:00:00Z"

    with Session(
        bind=db.get_bind(), join_transaction_mode="create_savepoint"
    ) as outra_sessao:
        salvo = outra_sessao.get(Vaga, resultado["id"])
        assert salvo is not None
        assert salvo.ocorrencias[0].inicio == datetime(2026, 11, 16, 12, tzinfo=UTC)

    db.expire_all()
    resposta = client.get("/api/v1/vagas")
    assert resposta.status_code == 200
    assert resposta.json()["total"] == 1
    assert resposta.json()["itens"] == [resultado]
    assert "email" not in resultado["organizacao"]
    assert "telefone" not in resultado["organizacao"]
    assert "responsavel" not in resultado["organizacao"]


@pytest.mark.parametrize("conta", ["voluntario", "administrador", "projeto"])
def test_publicacao_exige_ong(client, db, contas, dados_vaga, conta):
    headers = autenticar(client, contas, conta)
    resposta = client.post("/api/v1/vagas", headers=headers, json=dados_vaga)
    assert resposta.status_code == 403
    assert quantidade(db, Vaga) == 0


def test_publicacao_sem_token_e_negada(client, dados_vaga):
    assert client.post("/api/v1/vagas", json=dados_vaga).status_code == 401


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("titulo", "  "),
        ("atividades", ""),
        ("numero_vagas", 0),
        ("numero_vagas", 1.5),
        ("carga_horaria", 0),
        ("carga_horaria", 1.001),
        ("carga_horaria", 100000),
        ("local", "x" * 501),
        ("modalidade", "INVALIDA"),
        ("ocorrencias", []),
        ("organizacao_id", 999),
        ("status", "ENCERRADA"),
    ],
)
def test_entrada_invalida_nao_deixa_vaga_parcial(
    client, db, contas, dados_vaga, campo, valor
):
    headers = autenticar(client, contas)
    resposta = client.post(
        "/api/v1/vagas", headers=headers, json={**dados_vaga, campo: valor}
    )
    assert resposta.status_code == 422, resposta.text
    assert quantidade(db, Vaga) == 0
    assert quantidade(db, OcorrenciaVaga) == 0
    assert quantidade(db, Causa) == 0


@pytest.mark.parametrize("carga", ["0.01", "1.25", "99999.99"])
def test_limites_de_local_e_carga_horaria(client, contas, dados_vaga, carga):
    headers = autenticar(client, contas)
    dados = {**dados_vaga, "local": "L" * 500, "carga_horaria": carga}
    resultado = publicar(client, headers, dados)
    assert resultado["local"] == dados["local"]
    assert resultado["carga_horaria"] == carga


@pytest.mark.parametrize(
    "intervalo",
    [
        {"inicio": "2026-11-16T09:00:00", "fim": "2026-11-16T12:00:00"},
        {"inicio": "2026-11-16T12:00:00Z", "fim": "2026-11-16T12:00:00Z"},
        {"inicio": "2026-11-16T13:00:00Z", "fim": "2026-11-16T12:00:00Z"},
    ],
)
def test_intervalo_exige_fuso_e_inicio_anterior_ao_fim(
    client, contas, dados_vaga, intervalo
):
    headers = autenticar(client, contas)
    resposta = client.post(
        "/api/v1/vagas", headers=headers,
        json={**dados_vaga, "ocorrencias": [intervalo]},
    )
    assert resposta.status_code == 422, resposta.text


def test_multiplos_encontros_consecutivos_entre_dias_sao_permitidos(
    client, contas, dados_vaga
):
    headers = autenticar(client, contas)
    encontros = [
        {"inicio": "2026-11-16T23:30:00-03:00", "fim": "2026-11-17T00:30:00-03:00"},
        {"inicio": "2026-11-17T00:30:00-03:00", "fim": "2026-11-17T01:30:00-03:00"},
    ]
    resultado = publicar(
        client, headers, {**dados_vaga, "ocorrencias": list(reversed(encontros))}
    )
    assert len(resultado["ocorrencias"]) == 2
    assert resultado["ocorrencias"][0]["inicio"] == "2026-11-17T02:30:00Z"


def test_encontros_sobrepostos_na_mesma_vaga_sao_recusados(
    client, db, contas, dados_vaga
):
    headers = autenticar(client, contas)
    dados = deepcopy(dados_vaga)
    dados["ocorrencias"].append(
        {"inicio": "2026-11-16T11:00:00-03:00", "fim": "2026-11-16T13:00:00-03:00"}
    )
    resposta = client.post("/api/v1/vagas", headers=headers, json=dados)
    assert resposta.status_code == 422
    assert quantidade(db, Vaga) == 0


def test_vagas_distintas_podem_ter_o_mesmo_horario(client, contas, dados_vaga):
    headers = autenticar(client, contas)
    primeira = publicar(client, headers, dados_vaga)
    segunda = publicar(client, headers, {**dados_vaga, "titulo": "Outra oficina"})
    assert primeira["id"] != segunda["id"]


@pytest.mark.parametrize("condicao", ["encerrada", "inativa", "nao_homologada"])
def test_catalogo_aplica_visibilidade(
    client, db, contas, dados_vaga, condicao
):
    headers = autenticar(client, contas)
    resultado = publicar(client, headers, dados_vaga)
    if condicao == "encerrada":
        db.get(Vaga, resultado["id"]).status = StatusVaga.ENCERRADA
    elif condicao == "inativa":
        contas["organizacao"].ativo = False
    else:
        contas["organizacao"].homologada = False
    db.flush()
    assert client.get("/api/v1/vagas").json()["total"] == 0


def test_catalogo_paginado_e_causa_compartilhada(client, db, contas, dados_vaga):
    headers = autenticar(client, contas)
    primeira = publicar(client, headers, dados_vaga)
    publicar(client, headers, {**dados_vaga, "causa": "EDUCAÇÃO"})
    publicar(client, headers, dados_vaga)
    assert quantidade(db, Causa) == 1
    resposta = client.get("/api/v1/vagas?pagina=2&por_pagina=2")
    assert resposta.status_code == 200
    assert resposta.json()["total"] == 3
    assert resposta.json()["itens"][0]["id"] == primeira["id"]
    assert len(resposta.json()["itens"]) == 1
    assert client.get("/api/v1/vagas?pagina=0").status_code == 422


def test_falha_ao_confirmar_nao_deixa_publicacao_parcial(
    client, db, contas, dados_vaga, monkeypatch
):
    from app.vagas.repository import VagaRepository

    headers = autenticar(client, contas)

    def falhar(repository):
        raise RuntimeError("Falha simulada no commit.")

    monkeypatch.setattr(VagaRepository, "confirmar", falhar)
    with pytest.raises(RuntimeError, match="Falha simulada"):
        client.post("/api/v1/vagas", headers=headers, json=dados_vaga)
    assert quantidade(db, Vaga) == 0
    assert quantidade(db, OcorrenciaVaga) == 0
    assert quantidade(db, Causa) == 0


def test_causa_criada_entre_consulta_e_insert_e_reutilizada(
    client, db, contas, dados_vaga, monkeypatch
):
    headers = autenticar(client, contas)
    primeira = publicar(client, headers, dados_vaga)
    consultar_original = db.scalar
    consultas = 0

    def consultar(statement, *args, **kwargs):
        nonlocal consultas
        descricoes = getattr(statement, "column_descriptions", [])
        if descricoes and descricoes[0].get("entity") is Causa:
            consultas += 1
            if consultas == 1:
                return None
        return consultar_original(statement, *args, **kwargs)

    monkeypatch.setattr(db, "scalar", consultar)
    segunda = publicar(client, headers, dados_vaga)
    assert primeira["causa"]["id"] == segunda["causa"]["id"]
    assert quantidade(db, Causa) == 1
