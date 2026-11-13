from app.usuarios.models import Voluntario

def test_consulta_do_voluntario_usa_o_titular_do_token(
    client, db, contas, senha_hash
):
    primeiro = contas["voluntario"]
    segundo = Voluntario(
        nome="Outro Voluntario",
        email="outro-voluntario@example.com",
        senha_hash=senha_hash,
    )
    db.add(segundo)
    db.flush()

    for titular, terceiro in ((primeiro, segundo), (segundo, primeiro)):
        login = client.post(
            "/api/v1/auth/login",
            json={"email": titular.email, "senha": "SenhaDeTeste123!"},
        )
        assert login.status_code == 200, login.text
        headers = {
            "Authorization": f"Bearer {login.json()['access_token']}"
        }

        resposta = client.get(
            "/api/v1/voluntarios/me",
            headers=headers,
            params={"id": terceiro.id, "usuario_id": terceiro.id},
        )
        assert resposta.status_code == 200, resposta.text
        perfil = resposta.json()
        assert perfil["id"] == titular.id
        assert perfil["email"] == titular.email
        assert perfil["nome"] == titular.nome
        assert perfil["perfil"] == "VOLUNTARIO"
        assert "senha" not in perfil
        assert "senha_hash" not in perfil
        assert "password_hash" not in perfil

        alteracao = {
            "nome_completo": f"{titular.nome} atualizado",
            "cidade": f"Cidade {titular.id}",
            "causas": [f"Causa {titular.id}"],
            "disponibilidades": ["DIA:SABADO", "PERIODO:MANHA", "CARGA_HORARIA:4"],
        }
        dados_terceiro = (terceiro.nome, terceiro.cidade, terceiro.causas)
        resposta = client.put(
            "/api/v1/voluntarios/me",
            headers=headers,
            params={"id": terceiro.id, "usuario_id": terceiro.id},
            json=alteracao,
        )
        assert resposta.status_code == 200, resposta.text
        assert resposta.json()["id"] == titular.id
        db.expire_all()
        assert (terceiro.nome, terceiro.cidade, terceiro.causas) == dados_terceiro
        consulta = client.get("/api/v1/voluntarios/me", headers=headers).json()
        assert consulta["nome"] == alteracao["nome_completo"]
        assert consulta["disponibilidades"] == alteracao["disponibilidades"]
