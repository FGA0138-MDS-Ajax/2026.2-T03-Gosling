from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi import status

from app.candidaturas.enums import StatusCandidatura
from app.candidaturas.models import Candidatura
from app.core.config import JWT_ALGORITHM
from app.jwt_geraçao.dependencies import get_vaga_service
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga
from app.vagas.schemas import (
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


def publicar(client, headers, titulo):
    resposta = client.post(
        "/api/v1/vagas",
        headers=headers,
        json={
            "titulo": titulo,
            "descricao": "Descrição da atividade na organização",
            "atividades": "Atividades de apoio realizadas pelo voluntário",
            "causa": "Educação",
            "modalidade": "PRESENCIAL",
            "local": "Brasília - DF",
            "periodo": "MANHA",
            "carga_horaria": 4,
            "numero_vagas": 3,
            "ocorrencias": [
                {
                    "inicio": "2028-03-10T08:00:00-03:00",
                    "fim": "2028-03-10T12:00:00-03:00",
                }
            ],
        },
    )
    assert resposta.status_code == status.HTTP_201_CREATED, resposta.text
    return resposta.json()["id"]


def test_listagem_real_isola_organizacoes_e_mantem_a_ordem_das_paginas(
    client, db, contas, senha_hash
):
    outra = Organizacao(
        nome="Outra organização",
        email="outra-org@example.com",
        senha_hash=senha_hash,
    )
    db.add(outra)
    db.flush()
    headers_a = autenticar(client, contas["organizacao"].email)
    headers_b = autenticar(client, outra.email)

    aberta = publicar(client, headers_a, "Oficina de leitura")
    outra_vaga = publicar(client, headers_b, "Vaga da outra organização")
    encerrada = publicar(client, headers_a, "Reforço escolar")
    suspensa = publicar(client, headers_a, "Mutirão voluntário")
    db.get(Vaga, encerrada).status = StatusVaga.ENCERRADA
    db.get(Vaga, suspensa).status = StatusVaga.SUSPENSA
    db.add_all(
        [
            Candidatura(voluntario_id=contas["voluntario"].id, vaga_id=aberta),
            Candidatura(
                voluntario_id=contas["voluntario"].id,
                vaga_id=outra_vaga,
                status=StatusCandidatura.CANCELADA,
            ),
        ]
    )
    db.flush()

    primeira = client.get(f"{URL}?pagina=1&tamanho_pagina=2", headers=headers_a)
    segunda = client.get(f"{URL}?pagina=2&tamanho_pagina=2", headers=headers_a)
    ultima = client.get(f"{URL}?pagina=3&tamanho_pagina=2", headers=headers_a)
    lista_b = client.get(URL, headers=headers_b)
    for resposta in (primeira, segunda, ultima, lista_b):
        assert resposta.status_code == status.HTTP_200_OK, resposta.text

    pagina = primeira.json()
    assert (pagina["pagina"], pagina["tamanho_pagina"]) == (1, 2)
    assert (pagina["total_itens"], pagina["total_paginas"]) == (3, 2)
    assert [
        (vaga["id"], vaga["estado_vaga"], vaga["total_candidaturas"])
        for vaga in pagina["itens"]
    ] == [(str(suspensa), "SUSPENSA", 0), (str(encerrada), "ENCERRADA", 0)]

    assert segunda.json()["pagina"] == 2
    assert segunda.json()["itens"] == [{
        "id": str(aberta),
        "titulo": "Oficina de leitura",
        "estado_vaga": "ABERTA",
        "local": "Brasília - DF",
        "descricao": "Descrição da atividade na organização",
        "cidade": None,
        "estado_uf": None,
        "data_criacao": None,
        "total_candidaturas": 1,
    }]
    assert ultima.json()["itens"] == []
    assert ultima.json()["total_itens"] == 3
    assert lista_b.json()["tamanho_pagina"] == 10
    assert [(v["id"], v["total_candidaturas"]) for v in lista_b.json()["itens"]] == [
        (str(outra_vaga), 1)
    ]


def test_listagem_real_de_organizacao_sem_vagas(client, contas):
    headers = autenticar(client, contas["organizacao"].email)

    resposta = client.get(URL, headers=headers)

    assert resposta.status_code == status.HTTP_200_OK
    assert resposta.json() == {
        "itens": [],
        "pagina": 1,
        "tamanho_pagina": 10,
        "total_itens": 0,
        "total_paginas": 0,
    }


def test_listagem_rejeita_token_expirado_com_assinatura_valida(
    client, contas, jwt_secret
):
    headers = autenticar(client, contas["organizacao"].email)
    assert client.get(URL, headers=headers).status_code == status.HTTP_200_OK

    token = headers["Authorization"].removeprefix("Bearer ")
    claims = jwt.decode(token, jwt_secret, algorithms=[JWT_ALGORITHM])
    claims["exp"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    expirado = jwt.encode(claims, jwt_secret, algorithm=JWT_ALGORITHM)

    resposta = client.get(URL, headers={"Authorization": f"Bearer {expirado}"})
    assert resposta.status_code == status.HTTP_401_UNAUTHORIZED
