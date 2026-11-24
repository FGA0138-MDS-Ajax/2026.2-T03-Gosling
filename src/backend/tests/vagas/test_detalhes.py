import pytest
from sqlalchemy.orm import Session

from app.vagas.models import Vaga
from app.vagas.enums import StatusVaga
from tests.vagas.test_publicacao import autenticar, publicar

pytest_plugins = ["tests.vagas.test_publicacao"]


def test_detalhes_completos_publicos_e_privacidade(client, db, contas, dados_vaga):
    ong = contas["organizacao"]
    ong.telefone = "61999990000"
    ong.responsavel = "Contato reservado"
    ong.cnpj = "12345678000190"
    ong.descricao = "Organização da comunidade."
    db.flush()
    dados_vaga.update(
        fotos=["https://example.com/atividade.webp"],
        documentos_exigidos=[
            {"nome": "Documento de identidade"},
            {"nome": "Termo de adesão", "modelo_url": "https://example.com/termo.pdf"},
        ],
    )
    dados_vaga["ocorrencias"].append(
        {
            "inicio": "2026-11-23T09:00:00-03:00",
            "fim": "2026-11-23T12:00:00-03:00",
        }
    )
    publicado = publicar(client, autenticar(client, contas), dados_vaga)
    db.expire_all()
    resposta = client.get(f"/api/v1/vagas/{publicado['id']}")
    assert resposta.status_code == 200
    vaga = resposta.json()
    assert vaga == publicado
    assert len(vaga["ocorrencias"]) == 2
    assert vaga["ocorrencias"][1]["inicio"] == "2026-11-23T12:00:00Z"
    assert vaga["fotos"] == dados_vaga["fotos"]
    assert len(vaga["documentos_exigidos"]) == 2
    assert set(vaga["organizacao"]) == {"id", "nome", "homologada", "descricao"}
    for reservado in (
        ong.email,
        ong.telefone,
        ong.responsavel,
        ong.cnpj,
        ong.senha_hash,
    ):
        assert reservado not in resposta.text
    with Session(bind=db.get_bind(), join_transaction_mode="create_savepoint") as outra:
        assert (
            outra.get(Vaga, publicado["id"])
            .documentos_exigidos[1]["modelo_url"]
            .endswith("/termo.pdf")
        )


@pytest.mark.parametrize(
    "mudanca", ["suspensa", "encerrada", "inativa", "nao_homologada"]
)
def test_detalhes_ocultam_vaga_indisponivel(client, db, contas, dados_vaga, mudanca):
    publicado = publicar(client, autenticar(client, contas), dados_vaga)
    vaga = db.get(Vaga, publicado["id"])
    if mudanca == "suspensa":
        vaga.status = StatusVaga.SUSPENSA
    elif mudanca == "encerrada":
        vaga.status = StatusVaga.ENCERRADA
    elif mudanca == "inativa":
        vaga.organizacao.ativo = False
    else:
        vaga.organizacao.homologada = False
    db.flush()
    assert client.get(f"/api/v1/vagas/{vaga.id}").status_code == 404
    assert client.get("/api/v1/vagas/99999999").status_code == 404


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("fotos", ["javascript:alert(1)"]),
        ("fotos", ["http://example.com/a.jpg"]),
        ("fotos", ["/etc/passwd"]),
        (
            "documentos_exigidos",
            [{"nome": "Termo", "modelo_url": "javascript:alert(1)"}],
        ),
        ("documentos_exigidos", [{"nome": " "}]),
    ],
)
def test_midias_invalidas_nao_publicam(client, contas, dados_vaga, campo, valor):
    dados_vaga[campo] = valor
    assert (
        client.post(
            "/api/v1/vagas", headers=autenticar(client, contas), json=dados_vaga
        ).status_code
        == 422
    )
    assert client.get("/api/v1/vagas").json()["total"] == 0
