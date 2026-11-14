from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import status

from app.jwt_geraçao.dependencies import get_vaga_service
from app.voluntarios.me.vagas.schemas import (
    PaginatedResponseVagas,
    VagaResumoResponse,
)

URL = "/api/v1/organizacoes/me/vagas"
SENHA = "SenhaDeTeste123!"


def autenticar(client, email: str) -> dict[str, str]:
    resposta = client.post(
        "/api/v1/auth/login", json={"email": email, "senha": SENHA}
    )
    assert resposta.status_code == status.HTTP_200_OK
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def resposta_paginada() -> PaginatedResponseVagas:
    return PaginatedResponseVagas(
        itens=[
            VagaResumoResponse(
                id="1",
                titulo="Instrutor de Programação Java",
                estado_vaga="ABERTA",
                cidade="São Paulo",
                estado_uf="SP",
                data_criacao=datetime.now(timezone.utc),
                total_candidaturas=12,
            ),
            VagaResumoResponse(
                id="2",
                titulo="Auxiliar de Logística Social",
                estado_vaga="ENCERRADA",
                cidade="Campinas",
                estado_uf="SP",
                data_criacao=datetime.now(timezone.utc),
                total_candidaturas=5,
            ),
        ],
        pagina=1,
        tamanho_pagina=10,
        total_itens=2,
        total_paginas=1,
    )


@pytest.fixture
def service_mock(client) -> MagicMock:
    mock = MagicMock()
    mock.listar_vagas_da_organizacao.return_value = resposta_paginada()
    client.app.dependency_overrides[get_vaga_service] = lambda: mock
    return mock


def test_listar_vagas_retorna_dados_da_organizacao_autenticada(
    client, contas, service_mock
):
    headers = autenticar(client, "ong@example.com")

    resposta = client.get(URL, headers=headers)

    assert resposta.status_code == status.HTTP_200_OK
    dados = resposta.json()
    assert dados["pagina"] == 1
    assert dados["tamanho_pagina"] == 10
    assert dados["total_itens"] == 2
    assert dados["total_paginas"] == 1
    assert len(dados["itens"]) == 2
    primeira = dados["itens"][0]
    assert primeira["titulo"] == "Instrutor de Programação Java"
    assert primeira["estado_vaga"] == "ABERTA"
    assert primeira["total_candidaturas"] == 12


def test_listar_vagas_usa_o_id_da_organizacao_do_jwt(
    client, contas, service_mock
):
    headers = autenticar(client, "ong@example.com")

    client.get(URL, headers=headers)

    service_mock.listar_vagas_da_organizacao.assert_called_once_with(
        organizacao_id=contas["organizacao"].id,
        pagina=1,
        tamanho_pagina=10,
    )


def test_listar_vagas_repassa_parametros_de_paginacao(
    client, contas, service_mock
):
    headers = autenticar(client, "ong@example.com")

    resposta = client.get(f"{URL}?pagina=2&tamanho_pagina=5", headers=headers)

    assert resposta.status_code == status.HTTP_200_OK
    service_mock.listar_vagas_da_organizacao.assert_called_once_with(
        organizacao_id=contas["organizacao"].id,
        pagina=2,
        tamanho_pagina=5,
    )


@pytest.mark.parametrize(
    "query",
    ["pagina=0", "pagina=-1", "tamanho_pagina=0", "tamanho_pagina=101"],
)
def test_listar_vagas_parametros_invalidos_retornam_422(
    client, contas, service_mock, query
):
    headers = autenticar(client, "ong@example.com")

    resposta = client.get(f"{URL}?{query}", headers=headers)

    assert resposta.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    service_mock.listar_vagas_da_organizacao.assert_not_called()


def test_listar_vagas_sem_autenticacao_retorna_401(client, service_mock):
    resposta = client.get(URL)

    assert resposta.status_code == status.HTTP_401_UNAUTHORIZED
    service_mock.listar_vagas_da_organizacao.assert_not_called()


def test_listar_vagas_com_token_invalido_retorna_401(client, service_mock):
    resposta = client.get(URL, headers={"Authorization": "Bearer token-invalido"})

    assert resposta.status_code == status.HTTP_401_UNAUTHORIZED
    service_mock.listar_vagas_da_organizacao.assert_not_called()


def test_listar_vagas_com_perfil_voluntario_retorna_403(
    client, contas, service_mock
):
    headers = autenticar(client, "voluntario@example.com")

    resposta = client.get(URL, headers=headers)

    assert resposta.status_code == status.HTTP_403_FORBIDDEN
    service_mock.listar_vagas_da_organizacao.assert_not_called()