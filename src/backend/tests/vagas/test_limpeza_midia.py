import asyncio
import io
import os
import time

import pytest
from PIL import Image

from app.core.limpeza_midia import PRAZO_UPLOAD_SEM_VINCULO, limpar_imagens_orfas
from app.core import limpeza_midia
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga
from app.vagas.repository import VagaRepository
from tests.vagas.test_publicacao import autenticar, publicar

pytest_plugins = ["tests.vagas.test_publicacao"]


def enviar_foto(client, auth):
    imagem = io.BytesIO()
    Image.new("RGB", (10, 10), color="teal").save(imagem, format="PNG")
    resposta = client.post(
        "/api/v1/vagas/fotos",
        headers={**auth, "Content-Type": "image/png"},
        content=imagem.getvalue(),
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()["url"]


def envelhecer(tmp_path, url):
    passado = time.time() - PRAZO_UPLOAD_SEM_VINCULO - 60
    os.utime(tmp_path / url.rsplit("/", 1)[1], (passado, passado))


def test_upload_abandonado_expira_sem_remover_upload_recente(
    client, db, contas, tmp_path, monkeypatch
):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    auth = autenticar(client, contas)
    abandonada = enviar_foto(client, auth)
    recente = enviar_foto(client, auth)
    envelhecer(tmp_path, abandonada)
    assert limpar_imagens_orfas(db) == 1
    assert client.get(abandonada).status_code == 404
    assert client.get(recente).status_code == 200
    assert limpar_imagens_orfas(db) == 0


@pytest.mark.parametrize("status", list(StatusVaga))
def test_preserva_fotos_de_vagas_em_todos_os_estados_e_avatar(
    client, db, contas, dados_vaga, tmp_path, monkeypatch, status
):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    auth = autenticar(client, contas)
    foto, avatar, modelo = [enviar_foto(client, auth) for _ in range(3)]
    vaga = publicar(
        client,
        auth,
        {
            **dados_vaga,
            "fotos": [foto],
            "documentos_exigidos": [{"nome": "Modelo", "modelo_url": modelo}],
        },
    )
    db.get(Vaga, vaga["id"]).status = status
    contas["voluntario"].foto_url = avatar
    db.commit()
    for url in (foto, avatar, modelo):
        envelhecer(tmp_path, url)
    assert limpar_imagens_orfas(db) == 0
    for url in (foto, avatar, modelo):
        assert client.get(url).status_code == 200


def test_falha_de_publicacao_permite_retentativa_e_limpa_apos_abandono(
    client, db, contas, dados_vaga, tmp_path, monkeypatch
):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    auth = autenticar(client, contas)
    foto = enviar_foto(client, auth)
    db.commit()
    confirmar = VagaRepository.confirmar

    def falhar(repository):
        raise RuntimeError("Falha simulada no commit.")

    monkeypatch.setattr(VagaRepository, "confirmar", falhar)
    with pytest.raises(RuntimeError, match="Falha simulada"):
        client.post("/api/v1/vagas", headers=auth, json={**dados_vaga, "fotos": [foto]})
    assert limpar_imagens_orfas(db) == 0
    assert client.get(foto).status_code == 200

    envelhecer(tmp_path, foto)
    assert limpar_imagens_orfas(db) == 1
    monkeypatch.setattr(VagaRepository, "confirmar", confirmar)
    resposta = client.post(
        "/api/v1/vagas", headers=auth, json={**dados_vaga, "fotos": [foto]}
    )
    assert resposta.status_code == 422
    assert client.get("/api/v1/vagas").json()["total"] == 0

    nova_foto = enviar_foto(client, auth)
    vaga = publicar(client, auth, {**dados_vaga, "fotos": [nova_foto]})
    assert vaga["fotos"] == [nova_foto]


def test_limpeza_falha_sem_apagar_arquivos_quando_banco_indisponivel(
    client, db, contas, tmp_path, monkeypatch
):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    foto = enviar_foto(client, autenticar(client, contas))
    envelhecer(tmp_path, foto)

    def falhar(*args):
        raise RuntimeError("Banco indisponível.")

    monkeypatch.setattr(db, "scalars", falhar)
    with pytest.raises(RuntimeError, match="Banco indisponível"):
        limpar_imagens_orfas(db)
    assert client.get(foto).status_code == 200


def test_limpeza_ignora_arquivos_fora_do_padrao_de_upload(db, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    arquivo = tmp_path / "manual.webp"
    arquivo.write_bytes(b"arquivo preservado")
    envelhecer(tmp_path, f"/{arquivo.name}")
    assert limpar_imagens_orfas(db) == 0
    assert arquivo.exists()


def test_limpeza_periodica_tenta_novamente_apos_falha_e_aceita_cancelamento(
    monkeypatch, caplog
):
    tentativas = 0
    intervalos = []

    async def aguardar(intervalo):
        intervalos.append(intervalo)
        if len(intervalos) == 3:
            raise asyncio.CancelledError

    async def executar(funcao):
        nonlocal tentativas
        assert funcao is limpeza_midia.executar_limpeza_midia
        tentativas += 1
        if tentativas == 1:
            raise RuntimeError("Banco indisponível.")

    monkeypatch.setattr(limpeza_midia.asyncio, "sleep", aguardar)
    monkeypatch.setattr(limpeza_midia, "run_in_threadpool", executar)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(limpeza_midia.limpar_midias_periodicamente())
    assert tentativas == 2
    assert intervalos == [limpeza_midia.INTERVALO_LIMPEZA] * 3
    assert "Falha na limpeza de mídia" in caplog.text
