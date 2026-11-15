import pytest
from sqlalchemy import func, select

from app.core.security import verify_password
from app.usuarios.enums import Perfil
from app.usuarios.models import Organizacao, Usuario
from app.vagas.models import OcorrenciaVaga, Vaga


@pytest.fixture
def dados_conta():
    return {
        "nome": "Conta de apresentação",
        "email": "nova@example.com",
        "senha": "SenhaNova123!",
        "perfil": "VOLUNTARIO",
    }


@pytest.fixture
def dados_ong():
    return {
        "nome": "Instituto Apresentação", "email": "nova-ong@example.com",
        "senha": "SenhaNova123!", "perfil": "ORGANIZACAO",
        "razao_social": "Instituto Apresentação de Apoio Social",
        "cnpj": "11.222.333/0001-81", "area_atuacao": "Educação",
        "endereco": "Rua Exemplo, 100, Brasília", "responsavel": "Maria da Silva",
        "telefone": "(61) 99999-9999", "descricao": "Apoio à comunidade.",
    }


def autenticar(client, contas, conta="administrador"):
    resposta = client.post(
        "/api/v1/admin/login" if conta == "administrador" else "/api/v1/auth/login",
        json={"email": contas[conta].email, "senha": "SenhaDeTeste123!"},
    )
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def criar(client, headers, dados):
    resposta = client.post("/api/v1/admin/usuarios", headers=headers, json=dados)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def total(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_entrada_propria_autentica_admin_e_omite_credenciais(client, contas):
    resposta = client.post(
        "/api/v1/admin/login",
        json={"email": contas["administrador"].email, "senha": "SenhaDeTeste123!"},
    )
    assert resposta.status_code == 200, resposta.text
    dados = resposta.json()
    assert dados["usuario"]["perfil"] == "ADMINISTRADOR"
    assert "senha" not in dados["usuario"]
    assert "senha_hash" not in dados["usuario"]
    assert resposta.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("conta", ["voluntario", "organizacao", "projeto"])
def test_login_administrativo_recusa_outros_perfis(client, contas, conta):
    resposta = client.post(
        "/api/v1/admin/login",
        json={"email": contas[conta].email, "senha": "SenhaDeTeste123!"},
    )
    assert resposta.status_code == 403
    assert "access_token" not in resposta.json()


def test_login_administrativo_recusa_senha_errada(client, contas):
    resposta = client.post(
        "/api/v1/admin/login",
        json={"email": contas["administrador"].email, "senha": "incorreta"},
    )
    assert resposta.status_code == 401
    assert "access_token" not in resposta.json()


@pytest.mark.parametrize("metodo", ["GET", "POST", "DELETE"])
def test_operacoes_sem_token_sao_negadas(client, dados_conta, metodo):
    caminho = "/api/v1/admin/usuarios"
    if metodo == "DELETE":
        caminho += "/999"
    resposta = client.request(metodo, caminho, json=dados_conta)
    assert resposta.status_code == 401


@pytest.mark.parametrize("conta", ["voluntario", "organizacao", "projeto"])
@pytest.mark.parametrize("metodo", ["GET", "POST", "DELETE"])
def test_outros_perfis_nao_gerenciam_cadastros(
    client, contas, dados_conta, conta, metodo
):
    headers = autenticar(client, contas, conta)
    caminho = "/api/v1/admin/usuarios"
    if metodo == "DELETE":
        caminho += f"/{contas['voluntario'].id}"
    resposta = client.request(metodo, caminho, headers=headers, json=dados_conta)
    assert resposta.status_code == 403


def test_lista_busca_paginacao_e_detalhes(client, contas):
    headers = autenticar(client, contas)
    resposta = client.get("/api/v1/admin/usuarios", headers=headers)
    assert resposta.status_code == 200
    assert resposta.json()["total"] == 5
    for item in resposta.json()["itens"]:
        assert "senha" not in item
        assert "senha_hash" not in item
    filtro = client.get(
        "/api/v1/admin/usuarios?perfil=ORGANIZACAO&busca=ONG",
        headers=headers,
    )
    assert filtro.json()["total"] == 1
    inativos = client.get("/api/v1/admin/usuarios?ativo=false", headers=headers)
    assert inativos.json()["total"] == 1
    pagina = client.get(
        "/api/v1/admin/usuarios?pagina=2&por_pagina=2", headers=headers
    )
    assert len(pagina.json()["itens"]) == 2
    detalhe = client.get(
        f"/api/v1/admin/usuarios/{contas['organizacao'].id}", headers=headers
    )
    assert detalhe.status_code == 200
    assert detalhe.json()["tipo"] == "ONG"
    assert client.get(
        "/api/v1/admin/usuarios/999999", headers=headers
    ).status_code == 404


@pytest.mark.parametrize("perfil", ["VOLUNTARIO", "ADMINISTRADOR"])
def test_admin_cria_conta_que_funciona_no_login(
    client, db, contas, dados_conta, perfil
):
    headers = autenticar(client, contas)
    conta = criar(client, headers, {**dados_conta, "perfil": perfil})
    db.expire_all()
    salvo = db.get(Usuario, conta["id"])
    assert salvo.perfil.value == perfil
    assert salvo.senha_hash.startswith("$argon2")
    assert verify_password(dados_conta["senha"], salvo.senha_hash)
    assert "senha" not in conta
    assert "senha_hash" not in conta
    login = client.post(
        "/api/v1/auth/login",
        json={"email": conta["email"], "senha": dados_conta["senha"]},
    )
    assert login.status_code == 200
    assert login.json()["usuario"]["perfil"] == perfil


def test_admin_cria_ong_com_dados_institucionais(client, db, contas, dados_ong):
    headers = autenticar(client, contas)
    conta = criar(client, headers, dados_ong)
    db.expire_all()
    salvo = db.get(Organizacao, conta["id"])
    assert salvo.cnpj == "11222333000181"
    assert salvo.telefone == "61999999999"
    assert salvo.homologada is True
    assert salvo.consentimento_termos is False
    assert conta["tipo"] == "ONG"
    assert conta["razao_social"] == dados_ong["razao_social"]


def test_validacao_e_duplicidade_sem_expor_senha(
    client, db, contas, dados_conta, dados_ong
):
    headers = autenticar(client, contas)
    criar(client, headers, dados_ong)
    antes = total(db, Usuario)
    for body in (
        {**dados_conta, "email": dados_ong["email"]},
        {**dados_ong, "email": "outra@example.com"},
    ):
        resposta = client.post(
            "/api/v1/admin/usuarios", headers=headers, json=body
        )
        assert resposta.status_code == 409
        assert total(db, Usuario) == antes
    invalida = client.post(
        "/api/v1/admin/usuarios", headers=headers,
        json={**dados_conta, "senha": "curta"},
    )
    assert invalida.status_code == 422
    assert "curta" not in invalida.text
    assert total(db, Usuario) == antes


def test_exclusao_nao_permite_remover_a_propria_conta(client, contas):
    headers = autenticar(client, contas)
    resposta = client.delete(
        f"/api/v1/admin/usuarios/{contas['administrador'].id}",
        headers=headers,
    )
    assert resposta.status_code == 409
    assert client.get("/api/v1/admin/usuarios", headers=headers).status_code == 200


def test_exclusao_revoga_acesso_e_preserva_outros_cadastros(
    client, db, contas, dados_conta
):
    headers = autenticar(client, contas)
    conta = criar(client, headers, dados_conta)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": conta["email"], "senha": dados_conta["senha"]},
    ).json()
    resposta = client.delete(
        f"/api/v1/admin/usuarios/{conta['id']}", headers=headers
    )
    assert resposta.status_code == 204
    db.expire_all()
    assert db.get(Usuario, conta["id"]) is None
    assert db.get(Usuario, contas["organizacao"].id) is not None
    assert client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login['access_token']}"},
    ).status_code == 401


def test_exclusao_de_ong_exige_confirmacao_e_remove_vagas_e_encontros(
    client, db, contas, dados_ong
):
    headers = autenticar(client, contas)
    ong = criar(client, headers, dados_ong)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": dados_ong["email"], "senha": dados_ong["senha"]},
    ).json()
    vaga = client.post(
        "/api/v1/vagas",
        headers={"Authorization": f"Bearer {login['access_token']}"},
        json={
            "titulo": "Oficina de leitura", "descricao": "Leitura com a comunidade.",
            "atividades": "Organizar livros e apoiar a leitura.", "causa": "Educação",
            "modalidade": "PRESENCIAL", "local": "Brasília, DF",
            "periodo": "MANHA", "carga_horaria": 3, "numero_vagas": 10,
            "ocorrencias": [{
                "inicio": "2026-11-16T12:00:00Z",
                "fim": "2026-11-16T15:00:00Z",
            }],
        },
    )
    assert vaga.status_code == 201, vaga.text
    detalhe = client.get(
        f"/api/v1/admin/usuarios/{ong['id']}", headers=headers
    )
    assert detalhe.json()["quantidade_vagas"] == 1
    caminho = f"/api/v1/admin/usuarios/{ong['id']}"
    assert client.delete(caminho, headers=headers).status_code == 409
    assert total(db, Vaga) == 1
    assert client.delete(
        caminho + "?excluir_vagas=true", headers=headers
    ).status_code == 204
    db.expire_all()
    assert total(db, Vaga) == 0
    assert total(db, OcorrenciaVaga) == 0
    assert db.get(Usuario, ong["id"]) is None


def test_outro_admin_pode_ser_excluido_sem_remover_o_admin_atual(
    client, db, contas, dados_conta
):
    headers = autenticar(client, contas)
    outro = criar(client, headers, {**dados_conta, "perfil": "ADMINISTRADOR"})
    assert client.delete(
        f"/api/v1/admin/usuarios/{outro['id']}", headers=headers
    ).status_code == 204
    assert total(db, Usuario) == 5
    assert db.get(Usuario, contas["administrador"].id).perfil == Perfil.ADMINISTRADOR
