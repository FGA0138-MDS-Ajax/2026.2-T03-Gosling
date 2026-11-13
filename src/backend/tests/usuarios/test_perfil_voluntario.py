import pytest
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.usuarios.models import Voluntario

URL = "/api/v1/voluntarios/me"


def autorizar(conta):
    token = create_access_token(conta.id, conta.perfil.value)
    return {"Authorization": f"Bearer {token}"}


def test_edicao_parcial_limpeza_e_persistencia_em_outra_sessao(client, db, contas):
    titular = contas["voluntario"]
    titular.causas = ["Educação", "Causa anterior"]
    titular.disponibilidades = ["Fins de Semana", "DIA:SABADO"]
    db.flush()
    headers = autorizar(titular)
    resposta = client.put(URL, headers=headers, json={
        "nome_completo": "  Ana Atualizada  ",
        "telefone": "+55 (61) 99999-0000",
        "cidade": "  Brasília  ",
        "estado": "DF",
        "biografia": "  Quero apoiar a comunidade.  ",
    })
    assert resposta.status_code == 200, resposta.text
    perfil = resposta.json()
    assert perfil["nome"] == "Ana Atualizada"
    assert perfil["telefone"] == "61999990000"
    assert perfil["cidade"] == "Brasília"
    assert perfil["biografia"] == "Quero apoiar a comunidade."
    assert perfil["causas"] == ["Educação", "Causa anterior"]
    assert perfil["disponibilidades"] == ["Fins de Semana", "DIA:SABADO"]
    assert resposta.headers["cache-control"] == "no-store"
    with Session(bind=db.get_bind(), join_transaction_mode="create_savepoint") as outra:
        salvo = outra.get(Voluntario, titular.id)
        assert salvo.nome == "Ana Atualizada"
        assert salvo.telefone == "61999990000"

    limpar = dict.fromkeys(("telefone", "cidade", "estado", "biografia"))
    limpar.update(causas=[], disponibilidades=[])
    assert client.put(URL, headers=headers, json=limpar).status_code == 200
    db.expire_all()
    perfil = client.get(URL, headers=headers).json()
    assert all(perfil[campo] is None for campo in limpar if campo not in (
        "causas", "disponibilidades"
    ))
    assert perfil["causas"] == perfil["disponibilidades"] == []
    assert perfil["nome"] == "Ana Atualizada"


@pytest.mark.parametrize("campo,valor", [
    ("email", "outra@example.com"),
    ("identificacao", "11144477735"),
    ("id", 999),
    ("usuario_id", 999),
    ("perfil", "ADMINISTRADOR"),
    ("senha_hash", "hash-injetado"),
    ("password", "OutraSenha123!"),
    ("ativo", False),
])
def test_nao_altera_identidade_credenciais_ou_permissoes(
    client, db, contas, campo, valor
):
    titular = contas["voluntario"]
    headers = autorizar(titular)
    antes = client.get(URL, headers=headers).json()
    hash_anterior = titular.senha_hash
    resposta = client.put(URL, headers=headers, json={
        "nome_completo": "Nome não deve ser salvo", campo: valor,
    })
    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", campo]
    db.expire_all()
    assert client.get(URL, headers=headers).json() == antes
    assert titular.senha_hash == hash_anterior


@pytest.mark.parametrize("campo,valor", [
    ("telefone", "123"),
    ("telefone", "6199999abc00"),
    ("telefone", "9" * 16),
    ("nome_completo", "  "),
    ("cidade", "x" * 101),
    ("biografia", "x" * 501),
    ("estado", "ZZ"),
    ("causas", ["x" * 101]),
    ("disponibilidades", ["x"] * 101),
])
def test_campos_invalidos_nao_gravam_alteracao_parcial(
    client, db, contas, campo, valor
):
    titular = contas["voluntario"]
    headers = autorizar(titular)
    antes = client.get(URL, headers=headers).json()
    resposta = client.put(URL, headers=headers, json={"cidade": "Gama", campo: valor})
    assert resposta.status_code == 422, resposta.text
    assert resposta.json()["detail"][0]["loc"][1] == campo
    db.expire_all()
    assert client.get(URL, headers=headers).json() == antes


@pytest.mark.parametrize("conta", ["organizacao", "administrador", "projeto"])
def test_outros_perfis_nao_consultam_nem_editam(client, contas, conta):
    headers = autorizar(contas[conta])
    assert client.get(URL, headers=headers).status_code == 403
    assert client.put(URL, headers=headers, json={"cidade": "Gama"}).status_code == 403


def test_revalida_conta_desativada_e_nao_expoe_segredos(client, db, contas):
    titular = contas["voluntario"]
    headers = autorizar(titular)
    resposta = client.get(URL, headers=headers)
    assert resposta.status_code == 200
    assert set(resposta.json()) == {
        "id", "nome", "email", "perfil", "tipo", "identificacao", "telefone",
        "cidade", "estado", "biografia", "causas", "disponibilidades",
    }
    titular.ativo = False
    db.flush()
    assert client.get(URL, headers=headers).status_code == 401
    assert client.put(URL, headers=headers, json={"cidade": "Gama"}).status_code == 401
    assert client.get(URL).status_code == 401
    assert client.put(URL, json={}).status_code == 401


@pytest.mark.parametrize("preferencia", [
    "DIA:FERIADO", "DIA:segunda", "DIA:", "DIA", "DIA:SABADO:MANHA",
    "PERIODO:MADRUGADA", "PERIODO:manha", "PERIODO:", "PERIODO",
    "CARGA_HORARIA:999", "CARGA_HORARIA:61", "CARGA_HORARIA:0",
    "CARGA_HORARIA:-1", "CARGA_HORARIA:1.5", "CARGA_HORARIA:abc",
    "CARGA_HORARIA:", "CARGA_HORARIA", "CARGA_HORARIA: 4",
    "CARGA_HORARIA:４", "CARGA_HORARIA:4:6",
])
def test_rejeita_disponibilidade_invalida_sem_salvar_biografia(
    client, db, contas, preferencia
):
    titular = contas["voluntario"]
    titular.biografia = "Biografia anterior."
    titular.disponibilidades = ["DIA:SABADO", "PERIODO:MANHA", "CARGA_HORARIA:4"]
    db.flush()
    headers = autorizar(titular)
    antes = client.get(URL, headers=headers).json()

    resposta = client.put(URL, headers=headers, json={
        "biografia": "Não deve ser salva.",
        "disponibilidades": ["DIA:SABADO", preferencia],
    })

    assert resposta.status_code == 422, resposta.text
    assert resposta.json()["detail"][0]["loc"] == ["body", "disponibilidades", 1]
    db.expire_all()
    assert client.get(URL, headers=headers).json() == antes


@pytest.mark.parametrize("horas", [1, 4, 60])
def test_aceita_dias_periodos_e_limites_da_carga_semanal(
    client, db, contas, horas
):
    titular = contas["voluntario"]
    headers = autorizar(titular)
    preferencias = [
        "DIA:SEGUNDA", "DIA:TERCA", "DIA:QUARTA", "DIA:QUINTA", "DIA:SEXTA",
        "DIA:SABADO", "DIA:DOMINGO", "PERIODO:MANHA", "PERIODO:TARDE",
        "PERIODO:NOITE", f"CARGA_HORARIA:{horas}", "Fins de Semana",
    ]
    resposta = client.put(URL, headers=headers, json={"disponibilidades": preferencias})
    assert resposta.status_code == 200, resposta.text
    db.expire_all()
    assert client.get(URL, headers=headers).json()["disponibilidades"] == preferencias

    # Editar somente a bio não exige reenviar ou apagar as preferências.
    resposta = client.put(URL, headers=headers, json={"biografia": "Nova biografia."})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["biografia"] == "Nova biografia."
    assert resposta.json()["disponibilidades"] == preferencias


def test_rejeita_cargas_semanais_ambiguas(client, db, contas):
    headers = autorizar(contas["voluntario"])
    antes = client.get(URL, headers=headers).json()
    resposta = client.put(URL, headers=headers, json={
        "disponibilidades": ["CARGA_HORARIA:4", "CARGA_HORARIA:6"],
    })
    assert resposta.status_code == 422, resposta.text
    assert resposta.json()["detail"][0]["loc"] == ["body", "disponibilidades"]
    db.expire_all()
    assert client.get(URL, headers=headers).json() == antes
