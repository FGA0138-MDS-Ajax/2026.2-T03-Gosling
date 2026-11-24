from unittest.mock import MagicMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.candidaturas.router import get_candidatura_service

SENHA = "SenhaDeTeste123!"


def endpoint_candidatura(vaga_id: int) -> str:
    return f"/api/v1/vagas/{vaga_id}/candidaturas"


def autenticar(client: TestClient, email: str) -> dict:
    resposta = client.post(
        "/api/v1/auth/login", json={"email": email, "senha": SENHA}
    )
    assert resposta.status_code == status.HTTP_200_OK, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def payload_vaga() -> dict:
    return {
        "titulo": "Vaga para candidatura",
        "descricao": "Vaga criada pelo teste de candidatura",
        "atividades": "Atividades de apoio realizadas pelo voluntário",
        "causa": "Educação",
        "modalidade": "PRESENCIAL",
        "local": "Brasília - DF",
        "periodo": "MANHA",
        "carga_horaria": 4,
        "numero_vagas": 3,
        "ocorrencias": [
            {
                "inicio": "2027-03-10T08:00:00-03:00",
                "fim": "2027-03-10T12:00:00-03:00",
            }
        ],
    }


def criar_vaga(client: TestClient, headers: dict) -> int:
    resposta = client.post("/api/v1/vagas", json=payload_vaga(), headers=headers)
    assert resposta.status_code in (200, 201), resposta.text
    return int(resposta.json()["id"])


@pytest.fixture
def headers_voluntario(client, contas) -> dict:
    return autenticar(client, "voluntario@example.com")


@pytest.fixture
def headers_ong(client, contas) -> dict:
    return autenticar(client, "ong@example.com")


@pytest.fixture
def vaga_aberta_id(client, headers_ong, db) -> int:
    vaga_id = criar_vaga(client, headers_ong)
    db.execute(
        text("UPDATE vagas SET status = 'ABERTA' WHERE id = :id"),
        {"id": vaga_id},
    )
    db.commit()
    return vaga_id


@pytest.fixture
def vaga_encerrada_id(client, headers_ong, db) -> int:
    vaga_id = criar_vaga(client, headers_ong)
    db.execute(
        text("UPDATE vagas SET status = 'ENCERRADA' WHERE id = :id"),
        {"id": vaga_id},
    )
    db.commit()
    return vaga_id


def test_candidatura_sucesso_retorna_201(
    client: TestClient,
    headers_voluntario: dict,
    vaga_aberta_id: int,
):
    resposta = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_voluntario,
    )

    assert resposta.status_code == status.HTTP_201_CREATED, resposta.text

    dados = resposta.json()

    assert dados["vaga_id"] == vaga_aberta_id
    assert dados["status"] == "PENDENTE"


def test_rejeitar_candidatura_duplicada_retorna_409(
    client: TestClient,
    headers_voluntario: dict,
    vaga_aberta_id: int,
):
    res_primeira = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_voluntario,
    )

    assert res_primeira.status_code == status.HTTP_201_CREATED, res_primeira.text

    res_segunda = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_voluntario,
    )

    assert res_segunda.status_code == status.HTTP_409_CONFLICT
    assert "já possui uma candidatura" in res_segunda.json()["detail"]


def test_rejeitar_candidatura_em_vaga_encerrada_retorna_400(
    client: TestClient,
    headers_voluntario: dict,
    vaga_encerrada_id: int,
):
    resposta = client.post(
        endpoint_candidatura(vaga_encerrada_id),
        headers=headers_voluntario,
    )

    assert resposta.status_code == status.HTTP_400_BAD_REQUEST
    assert "não está no estado ABERTA" in resposta.json()["detail"]


def test_candidatura_em_vaga_inexistente_retorna_404(
    client: TestClient,
    headers_voluntario: dict,
):
    vaga_inexistente_id = 999999

    resposta = client.post(
        endpoint_candidatura(vaga_inexistente_id),
        headers=headers_voluntario,
    )

    assert resposta.status_code == status.HTTP_404_NOT_FOUND
    assert "Vaga não encontrada" in resposta.json()["detail"]


def test_organizacao_nao_pode_se_candidatar_retorna_403(
    client: TestClient,
    headers_ong: dict,
    vaga_aberta_id: int,
):
    resposta = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_ong,
    )

    assert resposta.status_code == status.HTTP_403_FORBIDDEN


def test_candidatura_sem_token_retorna_401(
    client: TestClient,
    vaga_aberta_id: int,
):
    resposta = client.post(endpoint_candidatura(vaga_aberta_id))

    assert resposta.status_code == status.HTTP_401_UNAUTHORIZED


def test_falha_inesperada_no_servico_retorna_500(
    client: TestClient,
    headers_voluntario: dict,
    vaga_aberta_id: int,
):
    service_mock = MagicMock()
    service_mock.candidatar.side_effect = Exception(
        "Erro de conexão com o banco de dados"
    )
    client.app.dependency_overrides[get_candidatura_service] = lambda: service_mock

    try:
        with TestClient(client.app, raise_server_exceptions=False) as cliente_500:
            resposta = cliente_500.post(
                endpoint_candidatura(vaga_aberta_id),
                headers=headers_voluntario,
            )
    finally:
        client.app.dependency_overrides.pop(get_candidatura_service, None)

    assert resposta.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
