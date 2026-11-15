from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.usuarios.models import Organizacao, Usuario


@pytest.fixture
def dados():
    return {
        "nome": "Instituto Exemplo",
        "email": "instituto@example.com",
        "senha": "SenhaDeTeste123!",
        "razao_social": "Instituto Exemplo de Apoio Social",
        "cnpj": "11.222.333/0001-81",
        "area_atuacao": "Educação",
        "endereco": "Rua Exemplo, 100, Brasília",
        "responsavel": "Maria da Silva",
        "descricao": "Apoio educacional à comunidade.",
        "telefone": "(61) 99999-9999",
        "consentimento_termos": True,
    }


def cadastrar(client, dados):
    resposta = client.post("/api/v1/organizacoes", json=dados)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def autenticar(client, email, senha="SenhaDeTeste123!"):
    resposta = client.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": senha},
    )
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def corpo_perfil(dados):
    return {
        campo: valor
        for campo, valor in dados.items()
        if campo not in {"senha", "consentimento_termos"}
    }


def test_cadastro_persiste_conta_e_senha_argon2(client, db, dados):
    resultado = cadastrar(client, dados)
    db.expire_all()
    salvo = db.get(Organizacao, resultado["id"])
    assert salvo is not None
    assert salvo.cnpj == "11222333000181"
    assert salvo.telefone == "61999999999"
    assert salvo.razao_social == dados["razao_social"]
    assert salvo.consentimento_termos is True
    assert salvo.homologada is True
    assert salvo.senha_hash.startswith("$argon2")
    assert verify_password(dados["senha"], salvo.senha_hash)
    assert resultado["perfil"] == "ORGANIZACAO"
    assert resultado["tipo"] == "ONG"
    assert "senha" not in resultado
    assert "senha_hash" not in resultado


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("cnpj", "11222333000182"),
        ("email", "email-invalido"),
        ("nome", "   "),
        ("consentimento_termos", False),
        ("consentimento_termos", "true"),
        ("perfil", "ADMINISTRADOR"),
        ("tipo", "PROJETO_SOCIAL"),
        ("homologada", True),
    ],
)
def test_cadastro_rejeita_dados_invalidos(client, dados, campo, valor):
    resposta = client.post(
        "/api/v1/organizacoes",
        json={**dados, campo: valor},
    )
    assert resposta.status_code == 422


@pytest.mark.parametrize("campo", ["email", "cnpj"])
def test_cadastro_impede_duplicidade(client, dados, campo):
    cadastrar(client, dados)
    outro = {
        **dados,
        "email": "outra@example.com",
        "cnpj": "11.444.777/0001-61",
    }
    outro[campo] = dados[campo]
    resposta = client.post("/api/v1/organizacoes", json=outro)
    assert resposta.status_code == 409


def test_perfil_exige_autenticacao_e_perfil_correto(client, contas, dados):
    body = corpo_perfil(dados)
    assert client.get("/api/v1/organizacoes/me").status_code == 401
    assert client.put("/api/v1/organizacoes/me", json=body).status_code == 401
    for conta in ("voluntario", "administrador"):
        headers = autenticar(client, contas[conta].email)
        assert client.get("/api/v1/organizacoes/me", headers=headers).status_code == 403
        assert (
            client.put(
                "/api/v1/organizacoes/me",
                headers=headers,
                json=body,
            ).status_code
            == 403
        )


def test_consulta_e_edicao_afetam_apenas_a_propria_ong(client, db, dados):
    primeira = cadastrar(client, dados)
    segunda = cadastrar(
        client,
        {
            **dados,
            "nome": "Outra organização",
            "email": "outra@example.com",
            "cnpj": "11.444.777/0001-61",
        },
    )
    headers = autenticar(client, dados["email"])

    consulta = client.get("/api/v1/organizacoes/me", headers=headers)
    assert consulta.status_code == 200
    assert consulta.json()["id"] == primeira["id"]

    atualizacao = {
        **corpo_perfil(dados),
        "descricao": "Descrição atualizada.",
        "telefone": "61988887777",
    }
    resposta = client.put(
        "/api/v1/organizacoes/me",
        headers=headers,
        json=atualizacao,
    )
    assert resposta.status_code == 200, resposta.text

    db.expire_all()
    assert db.get(Organizacao, primeira["id"]).descricao == "Descrição atualizada."
    assert db.get(Organizacao, segunda["id"]).descricao == dados["descricao"]


@pytest.mark.parametrize(
    "campo",
    ["id", "perfil", "tipo", "homologada", "ativo", "senha_hash"],
)
def test_edicao_rejeita_campos_protegidos(client, dados, campo):
    cadastrar(client, dados)
    headers = autenticar(client, dados["email"])

    resposta = client.put(
        "/api/v1/organizacoes/me",
        headers=headers,
        json={**corpo_perfil(dados), campo: "alteracao"},
    )
    assert resposta.status_code == 422


@pytest.fixture
def outra_ong(client, dados):
    return cadastrar(
        client,
        {
            **dados,
            "nome": "Outra ONG",
            "email": "outra@example.com",
            "cnpj": "11.444.777/0001-61",
        },
    )
def consultar_perfil(client, headers, **kwargs):
    resposta = client.get(
        "/api/v1/organizacoes/me", headers=headers, **kwargs
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()

def test_fluxo_cadastro_login_edicao_e_novo_login(client, db, dados):
    cadastro = cadastrar(client, dados)
    headers = autenticar(client, dados["email"])
    assert consultar_perfil(client, headers) == cadastro

    alteracoes = {
        **corpo_perfil(dados),
        "nome": "Instituto Atualizado",
        "email": "novo-email@example.com",
        "descricao": "Descricao atualizada pelo titular.",
    }
    resposta = client.put(
        "/api/v1/organizacoes/me", headers=headers, json=alteracoes
    )
    assert resposta.status_code == 200, resposta.text
    novos_headers = autenticar(client, alteracoes["email"])
    db.expire_all()
    perfil = consultar_perfil(client, novos_headers)
    assert perfil["id"] == cadastro["id"]
    for campo in ("nome", "email", "descricao"):
        assert perfil[campo] == alteracoes[campo]
    assert perfil["perfil"] == "ORGANIZACAO"
    assert perfil["tipo"] == "ONG"
    assert perfil["homologada"] is True
    sessao = client.get("/api/v1/auth/me", headers=novos_headers)
    assert sessao.status_code == 200, sessao.text
    assert sessao.json()["usuario"]["nome"] == alteracoes["nome"]
    assert sessao.json()["usuario"]["email"] == alteracoes["email"]
    login_antigo = client.post(
        "/api/v1/auth/login",
        json={"email": dados["email"], "senha": dados["senha"]},
    )
    assert login_antigo.status_code == 401
    with Session(
        bind=db.get_bind(), join_transaction_mode="create_savepoint"
    ) as nova_sessao:
        salvo = nova_sessao.get(Organizacao, cadastro["id"])
        assert salvo is not None
        assert salvo.email == alteracoes["email"]
        assert salvo.descricao == alteracoes["descricao"]

def test_query_nao_troca_o_titular_do_perfil(client, db, dados, outra_ong):
    cadastro = cadastrar(client, dados)
    headers = autenticar(client, dados["email"])
    headers_outra = autenticar(client, outra_ong["email"])
    parametros = {"id": outra_ong["id"], "usuario_id": outra_ong["id"]}
    consulta = consultar_perfil(client, headers, params=parametros)
    assert consulta["id"] == cadastro["id"]
    resposta = client.put(
        "/api/v1/organizacoes/me",
        headers=headers,
        params=parametros,
        json={
            **corpo_perfil(dados),
            "descricao": "Alteracao feita pela primeira ONG.",
        },
    )
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["id"] == cadastro["id"]
    db.expire_all()
    assert consultar_perfil(client, headers)["descricao"] == (
        "Alteracao feita pela primeira ONG."
    )
    assert consultar_perfil(client, headers_outra) == outra_ong

def test_id_de_outra_ong_no_corpo_nao_altera_nenhuma_conta(
    client, db, dados, outra_ong
):
    cadastro = cadastrar(client, dados)
    headers = autenticar(client, dados["email"])
    headers_outra = autenticar(client, outra_ong["email"])

    resposta = client.put(
        "/api/v1/organizacoes/me",
        headers=headers,
        json={
            **corpo_perfil(dados),
            "id": outra_ong["id"],
            "descricao": "Tentativa de alterar outra conta.",
        },
    )
    assert resposta.status_code == 422, resposta.text
    db.expire_all()
    assert consultar_perfil(client, headers) == cadastro
    assert consultar_perfil(client, headers_outra) == outra_ong

@pytest.mark.parametrize("campo", ["email", "cnpj"])
def test_edicao_duplicada_nao_altera_nenhuma_ong(
    client, db, dados, outra_ong, campo
):
    cadastro = cadastrar(client, dados)
    headers = autenticar(client, dados["email"])
    headers_outra = autenticar(client, outra_ong["email"])
    resposta = client.put(
        "/api/v1/organizacoes/me",
        headers=headers,
        json={
            **corpo_perfil(dados),
            campo: outra_ong[campo],
            "descricao": "Esta alteracao deve ser recusada.",
        },
    )
    assert resposta.status_code == 409, resposta.text
    db.expire_all()
    assert consultar_perfil(client, headers) == cadastro
    assert consultar_perfil(client, headers_outra) == outra_ong

@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("nome", "   "),
        ("email", "email-invalido"),
        ("cnpj", "11222333000182"),
        ("telefone", "123"),
        ("razao_social", None),
        ("cnpj", None),
    ],
)
def test_edicao_invalida_preserva_os_dados(client, db, dados, campo, valor):
    cadastro = cadastrar(client, dados)
    headers = autenticar(client, dados["email"])
    resposta = client.put(
        "/api/v1/organizacoes/me",
        headers=headers,
        json={
            **corpo_perfil(dados),
            campo: valor,
            "descricao": "Esta alteracao deve ser recusada.",
        },
    )
    assert resposta.status_code == 422, resposta.text

    db.expire_all()
    assert consultar_perfil(client, headers) == cadastro

@pytest.mark.parametrize("metodo", ["GET", "PUT"])
@pytest.mark.parametrize("problema", ["expirado", "assinatura", "perfil"])
def test_token_invalido_nao_acessa_nem_altera_ong(
    client, db, dados, jwt_secret, metodo, problema
):
    cadastro = cadastrar(client, dados)
    headers_validos = autenticar(client, dados["email"])
    agora = datetime.now(UTC)
    payload = {
        "sub": str(cadastro["id"]),
        "perfil": "ORGANIZACAO",
        "iat": agora - timedelta(minutes=2),
        "exp": agora + timedelta(minutes=5),
    }
    segredo = jwt_secret

    if problema == "expirado":
        payload["exp"] = agora - timedelta(minutes=1)
    elif problema == "assinatura":
        segredo = "outra-chave-ficticia-exclusiva-dos-testes-123456"
    else:
        payload["perfil"] = "ADMINISTRADOR"
    token = jwt.encode(payload, segredo, algorithm="HS256")
    resposta = client.request(
        metodo,
        "/api/v1/organizacoes/me",
        headers={"Authorization": f"Bearer {token}"},
        json=(
            {
                **corpo_perfil(dados),
                "descricao": "Esta alteracao deve ser recusada.",
            }
            if metodo == "PUT"
            else None
        ),
    )
    assert resposta.status_code == 401, resposta.text
    db.expire_all()
    assert consultar_perfil(client, headers_validos) == cadastro

@pytest.mark.parametrize("senha", ["", "1234567"])
def test_senha_curta_nao_cria_conta_parcial(client, db, dados, senha):
    total_antes = db.scalar(select(func.count()).select_from(Usuario))

    resposta = client.post(
        "/api/v1/organizacoes", json={**dados, "senha": senha}
    )
    assert resposta.status_code == 422, resposta.text
    db.expire_all()
    total_depois = db.scalar(select(func.count()).select_from(Usuario))
    assert total_depois == total_antes