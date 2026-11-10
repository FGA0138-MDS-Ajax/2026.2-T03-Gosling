import jwt

from app.usuarios.models import Voluntario


def test_cadastro_sessao_e_edicao_do_titular(client, db, contas, jwt_secret):
    url = "/api/v1/voluntarios"
    dados = dict(
        nome_completo="Ana Teste",
        email="ana-nova@example.org",
        identificacao="529.982.247-25",
        password="TesteVoluntario123!",
        consentimento_termos=True,
        telefone="61999990000",
        cidade="Brasília",
        estado="DF",
    )
    assert (
        client.post(url, json={**dados, "consentimento_termos": False}).status_code
        == 400
    )
    assert (
        client.post(url, json={**dados, "identificacao": "00000000000"}).status_code
        == 422
    )
    assert (
        client.post(url, json={**dados, "perfil": "ADMINISTRADOR"}).status_code == 422
    )
    assert client.post(url, json={**dados, "estado": "ZZ"}).status_code == 422
    resposta = client.post(url, json=dados)
    assert resposta.status_code == 201, resposta.text
    sessao = resposta.json()
    assert sessao["usuario"]["perfil"] == "VOLUNTARIO"
    assert "password" not in sessao and "senha_hash" not in sessao["usuario"]
    conta = db.get(Voluntario, sessao["usuario"]["id"])
    assert conta.consentimento_termos and conta.senha_hash.startswith("$argon2")
    assert (
        client.post(
            url,
            json={
                **dados,
                "email": "outra@example.org",
                "identificacao": "52998224725",
            },
        ).status_code
        == 409
    )
    assert (
        client.post(url, json={**dados, "identificacao": "11144477735"}).status_code
        == 409
    )
    headers = {"Authorization": "Bearer " + sessao["access_token"]}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    perfil = url + "/me"
    assert client.get(perfil, headers=headers).json()["cidade"] == "Brasília"
    assert (
        client.put(
            perfil, json={"id": contas["voluntario"].id}, headers=headers
        ).status_code
        == 422
    )
    assert (
        client.put(
            perfil, json={"causas": ["Educação"], "cidade": "Gama"}, headers=headers
        ).status_code
        == 200
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": dados["email"], "senha": dados["password"]}
    )
    assert login.status_code == 200
    atualizado = client.get(
        perfil, headers={"Authorization": "Bearer " + login.json()["access_token"]}
    ).json()
    assert atualizado["causas"] == ["Educação"] and atualizado["cidade"] == "Gama"
    assert contas["voluntario"].cidade is None
    incompleto = jwt.encode({"sub": str(conta.id)}, jwt_secret, algorithm="HS256")
    assert (
        client.put(
            perfil, json={}, headers={"Authorization": "Bearer " + incompleto}
        ).status_code
        == 401
    )
    login_ong = client.post(
        "/api/v1/auth/login",
        json={"email": contas["organizacao"].email, "senha": "SenhaDeTeste123!"},
    )
    assert (
        client.put(
            perfil,
            json={},
            headers={"Authorization": "Bearer " + login_ong.json()["access_token"]},
        ).status_code
        == 403
    )
