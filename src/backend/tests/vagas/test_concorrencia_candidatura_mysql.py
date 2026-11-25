"""Disputa real entre a candidatura e a edição ou o encerramento da vaga.

Os demais testes rodam dentro de uma transação revertida ao final, o que
impede duas requisições de concorrerem pelo mesmo bloqueio. Aqui cada
requisição usa a própria conexão com o MySQL e confirma sua transação.

Para fixar a ordem sem depender de sorte, a primeira operação pausa logo
depois de bloquear a linha da vaga. A segunda só é liberada depois que o
MySQL mostra que ela está esperando por esse bloqueio.
"""

import os
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Event

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, text
from sqlalchemy.orm import sessionmaker

from app.candidaturas.repository import CandidaturaRepository
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao, Usuario, Voluntario
from app.vagas.repository import VagaRepository

URL_BANCO = os.getenv("TEST_DATABASE_URL", "")
LIMITE_ESPERA = 15

pytestmark = pytest.mark.skipif(
    not URL_BANCO.startswith("mysql"),
    reason="A disputa pelo bloqueio da vaga exige o MySQL de teste.",
)

HORARIO_ORIGINAL = {
    "inicio": "2027-03-10T08:00:00-03:00",
    "fim": "2027-03-10T12:00:00-03:00",
}
HORARIO_NOVO = {
    "inicio": "2027-04-05T14:00:00-03:00",
    "fim": "2027-04-05T16:00:00-03:00",
}


class Cenario:
    def __init__(self, engine, sufixo: str):
        self.engine = engine
        self.sufixo = sufixo
        self.causa = f"Causa concorrência {sufixo}"
        self.usuarios: list[int] = []

    def criar_conta(self, modelo, nome: str) -> dict:
        with sessionmaker(self.engine)() as sessao:
            conta = modelo(
                nome=nome,
                email=f"{nome.lower()}.{self.sufixo}@concorrencia.teste",
                senha_hash=hash_password(uuid.uuid4().hex),
            )
            sessao.add(conta)
            sessao.commit()
            self.usuarios.append(conta.id)
            token = create_access_token(conta.id, conta.perfil.value)
            return {"id": conta.id, "headers": {"Authorization": f"Bearer {token}"}}

    def publicar(self, ong: dict, titulo: str, horario: dict) -> int:
        resposta = TestClient(app).post(
            "/api/v1/vagas",
            headers=ong["headers"],
            json={
                "titulo": titulo,
                "descricao": "Vaga criada pelo teste de concorrência",
                "atividades": "Atividades de apoio realizadas pelo voluntário",
                "causa": self.causa,
                "modalidade": "PRESENCIAL",
                "local": "Brasília - DF",
                "periodo": "MANHA",
                "carga_horaria": 4,
                "numero_vagas": 3,
                "ocorrencias": [horario],
            },
        )
        assert resposta.status_code == 201, resposta.text
        return resposta.json()["id"]

    def limpar(self) -> None:
        with sessionmaker(self.engine)() as sessao:
            # As vagas, os encontros e as candidaturas saem em cascata.
            sessao.execute(delete(Usuario).where(Usuario.id.in_(self.usuarios)))
            sessao.execute(delete(Causa).where(Causa.nome == self.causa))
            sessao.commit()


@pytest.fixture
def cenario(jwt_secret):
    engine = create_engine(URL_BANCO, pool_pre_ping=True)
    fabrica = sessionmaker(engine)

    def sessao_propria():
        with fabrica() as sessao:
            yield sessao

    app.dependency_overrides[get_db] = sessao_propria
    dados = Cenario(engine, uuid.uuid4().hex[:8])
    try:
        yield dados
    finally:
        app.dependency_overrides.clear()
        dados.limpar()
        engine.dispose()


def pausar_apos_bloqueio(monkeypatch, classe, metodo: str, *, so_com_bloqueio=False):
    """Faz o método parar com a linha da vaga bloqueada até ser liberado."""
    original = getattr(classe, metodo)
    bloqueou, liberar = Event(), Event()

    def pausado(repositorio, *args, **kwargs):
        resultado = original(repositorio, *args, **kwargs)
        if not so_com_bloqueio or kwargs.get("bloquear"):
            bloqueou.set()
            assert liberar.wait(LIMITE_ESPERA), "A primeira operação não foi liberada."
        return resultado

    monkeypatch.setattr(classe, metodo, pausado)
    return bloqueou, liberar


def aguardar_espera_pela_vaga(engine, segunda: Future) -> None:
    """Confirma no MySQL que a segunda requisição espera o bloqueio da vaga."""
    with engine.connect() as monitor:
        propria = monitor.execute(text("SELECT CONNECTION_ID()")).scalar_one()
        prazo = time.monotonic() + LIMITE_ESPERA
        while time.monotonic() < prazo:
            assert not segunda.done(), segunda.result().text
            for conexao in monitor.execute(text("SHOW FULL PROCESSLIST")).mappings():
                consulta = conexao["Info"] or ""
                if (
                    conexao["Id"] != propria
                    and "FROM vagas" in consulta
                    and "FOR UPDATE" in consulta
                ):
                    return
            time.sleep(0.02)
    pytest.fail("A segunda requisição não chegou a esperar pelo bloqueio da vaga.")


def disputar(engine, pausa, primeira, segunda):
    """Executa as duas requisições em paralelo, na ordem definida pela pausa."""
    bloqueou, liberar = pausa
    with ThreadPoolExecutor(max_workers=2) as executor:
        try:
            futura_primeira = executor.submit(primeira)
            assert bloqueou.wait(LIMITE_ESPERA), "A primeira operação não bloqueou."
            futura_segunda = executor.submit(segunda)
            aguardar_espera_pela_vaga(engine, futura_segunda)
        finally:
            liberar.set()
        return (
            futura_primeira.result(timeout=LIMITE_ESPERA),
            futura_segunda.result(timeout=LIMITE_ESPERA),
        )


def candidatar(vaga_id: int, voluntario: dict):
    return lambda: TestClient(app).post(
        f"/api/v1/vagas/{vaga_id}/candidaturas", headers=voluntario["headers"]
    )


def editar(vaga_id: int, ong: dict, corpo: dict):
    return lambda: TestClient(app).put(
        f"/api/v1/vagas/{vaga_id}", headers=ong["headers"], json=corpo
    )


def gestao(vaga_id: int, ong: dict) -> dict:
    resposta = TestClient(app).get(
        f"/api/v1/vagas/{vaga_id}/gestao", headers=ong["headers"]
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def agenda(voluntario: dict) -> list[dict]:
    resposta = TestClient(app).get(
        "/api/v1/voluntarios/me/calendario",
        headers=voluntario["headers"],
        params={"inicio": "2027-01-01", "fim": "2027-12-31"},
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def test_candidatura_primeiro_impede_a_mudanca_de_horario(cenario, monkeypatch):
    ong = cenario.criar_conta(Organizacao, "Ong")
    voluntario = cenario.criar_conta(Voluntario, "Voluntario")
    vaga_id = cenario.publicar(ong, "Vaga disputada", HORARIO_ORIGINAL)
    original = gestao(vaga_id, ong)

    candidatura, edicao = disputar(
        cenario.engine,
        pausar_apos_bloqueio(monkeypatch, CandidaturaRepository, "bloquear_vaga"),
        candidatar(vaga_id, voluntario),
        editar(
            vaga_id,
            ong,
            {"titulo": "Título junto com horário", "ocorrencias": [HORARIO_NOVO]},
        ),
    )

    assert candidatura.status_code == 201, candidatura.text
    assert edicao.status_code == 400, edicao.text
    salva = gestao(vaga_id, ong)
    assert salva["horarios_bloqueados"] is True
    assert salva["titulo"] == original["titulo"]
    assert salva["ocorrencias"] == original["ocorrencias"]


def test_edicao_primeiro_faz_a_candidatura_validar_o_novo_horario(
    cenario, monkeypatch
):
    ong = cenario.criar_conta(Organizacao, "Ong")
    voluntario = cenario.criar_conta(Voluntario, "Voluntario")
    vaga_id = cenario.publicar(ong, "Vaga disputada", HORARIO_ORIGINAL)
    # O voluntário já tem compromisso no novo horário, mas não no antigo.
    compromisso_id = cenario.publicar(ong, "Compromisso existente", HORARIO_NOVO)
    assert candidatar(compromisso_id, voluntario)().status_code == 201

    edicao, candidatura = disputar(
        cenario.engine,
        pausar_apos_bloqueio(
            monkeypatch, VagaRepository, "buscar_por_id", so_com_bloqueio=True
        ),
        editar(vaga_id, ong, {"ocorrencias": [HORARIO_NOVO]}),
        candidatar(vaga_id, voluntario),
    )

    assert edicao.status_code == 200, edicao.text
    assert candidatura.status_code == 409, candidatura.text
    detalhe = candidatura.json()["detail"]
    assert detalhe["codigo"] == "CONFLITO_HORARIO"
    assert {item["vaga_id"] for item in detalhe["conflitos"]} == {compromisso_id}
    assert gestao(vaga_id, ong)["horarios_bloqueados"] is False
    assert [item["vaga_id"] for item in agenda(voluntario)] == [compromisso_id]


def test_encerramento_primeiro_recusa_a_candidatura_e_mantem_a_agenda(
    cenario, monkeypatch
):
    ong = cenario.criar_conta(Organizacao, "Ong")
    inscrito = cenario.criar_conta(Voluntario, "Inscrito")
    atrasado = cenario.criar_conta(Voluntario, "Atrasado")
    vaga_id = cenario.publicar(ong, "Vaga disputada", HORARIO_ORIGINAL)
    assert candidatar(vaga_id, inscrito)().status_code == 201
    compromissos = agenda(inscrito)

    encerramento, candidatura = disputar(
        cenario.engine,
        pausar_apos_bloqueio(
            monkeypatch, VagaRepository, "buscar_por_id", so_com_bloqueio=True
        ),
        editar(vaga_id, ong, {"estado_vaga": "ENCERRADA"}),
        candidatar(vaga_id, atrasado),
    )

    assert encerramento.status_code == 200, encerramento.text
    assert candidatura.status_code == 400, candidatura.text
    assert "ABERTA" in candidatura.json()["detail"]
    assert gestao(vaga_id, ong)["estado_vaga"] == "ENCERRADA"
    assert agenda(inscrito) == compromissos
    assert [item["vaga_id"] for item in compromissos] == [vaga_id]
    assert agenda(atrasado) == []
