import pytest
from sqlalchemy import func, select

from app.candidaturas.models import Candidatura
from app.favoritos.models import VagaSalva
from app.usuarios.models import Voluntario
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga
from tests.vagas.test_publicacao import autenticar, publicar

pytest_plugins = ["tests.vagas.test_publicacao"]
URL = "/api/v1/voluntarios/me/vagas-salvas"


@pytest.fixture
def vaga(client, contas, dados_vaga):
    return publicar(client, autenticar(client, contas), dados_vaga)


def salvar(client, contas, vaga_id):
    return client.put(
        f"{URL}/{vaga_id}",
        headers=autenticar(client, contas, "voluntario"),
    )


def listar(client, contas, conta="voluntario"):
    return client.get(URL, headers=autenticar(client, contas, conta))


def test_salvar_e_remover_sao_idempotentes_e_nao_criam_candidatura(
    client,
    db,
    contas,
    vaga,
):
    assert listar(client, contas).json() == {"vaga_ids": []}
    for _ in range(2):
        resposta = salvar(client, contas, vaga["id"])
        assert resposta.status_code == 204
        assert resposta.content == b""
        assert resposta.headers["cache-control"] == "no-store"
    db.expire_all()
    resposta = listar(client, contas)
    assert resposta.json() == {"vaga_ids": [vaga["id"]]}
    assert resposta.headers["cache-control"] == "no-store"
    assert db.scalar(select(func.count()).select_from(VagaSalva)) == 1
    assert db.scalar(select(func.count()).select_from(Candidatura)) == 0
    assert db.get(Vaga, vaga["id"]).numero_vagas == vaga["numero_vagas"]

    for _ in range(2):
        resposta = client.delete(
            f"{URL}/{vaga['id']}",
            headers=autenticar(client, contas, "voluntario"),
        )
        assert resposta.status_code == 204
    assert listar(client, contas).json() == {"vaga_ids": []}


def test_isola_duas_contas_inclusive_na_remocao(
    client,
    db,
    contas,
    vaga,
    senha_hash,
):
    outra = Voluntario(nome="Outra", email="outra@example.com", senha_hash=senha_hash)
    db.add(outra)
    db.flush()
    contas["outra"] = outra
    assert salvar(client, contas, vaga["id"]).status_code == 204
    assert listar(client, contas, "outra").json() == {"vaga_ids": []}
    assert (
        client.delete(
            f"{URL}/{vaga['id']}",
            headers=autenticar(client, contas, "outra"),
        ).status_code
        == 204
    )
    assert listar(client, contas).json() == {"vaga_ids": [vaga["id"]]}
    assert (
        client.put(
            f"{URL}/{vaga['id']}",
            headers=autenticar(client, contas, "outra"),
        ).status_code
        == 204
    )
    assert db.scalar(select(func.count()).select_from(VagaSalva)) == 2


@pytest.mark.parametrize("status", [StatusVaga.ENCERRADA, StatusVaga.SUSPENSA])
def test_oculta_vaga_indisponivel_preserva_vinculo_e_permite_remover(
    client,
    db,
    contas,
    vaga,
    status,
):
    assert salvar(client, contas, vaga["id"]).status_code == 204
    registro = db.get(Vaga, vaga["id"])
    registro.status = status
    db.flush()
    assert listar(client, contas).json() == {"vaga_ids": []}
    assert salvar(client, contas, vaga["id"]).status_code == 404
    assert db.scalar(select(func.count()).select_from(VagaSalva)) == 1
    assert (
        client.delete(
            f"{URL}/{vaga['id']}",
            headers=autenticar(client, contas, "voluntario"),
        ).status_code
        == 204
    )
    registro.status = StatusVaga.ABERTA
    db.flush()
    assert listar(client, contas).json() == {"vaga_ids": []}


@pytest.mark.parametrize("campo", ["ativo", "homologada"])
def test_oculta_vaga_de_organizacao_sem_visibilidade(
    client,
    db,
    contas,
    vaga,
    campo,
):
    assert salvar(client, contas, vaga["id"]).status_code == 204
    setattr(contas["organizacao"], campo, False)
    db.flush()
    assert listar(client, contas).json() == {"vaga_ids": []}
    assert salvar(client, contas, vaga["id"]).status_code == 404


def test_vaga_excluida_remove_vinculos(client, db, contas, vaga):
    assert salvar(client, contas, vaga["id"]).status_code == 204
    db.delete(db.get(Vaga, vaga["id"]))
    db.flush()
    assert listar(client, contas).json() == {"vaga_ids": []}
    assert db.scalar(select(func.count()).select_from(VagaSalva)) == 0


def test_vaga_inexistente_nao_cria_salvo(client, db, contas):
    assert salvar(client, contas, 999999).status_code == 404
    assert db.scalar(select(func.count()).select_from(VagaSalva)) == 0


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_exige_sessao(client, method):
    destino = URL if method == "get" else f"{URL}/1"
    assert getattr(client, method)(destino).status_code == 401


@pytest.mark.parametrize("conta", ["organizacao", "administrador", "projeto"])
@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_exige_voluntario(client, contas, conta, method):
    destino = URL if method == "get" else f"{URL}/1"
    assert (
        getattr(client, method)(
            destino,
            headers=autenticar(client, contas, conta),
        ).status_code
        == 403
    )


@pytest.mark.parametrize("method", ["put", "delete"])
def test_recusa_titular_no_corpo_e_na_query(client, contas, vaga, method):
    headers = autenticar(client, contas, "voluntario")
    destino = f"{URL}/{vaga['id']}"
    assert (
        client.request(
            method,
            destino,
            headers=headers,
            json={"voluntario_id": 999},
        ).status_code
        == 422
    )
    assert (
        client.request(
            method,
            destino,
            headers=headers,
            params={"voluntario_id": 999},
        ).status_code
        == 422
    )
    assert listar(client, contas).json() == {"vaga_ids": []}


def test_recusa_titular_na_listagem(client, contas):
    assert (
        client.get(
            URL,
            params={"voluntario_id": 999},
            headers=autenticar(client, contas, "voluntario"),
        ).status_code
        == 422
    )


def test_falha_ao_confirmar_nao_deixa_salvo(client, db, contas, vaga, monkeypatch):
    def falhar():
        raise RuntimeError("Falha simulada na confirmação")

    monkeypatch.setattr(db, "commit", falhar)
    with pytest.raises(RuntimeError, match="Falha simulada"):
        salvar(client, contas, vaga["id"])
    assert db.scalar(select(func.count()).select_from(VagaSalva)) == 0
