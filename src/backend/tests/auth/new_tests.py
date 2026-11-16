from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_listar_vagas_sem_token_retorna_401():
    resposta = client.get("/api/v1/organizacoes/me/vagas")
    assert resposta.status_code == 401


def test_listar_vagas_com_perfil_voluntario_retorna_403(token_voluntario):
    resposta = client.get(
        "/api/v1/organizacoes/me/vagas",
        headers={"Authorization": f"Bearer {token_voluntario}"},
    )
    assert resposta.status_code == 403


def test_listar_vagas_pagina_invalida_retorna_422(token_organizacao):
    resposta = client.get(
        "/api/v1/organizacoes/me/vagas?pagina=0",
        headers={"Authorization": f"Bearer {token_organizacao}"},
    )
    assert resposta.status_code == 422