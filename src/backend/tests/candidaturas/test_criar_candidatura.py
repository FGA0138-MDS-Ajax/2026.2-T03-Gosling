from datetime import UTC, datetime, timedelta
from io import BytesIO
from unittest.mock import MagicMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy import func, select, text

from app.candidaturas.models import Candidatura, DocumentoCandidatura
from app.candidaturas.router import get_candidatura_service

SENHA = "SenhaDeTeste123!"


def endpoint_candidatura(vaga_id: int) -> str:
    return f"/api/v1/vagas/{vaga_id}/candidaturas"


def autenticar(client: TestClient, email: str) -> dict:
    resposta = client.post("/api/v1/auth/login", json={"email": email, "senha": SENHA})
    assert resposta.status_code == status.HTTP_200_OK, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}


def payload_vaga() -> dict:
    inicio = datetime.now(UTC).replace(microsecond=0) + timedelta(days=30)
    return {
        "titulo": "Vaga para candidatura",
        "descricao": "Vaga criada pelo teste de candidatura",
        "atividades": "Atividades de apoio realizadas pelo voluntário",
        "causa": "Educação",
        "modalidade": "PRESENCIAL",
        "local": "Brasília - DF",
        "periodo": "MANHA",
        "carga_horaria": 4,
        "numero_vagas": 3,
        "ocorrencias": [
            {
                "inicio": inicio.isoformat(),
                "fim": (inicio + timedelta(hours=4)).isoformat(),
            }
        ],
    }


def criar_vaga(client: TestClient, headers: dict, **campos) -> int:
    resposta = client.post(
        "/api/v1/vagas", json=payload_vaga() | campos, headers=headers
    )
    assert resposta.status_code in (200, 201), resposta.text
    return int(resposta.json()["id"])


@pytest.fixture
def headers_voluntario(client, contas) -> dict:
    return autenticar(client, "voluntario@example.com")


@pytest.fixture
def headers_ong(client, contas) -> dict:
    return autenticar(client, "ong@example.com")


@pytest.fixture
def vaga_aberta_id(client, headers_ong, db) -> int:
    vaga_id = criar_vaga(client, headers_ong)
    db.execute(
        text("UPDATE vagas SET status = 'ABERTA' WHERE id = :id"),
        {"id": vaga_id},
    )
    db.commit()
    return vaga_id


@pytest.fixture
def vaga_encerrada_id(client, headers_ong, db) -> int:
    vaga_id = criar_vaga(client, headers_ong)
    db.execute(
        text("UPDATE vagas SET status = 'ENCERRADA' WHERE id = :id"),
        {"id": vaga_id},
    )
    db.commit()
    return vaga_id


def test_candidatura_sucesso_retorna_201(
    client: TestClient,
    headers_voluntario: dict,
    vaga_aberta_id: int,
):
    vaga = client.get(f"/api/v1/vagas/{vaga_aberta_id}")
    assert vaga.json()["candidaturas_disponiveis"] is True

    resposta = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_voluntario,
    )

    assert resposta.status_code == status.HTTP_201_CREATED, resposta.text

    dados = resposta.json()

    assert dados["vaga_id"] == vaga_aberta_id
    assert dados["status"] == "PENDENTE"
    assert dados["comprovante"]["codigo"]


def test_rejeitar_candidatura_duplicada_retorna_409(
    client: TestClient,
    headers_voluntario: dict,
    vaga_aberta_id: int,
):
    res_primeira = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_voluntario,
    )

    assert res_primeira.status_code == status.HTTP_201_CREATED, res_primeira.text

    res_segunda = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_voluntario,
    )

    assert res_segunda.status_code == status.HTTP_409_CONFLICT
    erro = res_segunda.json()["detail"]
    assert erro["codigo"] == "CANDIDATURA_DUPLICADA"
    assert "já possui uma candidatura" in erro["mensagem"]


def test_rejeitar_candidatura_em_vaga_encerrada_retorna_400(
    client: TestClient,
    headers_voluntario: dict,
    vaga_encerrada_id: int,
):
    resposta = client.post(
        endpoint_candidatura(vaga_encerrada_id),
        headers=headers_voluntario,
    )

    assert resposta.status_code == status.HTTP_400_BAD_REQUEST
    assert "não está no estado ABERTA" in resposta.json()["detail"]


def test_candidatura_em_vaga_inexistente_retorna_404(
    client: TestClient,
    headers_voluntario: dict,
):
    vaga_inexistente_id = 999999

    resposta = client.post(
        endpoint_candidatura(vaga_inexistente_id),
        headers=headers_voluntario,
    )

    assert resposta.status_code == status.HTTP_404_NOT_FOUND
    assert "Vaga não encontrada" in resposta.json()["detail"]


def test_organizacao_nao_pode_se_candidatar_retorna_403(
    client: TestClient,
    headers_ong: dict,
    vaga_aberta_id: int,
):
    resposta = client.post(
        endpoint_candidatura(vaga_aberta_id),
        headers=headers_ong,
    )

    assert resposta.status_code == status.HTTP_403_FORBIDDEN


def test_candidatura_sem_token_retorna_401(
    client: TestClient,
    vaga_aberta_id: int,
):
    resposta = client.post(endpoint_candidatura(vaga_aberta_id))

    assert resposta.status_code == status.HTTP_401_UNAUTHORIZED


def test_falha_inesperada_no_servico_retorna_500(
    client: TestClient,
    headers_voluntario: dict,
    vaga_aberta_id: int,
):
    service_mock = MagicMock()
    service_mock.candidatar.side_effect = Exception(
        "Erro de conexão com o banco de dados"
    )
    client.app.dependency_overrides[get_candidatura_service] = lambda: service_mock

    try:
        with TestClient(client.app, raise_server_exceptions=False) as cliente_500:
            resposta = cliente_500.post(
                endpoint_candidatura(vaga_aberta_id),
                headers=headers_voluntario,
            )
    finally:
        client.app.dependency_overrides.pop(get_candidatura_service, None)

    assert resposta.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


def test_conflito_na_segunda_ocorrencia_e_horarios_consecutivos(
    client, db, headers_voluntario, headers_ong
):
    inicio = datetime.now(UTC).replace(microsecond=0) + timedelta(days=7)

    def encontro(de, ate):
        return {
            "inicio": (inicio + timedelta(hours=de)).isoformat(),
            "fim": (inicio + timedelta(hours=ate)).isoformat(),
        }

    primeira = criar_vaga(client, headers_ong, ocorrencias=[encontro(1, 3)])
    assert (
        client.post(
            endpoint_candidatura(primeira), headers=headers_voluntario
        ).status_code
        == 201
    )
    bloqueada = criar_vaga(
        client, headers_ong, ocorrencias=[encontro(0, 1), encontro(2, 4)]
    )
    conflito = client.post(endpoint_candidatura(bloqueada), headers=headers_voluntario)
    assert conflito.status_code == 409
    erro = conflito.json()["detail"]
    assert erro["codigo"] == "CONFLITO_HORARIO"
    assert erro["conflitos"] == [
        {
            "vaga_id": primeira,
            "titulo_vaga": "Vaga para candidatura",
            "inicio": encontro(1, 3)["inicio"].replace("+00:00", "Z"),
            "fim": encontro(1, 3)["fim"].replace("+00:00", "Z"),
        }
    ]
    assert db.scalar(select(func.count(Candidatura.id))) == 1

    consecutiva = criar_vaga(client, headers_ong, ocorrencias=[encontro(3, 4)])
    assert (
        client.post(
            endpoint_candidatura(consecutiva), headers=headers_voluntario
        ).status_code
        == 201
    )

    edicao = client.put(
        f"/api/v1/vagas/{primeira}",
        headers=headers_ong,
        json={"ocorrencias": [encontro(5, 6)]},
    )
    assert edicao.status_code == 400


def test_exige_documento_valido_e_emite_comprovante_privado(
    client,
    db,
    contas,
    headers_voluntario,
    headers_ong,
    tmp_path,
    monkeypatch,
    senha_hash,
):
    from app.usuarios.models import Voluntario

    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    vaga = criar_vaga(client, headers_ong, documentos_exigidos=[{"nome": "Termo"}])
    url = endpoint_candidatura(vaga)
    assert client.post(url, headers=headers_voluntario).status_code == 422
    incorreto = client.post(
        url,
        headers=headers_voluntario,
        data={"documentos_exigidos": "0"},
        files={"arquivos": ("termo.pdf", b"arquivo invalido", "application/pdf")},
    )
    assert incorreto.status_code == 422
    assert db.scalar(select(func.count(Candidatura.id))) == 0
    assert list(tmp_path.iterdir()) == []

    saida = BytesIO()
    pdf = Canvas(saida)
    pdf.drawString(50, 700, "Termo de teste")
    pdf.save()
    resposta = client.post(
        url,
        headers=headers_voluntario,
        data={"documentos_exigidos": "0"},
        files={"arquivos": ("termo.pdf", saida.getvalue(), "application/pdf")},
    )
    assert resposta.status_code == 201, resposta.text
    candidatura_id = resposta.json()["id"]
    documento = db.scalar(select(DocumentoCandidatura))
    assert documento.candidatura_id == candidatura_id
    assert (
        tmp_path / "candidaturas" / documento.arquivo
    ).read_bytes() == saida.getvalue()
    assert client.get(f"/api/v1/midia/{documento.arquivo}").status_code == 404

    url_comprovante = f"/api/v1/candidaturas/{candidatura_id}/comprovante"
    download = client.get(url_comprovante, headers=headers_voluntario)
    assert download.status_code == 200
    assert download.headers["Content-Type"] == "application/pdf"
    assert download.headers["Cache-Control"] == "no-store"
    assert download.content.startswith(b"%PDF-")
    outro = Voluntario(nome="Outro", email="outro@example.com", senha_hash=senha_hash)
    db.add(outro)
    db.flush()
    headers_outro = autenticar(client, outro.email)
    assert client.get(url_comprovante, headers=headers_outro).status_code == 404
    assert client.get(url_comprovante, headers=headers_ong).status_code == 403
