import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="Requer DATABASE_URL apontando para um banco migrado",
)

SENHA = "Senha@123"


def _cnpj_valido(base12: str) -> str:
    def dv(digitos: str, pesos: list[int]) -> str:
        soma = sum(int(d) * p for d, p in zip(digitos, pesos))
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    d1 = dv(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    d2 = dv(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return base12 + d1 + d2


def _cnpj_unico() -> str:
    base = f"{uuid.uuid4().int % 10**8:08d}0001"
    return _cnpj_valido(base)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _criar_organizacao_e_logar(client: TestClient, rotulo: str) -> dict:
    sufixo = uuid.uuid4().hex[:8]
    email = f"{rotulo}.{sufixo}@teste.com"
    resp = client.post(
        "/api/v1/organizacoes",
        json={
            "nome": f"Org {rotulo} {sufixo}",
            "email": email,
            "razao_social": f"Org {rotulo} Ltda",
            "cnpj": _cnpj_unico(),
            "area_atuacao": "Educação",
            "endereco": "Rua Exemplo, 100, Gama, Brasília",
            "responsavel": "Maria Silva",
            "descricao": "Organização de teste",
            "telefone": "61999998888",
            "senha": SENHA,
            "consentimento_termos": True,
        },
    )
    assert resp.status_code in (200, 201), resp.text

    login = client.post("/api/v1/auth/login", json={"email": email, "senha": SENHA})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}


def _criar_vaga(client: TestClient, org: dict, titulo: str) -> None:
    payload = {
        "titulo": titulo,
        "descricao": "Vaga criada pelo teste de integração",
        "cidade": "Brasília",
        "estado_uf": "DF",
    }
    resp = client.post("/api/v1/vagas", json=payload, headers=org["headers"])
    assert resp.status_code in (200, 201), resp.text


def _listar(client: TestClient, org: dict, pagina: int, tamanho: int):
    return client.get(
        f"/api/v1/organizacoes/me/vagas?pagina={pagina}&tamanho_pagina={tamanho}",
        headers=org["headers"],
    )


@pytest.fixture(scope="module")
def cenario(client):
    org_a = _criar_organizacao_e_logar(client, "a")
    org_b = _criar_organizacao_e_logar(client, "b")
    for i in range(5):
        _criar_vaga(client, org_a, f"A-{i}")
    for i in range(2):
        _criar_vaga(client, org_b, f"B-{i}")
    return org_a, org_b


def test_listagem_retorna_so_vagas_da_organizacao_com_paginacao(client, cenario):
    org_a, _ = cenario

    r1 = _listar(client, org_a, pagina=1, tamanho=3)
    assert r1.status_code == 200, r1.text
    corpo1 = r1.json()
    assert len(corpo1["itens"]) == 3
    assert corpo1["total_itens"] == 5

    r2 = _listar(client, org_a, pagina=2, tamanho=3)
    assert r2.status_code == 200, r2.text
    corpo2 = r2.json()
    assert len(corpo2["itens"]) == 2

    titulos = [v["titulo"] for v in corpo1["itens"] + corpo2["itens"]]
    assert sorted(titulos) == [f"A-{i}" for i in range(5)]
    assert len(set(titulos)) == 5


def test_listagem_da_outra_organizacao_nao_mistura(client, cenario):
    _, org_b = cenario

    r = _listar(client, org_b, pagina=1, tamanho=10)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["total_itens"] == 2
    assert all(v["titulo"].startswith("B-") for v in corpo["itens"])


def test_pagina_alem_do_fim_retorna_lista_vazia(client, cenario):
    org_a, _ = cenario

    r = _listar(client, org_a, pagina=99, tamanho=3)
    assert r.status_code == 200, r.text
    assert r.json()["itens"] == []


def test_contagem_indisponivel_retorna_null(client, cenario):
    org_a, _ = cenario

    r = _listar(client, org_a, pagina=1, tamanho=3)
    assert r.status_code == 200, r.text
    assert all(v["total_candidaturas"] is None for v in r.json()["itens"])
