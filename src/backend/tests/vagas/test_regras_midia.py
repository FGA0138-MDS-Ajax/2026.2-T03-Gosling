import io

import pytest
from PIL import Image

from app.core.limpeza_midia import limpar_imagens_orfas
from app.midias.models import ArquivoMidia
from tests.vagas.test_limpeza_midia import envelhecer, enviar_foto, url_privada
from tests.vagas.test_publicacao import autenticar, publicar

pytest_plugins = ["tests.vagas.test_publicacao"]
VAGAS = "/api/v1/vagas"
MIDIA_ORG = "/api/v1/organizacoes/me/midia"


@pytest.fixture(autouse=True)
def pasta_temporaria(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))


def imagem(dimensoes=(20, 20), formato="PNG"):
    saida = io.BytesIO()
    Image.new("RGB", dimensoes, color="teal").save(saida, format=formato)
    return saida.getvalue()


def enviar_imagem(client, auth, caminho, conteudo, tipo="image/png"):
    return client.post(
        caminho, headers={**auth, "Content-Type": tipo}, content=conteudo
    )


def enviar_modelo(client, auth, nome):
    conteudo = imagem(formato="PDF")
    resposta = client.post(
        f"{VAGAS}/modelos-termo",
        headers={**auth, "Content-Type": "application/pdf"},
        params={"nome": nome},
        content=conteudo,
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json(), conteudo


@pytest.mark.parametrize(
    "uso,dimensoes,esperado",
    [
        ("logo", (400, 400), 201),
        ("logo", (399, 400), 422),
        ("capa", (1600, 600), 201),
        ("capa", (1600, 599), 422),
        ("capa", (1599, 600), 422),
    ],
)
def test_identidade_institucional_exige_dimensoes_do_uso(
    client,
    contas,
    uso,
    dimensoes,
    esperado,
):
    auth = autenticar(client, contas)
    resposta = enviar_imagem(client, auth, f"{MIDIA_ORG}/{uso}", imagem(dimensoes))
    assert resposta.status_code == esperado
    if esperado == 201:
        dados = resposta.json()
        assert (dados["largura"], dados["altura"]) == dimensoes
        assert client.get(dados["url"]).status_code == 404
        assert client.get(url_privada(dados["url"]), headers=auth).status_code == 200


def test_foto_da_vaga_aceita_dez_mb_e_recusa_byte_a_mais(client, contas):
    auth = autenticar(client, contas)
    limite = 10 * 1024 * 1024
    conteudo = imagem().ljust(limite, b"\0")
    resposta = enviar_imagem(client, auth, f"{VAGAS}/fotos", conteudo)
    assert resposta.status_code == 201
    assert resposta.json()["tamanho_bytes"] < limite
    muito_grande = enviar_imagem(client, auth, f"{VAGAS}/fotos", conteudo + b"\0")
    assert muito_grande.status_code == 413


def test_rejeita_mime_falsificado_resolucao_e_webp_institucional(client, contas):
    auth = autenticar(client, contas)
    foto = f"{VAGAS}/fotos"
    assert enviar_imagem(client, auth, foto, imagem(formato="JPEG")).status_code == 422
    enorme = imagem((5000, 4001))
    assert enviar_imagem(client, auth, foto, enorme).status_code == 422
    logo = f"{MIDIA_ORG}/logo"
    webp = imagem((400, 400), "WEBP")
    assert enviar_imagem(client, auth, logo, webp, "image/webp").status_code == 415


def test_ordem_capa_e_enquadramento_persistem(client, contas, dados_vaga, db):
    auth = autenticar(client, contas)
    fotos = [f"https://example.com/foto-{indice}.jpg" for indice in range(8)]
    fotos[0] = enviar_foto(client, auth)
    enquadramento = {fotos[0]: {"x": 10, "y": 95}}
    vaga = publicar(
        client,
        auth,
        {
            **dados_vaga,
            "fotos": fotos,
            "enquadramento_fotos": enquadramento,
        },
    )
    db.expunge_all()
    consulta = client.get(f"{VAGAS}/{vaga['id']}").json()
    assert consulta["fotos"] == fotos
    assert consulta["foto_capa"] == fotos[0]
    assert consulta["enquadramento_fotos"] == enquadramento


@pytest.mark.parametrize(
    "edicao",
    [
        {"fotos": [f"https://example.com/{i}.jpg" for i in range(9)]},
        {"fotos": ["https://example.com/a.jpg"] * 2},
        {"enquadramento_fotos": {"https://example.com/a.jpg": {"x": 101, "y": 50}}},
        {"enquadramento_fotos": {"https://example.com/a.jpg": {"x": 50, "y": 50}}},
    ],
)
def test_erro_de_galeria_nao_publica_vaga(client, contas, dados_vaga, edicao):
    resposta = client.post(
        VAGAS,
        headers=autenticar(client, contas),
        json={
            **dados_vaga,
            **edicao,
        },
    )
    assert resposta.status_code == 422
    assert client.get(VAGAS).json()["total"] == 0


def test_foto_do_rascunho_e_privada_e_outra_ong_nao_consegue_usar(
    client,
    db,
    contas,
    dados_vaga,
    senha_hash,
):
    from app.usuarios.models import Organizacao

    auth = autenticar(client, contas)
    foto = enviar_foto(client, auth)
    outro = Organizacao(
        nome="Outra ONG", email="outra-midia@example.com", senha_hash=senha_hash
    )
    db.add(outro)
    db.flush()
    auth_outra = autenticar(client, {"organizacao": outro})

    rascunho = client.post(f"{VAGAS}/rascunhos", headers=auth, json={"fotos": [foto]})
    assert rascunho.status_code == 201
    assert client.get(foto).status_code == 404
    assert client.get(url_privada(foto), headers=auth_outra).status_code == 404
    assert client.get(url_privada(foto), headers=auth).status_code == 200
    negada = client.post(
        VAGAS, headers=auth_outra, json={**dados_vaga, "fotos": [foto]}
    )
    assert negada.status_code == 422
    assert client.get(VAGAS).json()["total"] == 0


def test_modelo_pdf_publicado_tem_metadados_e_download_isolado(
    client,
    contas,
    dados_vaga,
):
    auth = autenticar(client, contas)
    modelo, conteudo = enviar_modelo(client, auth, "Termo de participação.pdf")
    url = modelo["url"]
    assert client.get(url).status_code == 404
    vaga = publicar(
        client,
        auth,
        {
            **dados_vaga,
            "documentos_exigidos": [
                {
                    "tipo": "TERMO",
                    "nome": "Termo",
                    "orientacao": "Assine o termo.",
                    "obrigatorio": False,
                    "modelo_url": url,
                }
            ],
        },
    )
    documento = vaga["documentos_exigidos"][0]
    assert documento["id"] and documento["tipo"] == "TERMO"
    assert not documento["obrigatorio"]
    assert documento["orientacao"] == "Assine o termo."
    assert documento["modelo"] == {
        "nome": "Termo de participação.pdf",
        "formato": "application/pdf",
        "tamanho_bytes": len(conteudo),
    }
    download = client.get(url)
    assert download.content == conteudo
    assert download.headers["content-type"] == "application/pdf"
    assert download.headers["content-disposition"].startswith("attachment;")
    assert client.get(url.replace("/modelos", "")).status_code == 404


def test_modelo_pdf_recusa_imagem_falsificada_e_tamanho_acima_do_limite(client, contas):
    auth = autenticar(client, contas)
    caminho = f"{VAGAS}/modelos-termo?nome=Termo.pdf"
    headers = {**auth, "Content-Type": "application/pdf"}
    falsificado = client.post(caminho, headers=headers, content=imagem())
    assert falsificado.status_code == 422

    pdf = imagem(formato="PDF")
    limite = 5 * 1024 * 1024
    corpo, marcador, fim = pdf.rpartition(b"startxref")
    comentario = b"%" + b" " * (limite - len(pdf) - 2) + b"\n"
    no_limite = corpo + comentario + marcador + fim
    resposta = client.post(caminho, headers=headers, content=no_limite)
    assert resposta.status_code == 201
    assert resposta.json()["tamanho_bytes"] == limite

    muito_grande = client.post(caminho, headers=headers, content=no_limite + b"\n")
    assert muito_grande.status_code == 413


def test_troca_modelo_preserva_arquivo_que_ainda_tem_outro_vinculo(
    client,
    db,
    contas,
    tmp_path,
):
    auth = autenticar(client, contas)
    anterior, _ = enviar_modelo(client, auth, "Anterior.pdf")
    atual, _ = enviar_modelo(client, auth, "Atual.pdf")
    documentos = [{"tipo": "TERMO", "nome": "Termo", "modelo_url": anterior["url"]}]
    ids = []
    for _ in range(2):
        salvo = client.post(
            f"{VAGAS}/rascunhos",
            headers=auth,
            json={
                "documentos_exigidos": documentos,
            },
        )
        assert salvo.status_code == 201
        documento = salvo.json()["dados"]["documentos_exigidos"][0]
        assert documento["modelo"]["nome"] == "Anterior.pdf"
        ids.append(salvo.json()["id"])

    def trocar(vaga_id):
        resposta = client.patch(
            f"{VAGAS}/rascunhos/{vaga_id}",
            headers=auth,
            json={
                "versao": 1,
                "dados": {
                    "documentos_exigidos": [
                        {**documentos[0], "modelo_url": atual["url"]},
                    ]
                },
            },
        )
        assert resposta.status_code == 200
        documento = resposta.json()["dados"]["documentos_exigidos"][0]
        assert documento["modelo"]["nome"] == "Atual.pdf"

    envelhecer(tmp_path, anterior["url"])
    trocar(ids[0])
    assert limpar_imagens_orfas(db) == 0
    trocar(ids[1])
    assert limpar_imagens_orfas(db) == 1
    nome_anterior = anterior["url"].rsplit("/", 1)[1]
    assert db.get(ArquivoMidia, nome_anterior) is None
    assert client.get(url_privada(atual["url"]), headers=auth).status_code == 200
