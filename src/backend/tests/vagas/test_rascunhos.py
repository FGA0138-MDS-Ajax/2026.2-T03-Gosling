import pytest
from sqlalchemy import select

from app.candidaturas.models import Candidatura
from app.core.security import create_access_token
from app.usuarios.catalogos import Causa
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga

pytest_plugins = ["tests.vagas.test_publicacao"]

VAGAS = "/api/v1/vagas"
RASCUNHOS = f"{VAGAS}/rascunhos"
PAINEL = "/api/v1/organizacoes/me/vagas"


def autorizar(conta):
    token = create_access_token(conta.id, conta.perfil)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers(contas):
    return autorizar(contas["organizacao"])


@pytest.fixture
def dados_completos(db, dados_vaga):
    id_causa = db.scalar(select(Causa.id).where(Causa.codigo == "educacao"))
    return {
        **{chave: valor for chave, valor in dados_vaga.items() if chave != "causa"},
        "causa_id": id_causa,
        "ocorrencias": [
            {
                "data_inicio": "2099-11-16",
                "hora_inicio": "09:00",
                "data_fim": "2099-11-16",
                "hora_fim": "12:00",
            }
        ],
    }


def criar(client, headers, dados):
    resposta = client.post(RASCUNHOS, headers=headers, json=dados)
    assert resposta.status_code == 201, resposta.text
    assert resposta.headers["cache-control"] == "no-store"
    return resposta.json()


def test_salva_parcialmente_e_retem_campos_nao_enviados(client, db, headers):
    dados = {
        "titulo": "Incompleta",
        "ocorrencias": [{"data_inicio": "2099-11-16"}],
        "fotos": ["https://example.com/foto.webp"],
        "documentos_exigidos": [{"nome": "", "modelo_url": "https://"}],
    }
    rascunho = criar(client, headers, dados)
    assert rascunho["status"] == "RASCUNHO"
    assert rascunho["versao"] == 1
    assert rascunho["atualizado_em"]
    url = f"{RASCUNHOS}/{rascunho['id']}"
    assert client.get(f"{VAGAS}/{rascunho['id']}").status_code == 404
    assert client.get(VAGAS).json()["total"] == 0

    atualizacao = client.patch(
        url,
        headers=headers,
        json={
            "versao": 1,
            "dados": {"local": "Centro da comunidade"},
        },
    )
    assert atualizacao.status_code == 200
    db.expunge_all()
    salvo = client.get(url, headers=headers).json()
    assert salvo["versao"] == 2
    assert salvo["dados"]["titulo"] == "Incompleta"
    assert salvo["dados"]["local"] == "Centro da comunidade"
    assert salvo["dados"]["ocorrencias"][0]["data_inicio"] == "2099-11-16"
    assert salvo["dados"]["fotos"] == dados["fotos"]
    assert salvo["dados"]["documentos_exigidos"] == dados["documentos_exigidos"]


def test_uma_aba_desatualizada_nao_sobrescreve_nem_publica(client, headers):
    rascunho = criar(client, headers, {"titulo": "Primeira versão"})
    url = f"{RASCUNHOS}/{rascunho['id']}"
    edicao = client.patch(
        url,
        headers=headers,
        json={
            "versao": 1,
            "dados": {"titulo": "Salvo pela segunda aba"},
        },
    )
    assert edicao.status_code == 200
    for caminho, metodo, dados in (
        (url, client.patch, {"versao": 1, "dados": {"titulo": "Perderia alteração"}}),
        (f"{url}/publicar", client.post, {"versao": 1}),
    ):
        assert metodo(caminho, headers=headers, json=dados).status_code == 409
    assert client.get(url, headers=headers).json()["dados"]["titulo"] == (
        "Salvo pela segunda aba"
    )


def test_reusa_o_mesmo_id_ao_publicar_e_converte_encontros_para_utc(
    client,
    db,
    headers,
    dados_completos,
):
    rascunho = criar(client, headers, {"titulo": "Primeira versão"})
    vaga_id = rascunho["id"]
    url = f"{RASCUNHOS}/{vaga_id}"
    resposta = client.post(
        f"{url}/publicar",
        headers=headers,
        json={
            "versao": 1,
            "dados": dados_completos,
        },
    )
    assert resposta.status_code == 200, resposta.text
    vaga = resposta.json()
    assert (vaga["id"], vaga["status"]) == (vaga_id, "ABERTA")
    assert vaga["ocorrencias"][0]["inicio"] == "2099-11-16T12:00:00Z"
    assert client.get(f"{VAGAS}/{vaga_id}").json() == vaga
    assert client.get(url, headers=headers).status_code == 404
    db.expire_all()
    assert db.get(Vaga, vaga_id).rascunho is None


@pytest.mark.parametrize(
    "alteracao",
    [
        {"titulo": None},
        {"causa_id": 999999},
        {"documentos_exigidos": [{"nome": ""}]},
        {"ocorrencias": [{"data_inicio": "2099-11-16"}]},
        {"fotos": ["/api/v1/midia/1234567890abcdef1234567890abcdef.webp"]},
    ],
)
def test_publicacao_com_erro_preserva_versao_e_dados_salvos(
    client,
    headers,
    dados_completos,
    alteracao,
):
    rascunho = criar(client, headers, {"titulo": "Dados salvos"})
    url = f"{RASCUNHOS}/{rascunho['id']}"
    antes = client.get(url, headers=headers).json()
    resposta = client.post(
        f"{url}/publicar",
        headers=headers,
        json={
            "versao": 1,
            "dados": {**dados_completos, **alteracao},
        },
    )
    assert resposta.status_code == 422, resposta.text
    depois = client.get(url, headers=headers).json()
    assert depois == antes
    assert client.get(VAGAS).json()["total"] == 0


def test_somente_a_ong_dona_consulta_edita_e_publica(client, headers, contas):
    vaga_id = criar(client, headers, {})["id"]
    url = f"{RASCUNHOS}/{vaga_id}"
    outra = autorizar(contas["projeto"])
    assert client.get(url).status_code == 401
    assert client.get(url, headers=autorizar(contas["voluntario"])).status_code == 403
    assert client.get(url, headers=outra).status_code == 404
    assert (
        client.patch(url, headers=outra, json={"versao": 1, "dados": {}}).status_code
        == 404
    )
    assert (
        client.post(f"{url}/publicar", headers=outra, json={"versao": 1}).status_code
        == 404
    )
    assert (
        client.put(
            f"{VAGAS}/{vaga_id}", headers=headers, json={"titulo": "Nova"}
        ).status_code
        == 409
    )


def test_homologacao_da_ong_e_exigida_na_publicacao(
    client,
    db,
    contas,
    headers,
    dados_completos,
):
    contas["organizacao"].homologada = False
    db.flush()
    rascunho = criar(client, headers, dados_completos)
    url = f"{RASCUNHOS}/{rascunho['id']}"
    resposta = client.post(f"{url}/publicar", headers=headers, json={"versao": 1})
    assert resposta.status_code == 403
    assert client.get(url, headers=headers).json()["versao"] == 1
    assert client.get(VAGAS).json()["total"] == 0


def test_painel_lista_por_estado_pagina_e_organizacao_no_banco(
    client,
    db,
    contas,
    headers,
    dados_completos,
):
    rascunho = criar(client, headers, {"titulo": "Rascunho próprio"})
    criar(client, headers, {})
    outro = Vaga(status=StatusVaga.RASCUNHO, organizacao=contas["projeto"])
    db.add(outro)
    db.flush()

    paginados = client.get(
        f"{PAINEL}?status=RASCUNHO&tamanho_pagina=1&pagina=2",
        headers=headers,
    )
    assert paginados.status_code == 200
    assert paginados.headers["cache-control"] == "no-store"
    dados = paginados.json()
    assert dados["total_itens"] == dados["total_paginas"] == 2
    assert [vaga["id"] for vaga in dados["itens"]] == [str(rascunho["id"])]
    assert dados["itens"][0]["atualizado_em"]
    assert client.get(PAINEL, headers=headers).json()["itens"] == []

    publicada = client.post(
        f"{RASCUNHOS}/{rascunho['id']}/publicar",
        headers=headers,
        json={"versao": 1, "dados": dados_completos},
    )
    assert publicada.status_code == 200, publicada.text
    db.add(Candidatura(voluntario_id=contas["voluntario"].id, vaga_id=rascunho["id"]))
    db.flush()

    instituicao = client.get(PAINEL, headers=headers).json()
    assert instituicao["total_itens"] == 1
    vaga = instituicao["itens"][0]
    assert vaga["id"] == str(rascunho["id"])
    assert vaga["estado_vaga"] == "ABERTA"
    assert vaga["total_candidaturas"] == 1
    assert vaga["local"] == dados_completos["local"]
