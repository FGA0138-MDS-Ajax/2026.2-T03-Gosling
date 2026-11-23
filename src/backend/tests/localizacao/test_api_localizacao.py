import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.localizacao.models import aplicar_localizacao
from app.localizacao.schemas import Localizacao
from app.usuarios.models import Voluntario
from app.vagas.models import Vaga
from tests.usuarios.test_organizacoes import (
    autenticar,
    cadastrar,
    corpo_perfil,
)

pytest_plugins = ["tests.vagas.test_publicacao", "tests.usuarios.test_organizacoes"]

ENDERECO = {
    "cep": "72000-001",
    "logradouro": "Rua da Atividade",
    "numero": "12",
    "complemento": "Sala 2",
    "bairro": "Setor A",
    "regiao_administrativa": "Taguatinga",
    "cidade": "Brasília",
    "estado": "DF",
    "latitude": "-15.8000000",
    "longitude": "-48.1000000",
    "origem_coordenadas": "MANUAL",
}


def headers(conta):
    return {"Authorization": f"Bearer {create_access_token(conta.id, conta.perfil)}"}


def test_cadastro_voluntario_guarda_endereco_sem_inclui_lo_na_sessao_publica(client):
    resposta = client.post(
        "/api/v1/voluntarios",
        json={
            "nome_completo": "Voluntária Localização",
            "email": "local@example.com",
            "identificacao": "52998224725",
            "password": "SenhaDeTeste123!",
            "consentimento_termos": True,
            "localizacao": ENDERECO,
        },
    )
    assert resposta.status_code == 201
    assert "localizacao" not in resposta.json()["usuario"]
    auth = {"Authorization": f"Bearer {resposta.json()['access_token']}"}
    privado = client.get("/api/v1/voluntarios/me", headers=auth)
    assert privado.json()["localizacao"]["cep"] == "72000001"
    assert privado.json()["cidade"] == "Brasília"


def test_administracao_tambem_persiste_endereco_estruturado_da_ong(
    client,
    contas,
    dados,
):
    payload = {k: v for k, v in dados.items() if k != "consentimento_termos"}
    resposta = client.post(
        "/api/v1/admin/usuarios",
        headers=headers(contas["administrador"]),
        json={**payload, "perfil": "ORGANIZACAO", "localizacao": ENDERECO},
    )
    assert resposta.status_code == 201
    privado = client.get(
        "/api/v1/organizacoes/me", headers=autenticar(client, dados["email"])
    )
    assert privado.json()["localizacao"]["numero"] == "12"


def test_ong_persiste_endereco_estruturado_e_preserva_omissao_no_cliente_antigo(
    client,
    db,
    dados,
):
    conta = cadastrar(client, {**dados, "localizacao": ENDERECO})
    auth = autenticar(client, dados["email"])
    assert conta["localizacao"]["cep"] == "72000001"
    db.expunge_all()
    perfil = client.get("/api/v1/organizacoes/me", headers=auth)
    assert perfil.headers["cache-control"] == "no-store"
    assert perfil.json()["localizacao"]["numero"] == "12"
    edicao = corpo_perfil(dados)
    resposta = client.put("/api/v1/organizacoes/me", headers=auth, json=edicao)
    assert resposta.status_code == 200
    assert resposta.json()["localizacao"]["latitude"] == "-15.8000000"
    edicao["endereco"] = "Novo texto de endereço, sem ponto confirmado"
    resposta = client.put("/api/v1/organizacoes/me", headers=auth, json=edicao)
    assert resposta.json()["localizacao"] is None
    assert resposta.json()["endereco"] == edicao["endereco"]


def test_vaga_pode_ter_endereco_proprio_ou_snapshot_da_ong(
    client,
    db,
    contas,
    dados_vaga,
):
    ong = contas["organizacao"]
    aplicar_localizacao(ong, Localizacao(**{**ENDERECO, "numero": "99"}))
    db.flush()
    auth = headers(ong)
    propria = client.post(
        "/api/v1/vagas",
        headers=auth,
        json={
            **dados_vaga,
            "localizacao": ENDERECO,
            "origem_localizacao": "PROPRIA",
        },
    )
    herdada = client.post(
        "/api/v1/vagas",
        headers=auth,
        json={
            **dados_vaga,
            "origem_localizacao": "ORGANIZACAO",
        },
    )
    assert propria.status_code == herdada.status_code == 201
    assert propria.json()["localizacao"]["numero"] == "12"
    assert herdada.json()["localizacao"]["numero"] == "99"
    assert propria.json()["origem_localizacao"] == "PROPRIA"
    assert herdada.json()["origem_localizacao"] == "ORGANIZACAO"
    # Alterar a sede não muda o endereço já anunciado para o encontro.
    ong = db.get(type(ong), ong.id)
    ong.numero = "123"
    db.commit()
    db.expunge_all()
    publica = client.get(f"/api/v1/vagas/{herdada.json()['id']}")
    assert publica.json()["localizacao"]["numero"] == "99"


def test_remoto_e_legado_nao_exigem_endereco_ou_coordenadas(
    client,
    contas,
    dados_vaga,
):
    auth = headers(contas["organizacao"])
    remoto = client.post(
        "/api/v1/vagas",
        headers=auth,
        json={
            **dados_vaga,
            "modalidade": "REMOTO",
            "local": "Encontro online",
        },
    )
    presencial = client.post("/api/v1/vagas", headers=auth, json=dados_vaga)
    assert remoto.status_code == presencial.status_code == 201
    assert remoto.json()["localizacao"] is None
    assert remoto.json()["origem_localizacao"] == "REMOTA"
    assert presencial.json()["localizacao"] is None
    assert presencial.json()["origem_localizacao"] == "LEGADO"


@pytest.mark.parametrize(
    "extra",
    [
        {"localizacao": {"cep": "123"}},
        {"localizacao": {"latitude": 91, "longitude": 0}},
        {"localizacao": {"latitude": 0}},
        {"localizacao": {"estado": "XX"}},
        {"origem_localizacao": "ORGANIZACAO"},
        {"origem_localizacao": "PROPRIA"},
        {"origem_localizacao": "ORGANIZACAO", "localizacao": ENDERECO},
        {"modalidade": "REMOTO", "localizacao": ENDERECO},
        {"modalidade": "REMOTO", "origem_localizacao": "ORGANIZACAO"},
    ],
)
def test_localizacao_invalida_nao_publica_vaga_parcial(
    client,
    db,
    contas,
    dados_vaga,
    extra,
):
    quantidade = db.scalar(select(func.count()).select_from(Vaga))
    resposta = client.post(
        "/api/v1/vagas",
        headers=headers(contas["organizacao"]),
        json={**dados_vaga, **extra},
    )
    assert resposta.status_code == 422
    assert db.scalar(select(func.count()).select_from(Vaga)) == quantidade


def test_localizacao_residencial_e_privada_e_persistida_no_perfil_do_titular(
    client,
    db,
    contas,
    dados_vaga,
    senha_hash,
):
    auth = headers(contas["voluntario"])
    auth_ong = headers(contas["organizacao"])
    resposta = client.put(
        "/api/v1/voluntarios/me", headers=auth, json={"localizacao": ENDERECO}
    )
    assert resposta.status_code == 200
    assert resposta.headers["cache-control"] == "no-store"
    assert resposta.json()["cidade"] == "Brasília"
    db.expunge_all()
    consulta = client.get("/api/v1/voluntarios/me", headers=auth)
    assert consulta.json()["localizacao"]["logradouro"] == ENDERECO["logradouro"]
    assert consulta.headers["cache-control"] == "no-store"
    outra = Voluntario(
        nome="Outra", email="outra-local@example.com", senha_hash=senha_hash
    )
    db.add(outra)
    db.flush()
    assert (
        client.get("/api/v1/voluntarios/me", headers=headers(outra)).json()[
            "localizacao"
        ]
        is None
    )
    assert "localizacao" not in client.get("/api/v1/auth/me", headers=auth).json()
    publicada = client.post("/api/v1/vagas", json=dados_vaga, headers=auth_ong)
    assert publicada.status_code == 201
    assert publicada.json()["localizacao"] is None
    assert publicada.json()["organizacao"].keys() == {
        "id",
        "nome",
        "homologada",
        "descricao",
    }


def test_edicao_invalida_nao_muda_endereco_e_cliente_antigo_invalida_ponto(
    client,
    db,
    contas,
):
    auth = headers(contas["voluntario"])
    assert (
        client.put(
            "/api/v1/voluntarios/me", headers=auth, json={"localizacao": ENDERECO}
        ).status_code
        == 200
    )
    erro = client.put(
        "/api/v1/voluntarios/me",
        headers=auth,
        json={
            "localizacao": {**ENDERECO, "numero": "999"},
            "causa_ids": [999999],
        },
    )
    assert erro.status_code == 422
    db.expire_all()
    atual = client.get("/api/v1/voluntarios/me", headers=auth).json()
    assert atual["localizacao"]["numero"] == "12"
    alterada = client.put(
        "/api/v1/voluntarios/me", headers=auth, json={"cidade": "Ceilândia"}
    )
    assert alterada.status_code == 200
    assert alterada.json()["localizacao"]["latitude"] is None
    assert alterada.json()["estado"] == "DF"
    assert alterada.json()["localizacao"]["logradouro"] is None
    removida = client.put(
        "/api/v1/voluntarios/me", headers=auth, json={"localizacao": None}
    )
    assert removida.status_code == 200
    assert removida.json()["localizacao"] is None


def test_regioes_contraditorias_sao_recusadas_antes_de_alterar_perfil(client, contas):
    resposta = client.put(
        "/api/v1/voluntarios/me",
        headers=headers(contas["voluntario"]),
        json={
            "cidade": "Outra cidade",
            "localizacao": ENDERECO,
        },
    )
    assert resposta.status_code == 422
