from unittest.mock import MagicMock

import pytest
from fastapi import status

from app.vagas.router import get_vaga_service
from app.vagas.service import (
    AcessoNegadoVagaException,
    AlteracaoHorarioNaoPermitidaException,
    VagaNaoEncontradaException,
)

SENHA = "SenhaDeTeste123!"
URL = "/api/v1/vagas/vaga-001"


def autenticar(client, email: str) -> dict[str, str]:
    resposta = client.post(
        "/api/v1/auth/login", json={"email": email, "senha": SENHA}
    )
    assert resposta.status_code == status.HTTP_200_OK
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


@pytest.fixture
def service_mock(client) -> MagicMock:
    # A fixture `client` limpa os overrides ao final de cada teste.
    mock = MagicMock()
    client.app.dependency_overrides[get_vaga_service] = lambda: mock
    return mock


def test_atualizar_vaga_sucesso_organizacao_dona(client, contas, service_mock):
    service_mock.atualizar_vaga.return_value = {
        "id": "vaga-001",
        "titulo": "Novo Título",
    }
    headers = autenticar(client, "ong@example.com")

    resposta = client.put(URL, json={"titulo": "Novo Título"}, headers=headers)

    assert resposta.status_code == status.HTTP_200_OK
    assert resposta.json()["titulo"] == "Novo Título"
    chamada = service_mock.atualizar_vaga.call_args.kwargs
    assert chamada["vaga_id"] == "vaga-001"
    assert chamada["organizacao_id"] == str(contas["organizacao"].id)


def test_atualizar_vaga_acesso_negado_organizacao_diferente(
    client, contas, service_mock
):
    service_mock.atualizar_vaga.side_effect = AcessoNegadoVagaException(
        "Acesso negado: Você não tem permissão para alterar esta vaga."
    )
    headers = autenticar(client, "ong@example.com")

    resposta = client.put(URL, json={"titulo": "Outro"}, headers=headers)

    assert resposta.status_code == status.HTTP_403_FORBIDDEN


def test_atualizar_vaga_bloqueia_alteracao_horario_com_candidaturas_ativas(
    client, contas, service_mock
):
    service_mock.atualizar_vaga.side_effect = AlteracaoHorarioNaoPermitidaException(
        "Não é permitido alterar os horários da vaga."
    )
    headers = autenticar(client, "ong@example.com")

    resposta = client.put(URL, json={"titulo": "Outro"}, headers=headers)

    assert resposta.status_code == status.HTTP_400_BAD_REQUEST


def test_atualizar_vaga_nao_encontrada_retorna_404(client, contas, service_mock):
    service_mock.atualizar_vaga.side_effect = VagaNaoEncontradaException(
        "Vaga não encontrada."
    )
    headers = autenticar(client, "ong@example.com")

    resposta = client.put(URL, json={"titulo": "Outro"}, headers=headers)

    assert resposta.status_code == status.HTTP_404_NOT_FOUND
    assert "Vaga não encontrada" in resposta.json()["detail"]


def test_atualizar_vaga_perfil_voluntario_retorna_403(client, contas, service_mock):
    headers = autenticar(client, "voluntario@example.com")

    resposta = client.put(URL, json={"titulo": "Outro"}, headers=headers)

    assert resposta.status_code == status.HTTP_403_FORBIDDEN
    service_mock.atualizar_vaga.assert_not_called()