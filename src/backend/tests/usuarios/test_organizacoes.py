import pytest

from app.core.security import verify_password
from app.usuarios.models import Organizacao


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
