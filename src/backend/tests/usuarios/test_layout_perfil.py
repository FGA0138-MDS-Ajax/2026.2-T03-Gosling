import io

import pytest
from PIL import Image
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.usuarios.models import Voluntario

URL = "/api/v1/voluntarios/me"


def headers(conta):
    return {
        "Authorization": "Bearer " + create_access_token(conta.id, conta.perfil.value)
    }


def test_grade_preserva_pares_sem_criar_combinacoes_extras(client, db, contas):
    titular = contas["voluntario"]
    titular.disponibilidades = ["Fins de Semana", "DIA:FERIADO"]
    db.flush()
    faixas = [
        {"dia": "SEGUNDA", "periodo": "MANHA"},
        {"dia": "SABADO", "periodo": "TARDE"},
    ]
    resposta = client.put(
        URL,
        headers=headers(titular),
        json={
            "disponibilidade_semanal": faixas,
            "carga_horaria_semanal": 6,
        },
    )
    assert resposta.status_code == 200, resposta.text
    with Session(bind=db.get_bind(), join_transaction_mode="create_savepoint") as outra:
        salvo = outra.get(Voluntario, titular.id)
        assert salvo.disponibilidade_semanal == faixas
        assert salvo.carga_horaria_semanal == 6
    db.expire_all()
    perfil = client.get(URL, headers=headers(titular)).json()
    assert perfil["disponibilidade_semanal"] == faixas
    assert "Fins de Semana" in perfil["disponibilidades"]
    assert "DIA:FERIADO" in perfil["disponibilidades"]
    assert client.get(URL, headers=headers(contas["inativo"])).status_code == 401


def test_converte_legado_preserva_carga_e_permite_limpar(client, db, contas):
    titular = contas["voluntario"]
    titular.disponibilidades = ["DIA:SABADO", "PERIODO:MANHA", "CARGA_HORARIA:4"]
    db.flush()
    perfil = client.get(URL, headers=headers(titular)).json()
    assert perfil["disponibilidade_semanal"] == [{"dia": "SABADO", "periodo": "MANHA"}]
    assert perfil["carga_horaria_semanal"] == 4
    perfil = client.put(
        URL,
        headers=headers(titular),
        json={
            "disponibilidade_semanal": [{"dia": "SEGUNDA", "periodo": "NOITE"}],
        },
    ).json()
    assert perfil["carga_horaria_semanal"] == 4
    perfil = client.put(
        URL,
        headers=headers(titular),
        json={
            "disponibilidade_semanal": [],
            "carga_horaria_semanal": None,
        },
    ).json()
    assert perfil["disponibilidade_semanal"] == perfil["disponibilidades"] == []
    assert perfil["carga_horaria_semanal"] is None


@pytest.mark.parametrize("horas", [4, 8])
def test_cliente_antigo_nao_amplia_pares_ao_reenviar_preferencias(
    client, db, contas, horas
):
    auth = headers(contas["voluntario"])
    faixas = [
        {"dia": "SEGUNDA", "periodo": "MANHA"},
        {"dia": "SABADO", "periodo": "TARDE"},
    ]
    inicial = client.put(
        URL,
        headers=auth,
        json={"disponibilidade_semanal": faixas, "carga_horaria_semanal": 4},
    ).json()
    legado = [
        item for item in reversed(inicial["disponibilidades"])
        if not item.startswith("CARGA_HORARIA:")
    ]
    legado += ["Fins de Semana", f"CARGA_HORARIA:{horas}"]
    resposta = client.put(
        URL,
        headers=auth,
        json={"biografia": "Biografia atualizada.", "disponibilidades": legado},
    )
    assert resposta.status_code == 200, resposta.text
    db.expire_all()
    perfil = client.get(URL, headers=auth).json()
    assert perfil["biografia"] == "Biografia atualizada."
    assert perfil["disponibilidade_semanal"] == faixas
    assert perfil["carga_horaria_semanal"] == horas
    assert perfil["disponibilidades"] == legado


@pytest.mark.parametrize(
    "legado,faixas,carga",
    [
        (["DIA:SEXTA", "PERIODO:NOITE", "CARGA_HORARIA:2"],
         [{"dia": "SEXTA", "periodo": "NOITE"}], 2),
        ([], [], None),
        (None, [], None),
    ],
)
def test_cliente_antigo_pode_alterar_ou_limpar_grade(
    client, db, contas, legado, faixas, carga
):
    auth = headers(contas["voluntario"])
    client.put(URL, headers=auth, json={
        "disponibilidade_semanal": [{"dia": "SABADO", "periodo": "MANHA"}],
        "carga_horaria_semanal": 4,
    })
    resposta = client.put(URL, headers=auth, json={"disponibilidades": legado})
    assert resposta.status_code == 200, resposta.text
    db.expire_all()
    perfil = client.get(URL, headers=auth).json()
    assert perfil["disponibilidade_semanal"] == faixas
    assert perfil["carga_horaria_semanal"] == carga


def test_grade_explicita_tem_prioridade_sobre_legado_no_mesmo_payload(client, contas):
    faixas = [{"dia": "SEGUNDA", "periodo": "NOITE"}]
    resposta = client.put(URL, headers=headers(contas["voluntario"]), json={
        "disponibilidade_semanal": faixas,
        "carga_horaria_semanal": 6,
        "disponibilidades": ["DIA:SABADO", "PERIODO:MANHA", "CARGA_HORARIA:4"],
    })
    assert resposta.status_code == 200, resposta.text
    perfil = resposta.json()
    assert perfil["disponibilidade_semanal"] == faixas
    assert perfil["carga_horaria_semanal"] == 6
    assert perfil["disponibilidades"] == [
        "DIA:SEGUNDA", "PERIODO:NOITE", "CARGA_HORARIA:6",
    ]


@pytest.mark.parametrize(
    "payload",
    [
        {"disponibilidade_semanal": [{"dia": "FERIADO", "periodo": "MANHA"}]},
        {"disponibilidade_semanal": [{"dia": "SABADO", "periodo": "MADRUGADA"}]},
        {"disponibilidade_semanal": [{"dia": "SABADO", "periodo": "MANHA"}] * 2},
        {"carga_horaria_semanal": 0},
        {"carga_horaria_semanal": 61},
        {"carga_horaria_semanal": 1.5},
        {"carga_horaria_semanal": True},
    ],
)
def test_grade_invalida_nao_altera_perfil(client, contas, payload):
    auth = headers(contas["voluntario"])
    antes = client.get(URL, headers=auth).json()
    assert (
        client.put(
            URL, headers=auth, json={"nome_completo": "Não salvar", **payload}
        ).status_code
        == 422
    )
    assert client.get(URL, headers=auth).json() == antes


def imagem():
    saida = io.BytesIO()
    Image.new("RGB", (900, 600), color="teal").save(saida, format="PNG")
    return saida.getvalue()


def test_foto_autorizada_recodifica_e_remove_anterior(
    client, contas, tmp_path, monkeypatch
):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    auth = headers(contas["voluntario"])
    resposta = client.put(
        URL + "/foto", headers={**auth, "Content-Type": "image/png"}, content=imagem()
    )
    assert resposta.status_code == 200, resposta.text
    primeira = resposta.json()["foto_url"]
    arquivo = client.get(primeira)
    assert arquivo.status_code == 200
    assert arquivo.headers["content-type"] == "image/webp"
    assert arquivo.headers["x-content-type-options"] == "nosniff"
    with Image.open(io.BytesIO(arquivo.content)) as foto:
        assert foto.width <= 512 and foto.height <= 512
        assert not foto.getexif()
    segunda = client.put(
        URL + "/foto", headers={**auth, "Content-Type": "image/png"}, content=imagem()
    ).json()["foto_url"]
    assert client.get(primeira).status_code == 404
    assert client.get(segunda).status_code == 200
    assert client.delete(URL + "/foto", headers=auth).json()["foto_url"] is None
    assert client.get(segunda).status_code == 404
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "conta,status", [(None, 401), ("organizacao", 403), ("administrador", 403)]
)
def test_upload_foto_exige_titular_voluntario(client, contas, conta, status):
    auth = headers(contas[conta]) if conta else {}
    assert (
        client.put(
            URL + "/foto",
            headers={**auth, "Content-Type": "image/png"},
            content=imagem(),
        ).status_code
        == status
    )


@pytest.mark.parametrize(
    "tipo,conteudo,status",
    [
        ("image/svg+xml", b"<svg/>", 415),
        ("image/png", b"nao-e-imagem", 422),
        ("image/png", b"x" * (5 * 1024 * 1024 + 1), 413),
    ],
)
def test_arquivo_invalido_nao_salva_foto(
    client, contas, tipo, conteudo, status, tmp_path, monkeypatch
):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    auth = headers(contas["voluntario"])
    assert (
        client.put(
            URL + "/foto", headers={**auth, "Content-Type": tipo}, content=conteudo
        ).status_code
        == status
    )
    assert client.get(URL, headers=auth).json()["foto_url"] is None
    assert not list(tmp_path.iterdir())


def test_midia_inexistente_e_caminho_invalido(client):
    assert client.get("/api/v1/midia/arquivo.txt").status_code == 404
    assert client.get("/api/v1/midia/" + "f" * 32 + ".webp").status_code == 404
