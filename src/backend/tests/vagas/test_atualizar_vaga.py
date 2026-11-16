from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import jwt
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.organizacoes.router import get_vaga_service
from app.vagas.schemas import AtualizarVagaRequest
from app.vagas.service import (
    AcessoNegadoVagaException,
    AlteracaoHorarioNaoPermitidaException,
    VagaNaoEncontradaException,
)
from app.voluntarios.service import ALGORITHM, SECRET_KEY

client = TestClient(app)


def gerar_token_teste(
    sub: str = "org-uuid-123",
    perfil: str = "Organizacao",
    expirado: bool = False,
) -> str:
    delta = timedelta(hours=-1) if expirado else timedelta(hours=2)
    payload = {
        "sub": sub,
        "perfil": perfil,
        "exp": datetime.now(timezone.utc) + delta,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def mock_vaga_banco(
    vaga_id: str = "vaga-uuid-001",
    organizacao_id: str = "org-uuid-123",
    estado: str = "ABERTA",
) -> dict:
    agora = datetime.now(timezone.utc)
    return {
        "id": vaga_id,
        "organizacao_id": organizacao_id,
        "titulo": "Desenvolvedor Java Voluntário",
        "descricao": "Auxiliar na criação de sistemas para ONGs.",
        "cidade": "São Paulo",
        "estado_uf": "SP",
        "data_inicio": agora + timedelta(days=5),
        "data_fim": agora + timedelta(days=30),
        "estado_vaga": estado,
        "data_criacao": agora,
    }


def test_atualizar_vaga_sucesso_organizacao_dona():
    token = gerar_token_teste(sub="org-uuid-123", perfil="Organizacao")
    vaga_atualizada = mock_vaga_banco(
        vaga_id="vaga-uuid-001", organizacao_id="org-uuid-123"
    )
    vaga_atualizada["titulo"] = "Novo Título da Vaga"

    mock_service = MagicMock()
    mock_service.atualizar_vaga.return_value = vaga_atualizada
    app.dependency_overrides[get_vaga_service] = lambda: mock_service

    payload = {"titulo": "Novo Título da Vaga"}

    try:
        response = client.put(
            "/api/v1/vagas/vaga-uuid-001",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["titulo"] == "Novo Título da Vaga"

        mock_service.atualizar_vaga.assert_called_once()
        args, kwargs = mock_service.atualizar_vaga.call_args
        assert kwargs["vaga_id"] == "vaga-uuid-001"
        assert kwargs["organizacao_id"] == "org-uuid-123"
    finally:
        app.dependency_overrides.clear()


def test_atualizar_vaga_acesso_negado_organizacao_diferente():
    token_invasor = gerar_token_teste(sub="org-uuid-999", perfil="Organizacao")

    mock_service = MagicMock()
    mock_service.atualizar_vaga.side_effect = AcessoNegadoVagaException(
        "Acesso negado: Você não tem permissão para alterar esta vaga."
    )
    app.dependency_overrides[get_vaga_service] = lambda: mock_service

    payload = {"titulo": "Tentativa de Alteração Indevida"}

    try:
        response = client.put(
            "/api/v1/vagas/vaga-uuid-001",
            json=payload,
            headers={"Authorization": f"Bearer {token_invasor}"},
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Acesso negado" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_atualizar_vaga_bloqueia_alteracao_horario_com_candidaturas_ativas():
    token = gerar_token_teste(sub="org-uuid-123", perfil="Organizacao")

    mock_service = MagicMock()
    mock_service.atualizar_vaga.side_effect = (
        AlteracaoHorarioNaoPermitidaException(
            "Não é permitido alterar os horários da vaga pois existem "
            "candidaturas pendentes ou aceitas vinculadas a ela."
        )
    )
    app.dependency_overrides[get_vaga_service] = lambda: mock_service

    nova_data = (
        datetime.now(timezone.utc) + timedelta(days=10)
    ).isoformat()
    payload = {"data_inicio": nova_data}

    try:
        response = client.put(
            "/api/v1/vagas/vaga-uuid-001",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Não é permitido alterar os horários" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_atualizar_vaga_encerramento_preserva_candidaturas():
    token = gerar_token_teste(sub="org-uuid-123", perfil="Organizacao")
    vaga_encerrada = mock_vaga_banco(
        vaga_id="vaga-uuid-001", estado="ENCERRADA"
    )

    mock_service = MagicMock()
    mock_service.atualizar_vaga.return_value = vaga_encerrada
    app.dependency_overrides[get_vaga_service] = lambda: mock_service

    payload = {"estado_vaga": "ENCERRADA"}

    try:
        response = client.put(
            "/api/v1/vagas/vaga-uuid-001",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["estado_vaga"] == "ENCERRADA"
    finally:
        app.dependency_overrides.clear()


def test_atualizar_vaga_nao_encontrada_retorna_404():
    token = gerar_token_teste(sub="org-uuid-123", perfil="Organizacao")

    mock_service = MagicMock()
    mock_service.atualizar_vaga.side_effect = VagaNaoEncontradaException(
        "Vaga não encontrada."
    )
    app.dependency_overrides[get_vaga_service] = lambda: mock_service

    try:
        response = client.put(
            "/api/v1/vagas/vaga-inexistente-999",
            json={"titulo": "Novo Título"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Vaga não encontrada" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_atualizar_vaga_perfil_voluntario_retorna_403():
    token_voluntario = gerar_token_teste(
        sub="user-uuid-888", perfil="Voluntario"
    )

    response = client.put(
        "/api/v1/vagas/vaga-uuid-001",
        json={"titulo": "Invasão de Voluntário"},
        headers={"Authorization": f"Bearer {token_voluntario}"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN