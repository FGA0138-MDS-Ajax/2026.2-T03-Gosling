import uuid

import pytest
from fastapi import status
from fastapi.testclient import TestClient

URL_VAGAS = "/api/v1/vagas"
URL_ORGANIZACOES = "/api/v1/organizacoes"
METODO_EDICAO = "PUT"
CAMPO_ESTADO = "estado_vaga"
VALOR_ENCERRADA = "ENCERRADA"
ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000"
SENHA = "SenhaDeTeste123!"


def _cnpj_valido(base12: str) -> str:
    def dv(digitos: str, pesos: list[int]) -> str:
        soma = sum(int(d) * p for d, p in zip(digitos, pesos))
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    d1 = dv(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    d2 = dv(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return base12 + d1 + d2


def _cnpj_unico() -> str:
    return _cnpj_valido(f"{uuid.uuid4().int % 10**8:08d}0001")


def autenticar(client: TestClient, email: str, senha: str = SENHA) -> dict:
    resposta = client.post(
        "/api/v1/auth/login", json={"email": email, "senha": senha}
    )
    assert resposta.status_code == status.HTTP_200_OK, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def criar_organizacao_terceira(client: TestClient) -> dict:
    sufixo = uuid.uuid4().hex[:8]
    email = f"terceira.{sufixo}@teste.com"
    resposta = client.post(
        URL_ORGANIZACOES,
        json={
            "nome": f"Org Terceira {sufixo}",
            "email": email,
            "razao_social": "Org Terceira Ltda",
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
    assert resposta.status_code in (200, 201), resposta.text
    return autenticar(client, email)


def payload_vaga(titulo: str = "Vaga de teste") -> dict:
    return {
        "titulo": titulo,
        "descricao": "Vaga criada pelo teste de edição",
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


def criar_vaga(client: TestClient, headers: dict, titulo: str) -> str:
    resposta = client.post(
        URL_VAGAS, json=payload_vaga(titulo), headers=headers
    )
    assert resposta.status_code in (200, 201), resposta.text
    return resposta.json()["id"]


def editar(client: TestClient, vaga_id: str, corpo: dict, headers=None):
    return client.request(
        METODO_EDICAO,
        f"{URL_VAGAS}/{vaga_id}",
        json=corpo,
        headers=headers or {},
    )


@pytest.fixture
def vaga_da_ong(client, contas):
    headers = autenticar(client, "ong@example.com")
    vaga_id = criar_vaga(client, headers, "Vaga original")
    return vaga_id, headers


def test_organizacao_proprietaria_edita_o_titulo(client, vaga_da_ong):
    vaga_id, headers = vaga_da_ong

    resposta = editar(client, vaga_id, {"titulo": "Titulo atualizado"}, headers)

    assert resposta.status_code == status.HTTP_200_OK, resposta.text
    assert resposta.json()["titulo"] == "Titulo atualizado"


def test_organizacao_terceira_nao_edita_vaga_alheia(client, vaga_da_ong):
    vaga_id, _ = vaga_da_ong
    headers_terceira = criar_organizacao_terceira(client)

    resposta = editar(
        client, vaga_id, {"titulo": "Tentativa de invasao"}, headers_terceira
    )

    assert resposta.status_code == status.HTTP_403_FORBIDDEN, resposta.text


def test_edicao_negada_nao_altera_a_vaga(client, vaga_da_ong):
    vaga_id, headers_dono = vaga_da_ong
    headers_terceira = criar_organizacao_terceira(client)

    editar(client, vaga_id, {"titulo": "Tentativa de invasao"}, headers_terceira)
    resposta = editar(
        client, vaga_id, {"descricao": "Descricao valida nova"}, headers_dono
    )
    assert resposta.status_code == status.HTTP_200_OK, resposta.text
    assert resposta.json()["titulo"] == "Vaga original"


def test_voluntario_nao_edita_vaga(client, contas, vaga_da_ong):
    vaga_id, _ = vaga_da_ong
    headers_voluntario = autenticar(client, "voluntario@example.com")

    resposta = editar(client, vaga_id, {"titulo": "Titulo novo"}, headers_voluntario)

    assert resposta.status_code == status.HTTP_403_FORBIDDEN, resposta.text


def test_edicao_sem_token_retorna_401(client, vaga_da_ong):
    vaga_id, _ = vaga_da_ong

    resposta = editar(client, vaga_id, {"titulo": "Titulo novo"})

    assert resposta.status_code == status.HTTP_401_UNAUTHORIZED


def test_edicao_de_vaga_inexistente_retorna_404(client, contas):
    headers = autenticar(client, "ong@example.com")

    resposta = editar(client, ID_INEXISTENTE, {"titulo": "Titulo novo"}, headers)

    assert resposta.status_code == status.HTTP_404_NOT_FOUND, resposta.text


def test_edicao_com_campo_desconhecido_retorna_422(client, vaga_da_ong):
    vaga_id, headers = vaga_da_ong

    resposta = editar(client, vaga_id, {"campo_inexistente": "x"}, headers)

    assert resposta.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_edicao_com_ocorrencia_de_fim_anterior_ao_inicio_retorna_422(
    client, vaga_da_ong
):
    vaga_id, headers = vaga_da_ong
    corpo = {
        "ocorrencias": [
            {
                "inicio": "2027-03-10T12:00:00-03:00",
                "fim": "2027-03-10T08:00:00-03:00",
            }
        ]
    }

    resposta = editar(client, vaga_id, corpo, headers)

    assert resposta.status_code in (
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_422_UNPROCESSABLE_CONTENT,
    )


def test_edicao_com_ocorrencia_sem_fuso_horario_retorna_422(client, vaga_da_ong):
    vaga_id, headers = vaga_da_ong
    corpo = {
        "ocorrencias": [
            {"inicio": "2027-03-10T08:00:00", "fim": "2027-03-10T12:00:00"}
        ]
    }

    resposta = editar(client, vaga_id, corpo, headers)

    assert resposta.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_organizacao_proprietaria_encerra_a_vaga(client, vaga_da_ong):
    vaga_id, headers = vaga_da_ong

    resposta = editar(client, vaga_id, {CAMPO_ESTADO: VALOR_ENCERRADA}, headers)

    assert resposta.status_code == status.HTTP_200_OK, resposta.text
    assert resposta.json()[CAMPO_ESTADO] == VALOR_ENCERRADA


def test_organizacao_terceira_nao_encerra_vaga_alheia(client, vaga_da_ong):
    vaga_id, _ = vaga_da_ong
    headers_terceira = criar_organizacao_terceira(client)

    resposta = editar(
        client, vaga_id, {CAMPO_ESTADO: VALOR_ENCERRADA}, headers_terceira
    )

    assert resposta.status_code == status.HTTP_403_FORBIDDEN, resposta.text
