from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
import jwt
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.organizacoes.router import get_vaga_service
from app.vagas.schemas import PaginatedResponseVagas, VagaResumoResponse
from app.voluntarios.service import ALGORITHM, SECRET_KEY

URL = "/api/v1/organizacoes/me/vagas"
SENHA = "SenhaDeTeste123!"

def gerar_token_teste(
    sub: str = "org-uuid-123",
    perfil: str = "Organizacao",
    expirado: bool = False,
) -> str:
    delta = timedelta(hours=-1) if expirado else timedelta(hours=2)
    payload = {
        "sub": sub,
        "perfil": perfil,
        "exp": datetime.now(timezone.utc) + delta,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def autenticar(client: TestClient, email: str) -> dict[str, str]:
    resposta = client.post(
        "/api/v1/auth/login", json={"email": email, "senha": SENHA}
    )
    assert resposta.status_code == status.HTTP_200_OK
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}

def resposta_padrao_paginada() -> PaginatedResponseVagas:
    return PaginatedResponseVagas(
        itens=[
            VagaResumoResponse(
                id="vaga-uuid-001",
                titulo="Desenvolvedor Python Voluntário",
                estado_vaga="ABERTA",
                cidade="São Paulo",
                estado_uf="SP",
                data_criacao=datetime.now(timezone.utc),
                total_candidaturas=7,
            ),
            VagaResumoResponse(
                id="vaga-uuid-002",
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
    mock.listar_vagas_da_organizacao.return_value = resposta_padrao_paginada()
    client.app.dependency_overrides[get_vaga_service] = lambda: mock
    yield mock
    client.app.dependency_overrides.clear()

def test_listar_minhas_vagas_confirma_dados_contagem_e_paginacao(client, service_mock):
    token = gerar_token_teste(sub="org-uuid-123", perfil="Organizacao")
    
    service_mock.listar_vagas_da_organizacao.return_value = PaginatedResponseVagas(
        itens=[resposta_padrao_paginada().itens[0]],
        pagina=1,
        tamanho_pagina=10,
        total_itens=1,
        total_paginas=1,
    )

    response = client.get(
        f"{URL}?pagina=1&por_pagina=10", headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    assert data["pagina"] == 1
    assert data["tamanho_pagina"] == 10
    assert data["total_itens"] == 1
    assert data["total_paginas"] == 1
    
    item = data["itens"][0]
    assert item["id"] == "vaga-uuid-001"
    assert item["estado_vaga"] == "ABERTA"
    assert item["total_candidaturas"] == 7

def test_listar_minhas_vagas_garante_isolamento_de_organizacao(client, service_mock):
    id_org_logada = "org-uuid-888-exclusiva"
    token_org_a = gerar_token_teste(sub=id_org_logada, perfil="Organizacao")
    
    service_mock.listar_vagas_da_organizacao.return_value = PaginatedResponseVagas(
        itens=[], pagina=1, tamanho_pagina=10, total_itens=0, total_paginas=0
    )

    client.get(URL, headers={"Authorization": f"Bearer {token_org_a}"})
    
    service_mock.listar_vagas_da_organizacao.assert_called_once()
    _, kwargs = service_mock.listar_vagas_da_organizacao.call_args
    assert kwargs["organizacao_id"] == id_org_logada

def test_listar_vagas_usa_o_id_da_organizacao_do_jwt_com_fixture(client, contas, service_mock):
    headers = autenticar(client, "ong@example.com")

    client.get(URL, headers=headers)

    service_mock.listar_vagas_da_organizacao.assert_called_once()
    _, kwargs = service_mock.listar_vagas_da_organizacao.call_args
    assert kwargs["organizacao_id"] == contas["organizacao"].id

def test_listar_vagas_repassa_parametros_de_paginacao(client, contas, service_mock):
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

def test_listar_minhas_vagas_lista_vazia_retorna_200_ok(client, service_mock):
    token = gerar_token_teste(sub="org-sem-vagas", perfil="Organizacao")
    
    service_mock.listar_vagas_da_organizacao.return_value = PaginatedResponseVagas(
        itens=[], pagina=1, tamanho_pagina=10, total_itens=0, total_paginas=0
    )

    response = client.get(URL, headers={"Authorization": f"Bearer {token}"})
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["itens"] == []
    assert data["total_itens"] == 0
    assert data["total_paginas"] == 0

def test_listar_minhas_vagas_sem_autenticacao_retorna_401(client, service_mock):
    response = client.get(URL)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    service_mock.listar_vagas_da_organizacao.assert_not_called()

def test_listar_minhas_vagas_token_expirado_retorna_401(client, service_mock):
    token_expirado = gerar_token_teste(expirado=True)
    response = client.get(URL, headers={"Authorization": f"Bearer {token_expirado}"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    service_mock.listar_vagas_da_organizacao.assert_not_called()

def test_listar_vagas_com_token_invalido_retorna_401(client, service_mock):
    response = client.get(URL, headers={"Authorization": "Bearer token-invalido"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    service_mock.listar_vagas_da_organizacao.assert_not_called()

def test_listar_minhas_vagas_perfil_voluntario_retorna_403(client, service_mock):
    token_voluntario = gerar_token_teste(sub="voluntario-123", perfil="Voluntario")
    response = client.get(URL, headers={"Authorization": f"Bearer {token_voluntario}"})
    assert response.status_code == status.HTTP_403_FORBIDDEN
    service_mock.listar_vagas_da_organizacao.assert_not_called()

def test_listar_vagas_com_perfil_voluntario_fixture_retorna_403(client, contas, service_mock):
    headers = autenticar(client, "voluntario@example.com")
    resposta = client.get(URL, headers=headers)
    assert resposta.status_code == status.HTTP_403_FORBIDDEN
    service_mock.listar_vagas_da_organizacao.assert_not_called()

def test_listar_minhas_vagas_erro_no_banco_retorna_500(client, service_mock):
    token = gerar_token_teste(sub="org-uuid-123", perfil="Organizacao")
    
    service_mock.listar_vagas_da_organizacao.side_effect = Exception("Erro de conexão com o banco MySQL")

    response = client.get(URL, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
