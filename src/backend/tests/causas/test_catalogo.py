import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.usuarios.catalogos import Causa
from app.usuarios.models import Usuario, Voluntario
from app.vagas.models import Vaga
from tests.vagas.test_publicacao import autenticar

pytest_plugins = ["tests.vagas.test_publicacao"]


def id_causa(db, codigo="educacao"):
    return db.scalar(select(Causa.id).where(Causa.codigo == codigo))


def dados_por_id(db, dados_vaga, identificador=None):
    dados = {
        **dados_vaga,
        "causa_id": id_causa(db) if identificador is None else identificador,
    }
    del dados["causa"]
    return dados


def test_catalogo_publico_usa_os_rotulos_padronizados(client):
    resposta = client.get("/api/v1/causas")
    assert resposta.status_code == 200
    causas = resposta.json()
    assert [c["nome"] for c in causas] == [
        "Meio ambiente",
        "Educação",
        "Alimentação",
        "Proteção animal",
        "Pessoas idosas",
        "Cultura",
        "Saúde",
        "Esporte",
    ]
    assert all(c["ativo"] and c["id"] > 0 and c["codigo"] for c in causas)
    assert len({c["id"] for c in causas}) == len({c["codigo"] for c in causas}) == 8


def test_catalogo_inativo_so_aparece_na_consulta_explicita(client, db):
    anterior = Causa(
        nome="Assistência Social",
        nome_normalizado="assistência social",
        codigo="legado-teste",
        ativo=False,
    )
    db.add(anterior)
    db.flush()
    assert len(client.get("/api/v1/causas").json()) == 8
    itens = client.get("/api/v1/causas?incluir_inativas=true").json()
    assert next(c for c in itens if c["id"] == anterior.id)["ativo"] is False


def test_mesmo_id_em_interesses_publicacao_e_filtro(client, db, contas, dados_vaga):
    identificador = id_causa(db)
    voluntario = autenticar(client, contas, "voluntario")
    perfil = client.put(
        "/api/v1/voluntarios/me",
        headers=voluntario,
        json={"causa_ids": [identificador]},
    )
    assert perfil.status_code == 200
    assert perfil.json()["causa_ids"] == [identificador]
    assert perfil.json()["causas"] == ["Educação"]
    antes = db.scalar(select(func.count()).select_from(Causa))
    publicado = client.post(
        "/api/v1/vagas",
        headers=autenticar(client, contas),
        json=dados_por_id(db, dados_vaga),
    )
    assert publicado.status_code == 201, publicado.text
    assert publicado.json()["causa"]["id"] == identificador
    filtro = client.get("/api/v1/vagas", params={"causa_id": identificador})
    assert filtro.status_code == 200
    assert [vaga["id"] for vaga in filtro.json()["itens"]] == [publicado.json()["id"]]
    assert db.scalar(select(func.count()).select_from(Causa)) == antes


@pytest.mark.parametrize("identificador", [999999, 0, -1, True, "1", None])
def test_publicacao_recusa_id_invalido_sem_registro_parcial(
    client,
    db,
    contas,
    dados_vaga,
    identificador,
):
    dados = dados_por_id(db, dados_vaga)
    dados["causa_id"] = identificador
    resposta = client.post(
        "/api/v1/vagas",
        headers=autenticar(client, contas),
        json=dados,
    )
    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"][:2] == ["body", "causa_id"]
    assert db.scalar(select(func.count()).select_from(Vaga)) == 0
    assert db.scalar(select(func.count()).select_from(Causa)) == 8


def test_id_inativo_nao_publica_nem_altera_perfil_parcialmente(
    client,
    db,
    contas,
    dados_vaga,
):
    causa = db.get(Causa, id_causa(db))
    causa.ativo = False
    db.flush()
    db.commit()
    resposta = client.post(
        "/api/v1/vagas",
        headers=autenticar(client, contas),
        json=dados_por_id(db, dados_vaga),
    )
    assert resposta.status_code == 422
    perfil = client.put(
        "/api/v1/voluntarios/me",
        headers=autenticar(client, contas, "voluntario"),
        json={"nome_completo": "Não deve salvar", "causa_ids": [causa.id]},
    )
    assert perfil.status_code == 422
    db.expire_all()
    assert contas["voluntario"].nome == "Ana"
    assert db.scalar(select(func.count()).select_from(Vaga)) == 0


def test_interesse_inativo_anterior_pode_ser_preservado_ou_removido(client, db, contas):
    identificador = id_causa(db)
    conta = contas["voluntario"]
    conta.causa_ids = [identificador]
    db.get(Causa, identificador).ativo = False
    db.flush()
    headers = autenticar(client, contas, "voluntario")
    assert (
        client.put(
            "/api/v1/voluntarios/me",
            headers=headers,
            json={"causa_ids": [identificador]},
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/v1/voluntarios/me",
            headers=headers,
            json={"causa_ids": []},
        ).json()["causa_ids"]
        == []
    )
    assert (
        client.put(
            "/api/v1/voluntarios/me",
            headers=headers,
            json={"causa_ids": [identificador]},
        ).status_code
        == 422
    )


def test_nomes_legados_usam_aliases_sem_criar_categorias(
    client, db, contas, dados_vaga
):
    publicado = client.post(
        "/api/v1/vagas",
        headers=autenticar(client, contas),
        json={**dados_vaga, "causa": "Animais"},
    )
    assert publicado.status_code == 201
    identificador = id_causa(db, "protecao-animal")
    assert publicado.json()["causa"]["id"] == identificador
    assert publicado.json()["causa"]["nome"] == "Proteção animal"
    perfil = client.put(
        "/api/v1/voluntarios/me",
        headers=autenticar(client, contas, "voluntario"),
        json={"causas": ["Animais"]},
    )
    assert perfil.json()["causa_ids"] == [identificador]
    assert client.get("/api/v1/vagas?causa=Animais").json()["total"] == 1
    assert db.scalar(select(func.count()).select_from(Causa)) == 8


def test_nao_cria_uma_categoria_por_texto_livre(client, db, contas, dados_vaga):
    resposta = client.post(
        "/api/v1/vagas",
        headers=autenticar(client, contas),
        json={**dados_vaga, "causa": "Categoria nova inventada"},
    )
    assert resposta.status_code == 422
    assert resposta.json()["detail"][0]["loc"] == ["body", "causa"]
    assert db.scalar(select(func.count()).select_from(Causa)) == 8


def test_legadas_privadas_sao_preservadas_sem_exposicao_ao_catalogo(
    client,
    db,
    contas,
):
    conta = contas["voluntario"]
    conta.causas = ["Interesse privado anterior", "Animais"]
    db.flush()
    headers = autenticar(client, contas, "voluntario")
    resposta = client.put(
        "/api/v1/voluntarios/me",
        headers=headers,
        json={"causa_ids": [id_causa(db, "protecao-animal")]},
    )
    assert resposta.status_code == 200
    assert resposta.json()["causas_legadas"] == ["Interesse privado anterior"]
    assert (
        "Interesse privado anterior"
        not in client.get("/api/v1/causas?incluir_inativas=true").text
    )
    antes = resposta.json()
    for dados in (
        {"causa_ids": [999999]},
        {"causa_ids": [id_causa(db), id_causa(db)]},
        {"causas_legadas": ["Interesse novo não permitido"]},
        {"causa_ids": [id_causa(db)], "causas": ["Educação"]},
    ):
        assert (
            client.put(
                "/api/v1/voluntarios/me",
                headers=headers,
                json={"biografia": "Não deve gravar", **dados},
            ).status_code
            == 422
        )
        db.expire_all()
        assert client.get("/api/v1/voluntarios/me", headers=headers).json() == antes
    assert (
        client.put(
            "/api/v1/voluntarios/me",
            headers=headers,
            json={"causas_legadas": []},
        ).json()["causas_legadas"]
        == []
    )


@pytest.mark.parametrize("valido", [True, False])
def test_cadastro_usa_ids_e_recusa_invalidos_antes_de_criar_conta(client, db, valido):
    dados = {
        "nome_completo": "Voluntário Catálogo",
        "email": "catalogo@example.com",
        "identificacao": "52998224725",
        "password": "SenhaDeTeste123!",
        "consentimento_termos": True,
        "causa_ids": [id_causa(db) if valido else 999999],
    }
    resposta = client.post("/api/v1/voluntarios", json=dados)
    assert resposta.status_code == (201 if valido else 422)
    if valido:
        conta = db.scalar(select(Voluntario).where(Voluntario.email == dados["email"]))
        assert conta.causa_ids == [id_causa(db)]
    else:
        assert db.scalar(select(func.count()).select_from(Usuario)) == 0


def test_codigo_e_nome_normalizado_continuam_unicos(db):
    for dados in (
        {"nome": "Outro", "nome_normalizado": "outro", "codigo": "educacao"},
        {"nome": "EDUCAÇÃO", "nome_normalizado": "educação", "codigo": "outro"},
    ):
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(Causa(**dados))
            db.flush()


@pytest.mark.parametrize(
    "valor",
    [
        '["Educação", "Interesse privado"]',
        '"Interesse privado"',
        "Interesse privado",
    ],
)
def test_perfis_com_texto_json_anterior_preservam_interesses(client, db, contas, valor):
    conta = contas["voluntario"]
    conta.causas = valor
    db.flush()
    resposta = client.get(
        "/api/v1/voluntarios/me",
        headers=autenticar(client, contas, "voluntario"),
    )
    assert resposta.status_code == 200
    assert "Interesse privado" in resposta.json()["causas_legadas"]
    assert "Interesse privado" not in client.get("/api/v1/causas").text
