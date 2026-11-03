from fastapi.testclient import TestClient

from app.jwt_geraçao.main import app


def test_health_retorna_sistema_disponivel() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
