import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token, hash_password
from app.usuarios.models import Usuario


def cadastro(tipo):
    comum = {"nome": "Conta Nova", "email": "nova-validacao@example.com"}
    ong = {
        **comum,
        "razao_social": "Instituto Teste",
        "cnpj": "11222333000181",
        "area_atuacao": "Educação",
        "endereco": "Rua Exemplo, Brasília",
        "responsavel": "Maria Teste",
        "telefone": "(61) 99999-0000",
    }
    if tipo == "voluntario":
        return "/api/v1/voluntarios", "password", {
            "nome_completo": comum["nome"], "email": comum["email"],
            "identificacao": "52998224725", "consentimento_termos": True,
        }
    if tipo == "ong":
        return "/api/v1/organizacoes", "senha", {**ong, "consentimento_termos": True}
    perfil = tipo.removeprefix("admin_")
    return "/api/v1/admin/usuarios", "senha", {
        **(ong if perfil == "ORGANIZACAO" else comum), "perfil": perfil,
    }


@pytest.mark.parametrize("tipo", [
    "voluntario", "ong", "admin_VOLUNTARIO", "admin_ORGANIZACAO", "admin_ADMINISTRADOR",
])
@pytest.mark.parametrize("senha", [
    "A1!bcde", "abcdefgh1!", "Abcdefgh!", "Abcdefgh1", "Abc1!def ", "Abc1!\tdef",
])
def test_nova_senha_invalida_nao_cria_conta_nem_aparece_no_erro(
    client, db, contas, tipo, senha
):
    endpoint, campo, dados = cadastro(tipo)
    admin = contas["administrador"]
    headers = {
        "Authorization": "Bearer " + create_access_token(admin.id, "ADMINISTRADOR")
    }
    quantidade = db.scalar(select(func.count()).select_from(Usuario))
    resposta = client.post(endpoint, headers=headers, json={**dados, campo: senha})
    assert resposta.status_code == 422, resposta.text
    local = resposta.json()["detail"][0]["loc"]
    assert local[0] == "body" and local[-1] == campo
    assert senha not in resposta.text
    assert db.scalar(select(func.count()).select_from(Usuario)) == quantidade


@pytest.mark.parametrize("tipo", ["voluntario", "ong"])
@pytest.mark.parametrize("telefone", ["619999900001", "123", "6199999abc00"])
def test_telefone_invalido_nao_e_truncado_pela_api(client, db, tipo, telefone):
    endpoint, campo, dados = cadastro(tipo)
    resposta = client.post(endpoint, json={
        **dados, campo: "SenhaNova123!", "telefone": telefone,
    })
    assert resposta.status_code == 422, resposta.text
    assert resposta.json()["detail"][0]["loc"] == ["body", "telefone"]
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0


def test_login_preserva_senha_de_conta_existente(client, db, contas):
    titular = contas["voluntario"]
    titular.senha_hash = hash_password("senha antiga")
    db.flush()
    resposta = client.post("/api/v1/auth/login", json={
        "email": titular.email, "senha": "senha antiga",
    })
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["usuario"]["id"] == titular.id
