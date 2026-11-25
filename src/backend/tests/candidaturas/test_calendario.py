from datetime import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.candidaturas.enums import StatusCandidatura
from app.candidaturas.models import Candidatura
from app.usuarios.catalogos import Causa
from app.usuarios.models import Voluntario
from app.vagas.enums import Modalidade, Periodo, StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga
from tests.vagas.test_publicacao import autenticar

URL = "/api/v1/voluntarios/me/calendario"
SEMANA = {"inicio": "2026-11-16", "fim": "2026-11-23"}


@pytest.fixture
def criar_candidatura(db, contas):
    causa = Causa(nome="Educação", nome_normalizado="educação")
    db.add(causa)

    def criar(
        ocorrencias=None,
        status=StatusCandidatura.PENDENTE,
        voluntario=None,
        estado_vaga=StatusVaga.ABERTA,
    ):
        encontros = ocorrencias or [("2026-11-16T12:00:00Z", "2026-11-16T15:00:00Z")]
        vaga = Vaga(
            organizacao=contas["organizacao"],
            causa=causa,
            titulo="Oficina de leitura",
            descricao="Leitura com a comunidade.",
            atividades="Organizar livros e apoiar a leitura.",
            modalidade=Modalidade.PRESENCIAL,
            local="Brasília, DF",
            periodo=Periodo.MANHA,
            carga_horaria=3,
            numero_vagas=10,
            status=estado_vaga,
            ocorrencias=[
                OcorrenciaVaga(
                    inicio=datetime.fromisoformat(inicio),
                    fim=datetime.fromisoformat(fim),
                )
                for inicio, fim in encontros
            ],
        )
        db.add(vaga)
        db.flush()
        candidatura = Candidatura(
            voluntario_id=(voluntario or contas["voluntario"]).id,
            vaga=vaga,
            status=status,
        )
        db.add(candidatura)
        db.flush()
        return candidatura

    return criar


def consultar(client, contas, params=None, conta="voluntario"):
    return client.get(
        URL,
        params=SEMANA if params is None else params,
        headers=autenticar(client, contas, conta),
    )


def test_retorna_todos_os_encontros_ativos_em_ordem_e_sem_contatos(
    client,
    db,
    contas,
    criar_candidatura,
):
    ong = contas["organizacao"]
    ong.telefone = "61988887777"
    ong.responsavel = "Responsável Reservado"
    primeira = criar_candidatura(
        [
            ("2026-11-20T12:00:00Z", "2026-11-20T15:00:00Z"),
            ("2026-11-16T12:00:00Z", "2026-11-16T15:00:00Z"),
        ]
    )
    segunda = criar_candidatura(
        [("2026-11-18T18:00:00Z", "2026-11-18T20:00:00Z")],
        status=StatusCandidatura.ACEITA,
    )
    db.expire_all()

    resposta = consultar(client, contas)

    assert resposta.status_code == 200
    eventos = resposta.json()
    assert [e["candidatura_id"] for e in eventos] == [
        primeira.id,
        segunda.id,
        primeira.id,
    ]
    assert [e["inicio"] for e in eventos] == [
        "2026-11-16T12:00:00Z",
        "2026-11-18T18:00:00Z",
        "2026-11-20T12:00:00Z",
    ]
    assert eventos[0] == {
        "candidatura_id": primeira.id,
        "vaga_id": primeira.vaga_id,
        "titulo_vaga": "Oficina de leitura",
        "organizacao": {"id": ong.id, "nome": ong.nome},
        "status": "PENDENTE",
        "inicio": "2026-11-16T12:00:00Z",
        "fim": "2026-11-16T15:00:00Z",
    }
    for reservado in (ong.email, ong.telefone, ong.responsavel, ong.senha_hash):
        assert reservado not in resposta.text
    assert resposta.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("status", list(StatusCandidatura))
def test_apenas_pendentes_e_aceitas_ocupam_a_agenda(
    client,
    contas,
    criar_candidatura,
    status,
):
    candidatura = criar_candidatura(status=status)
    eventos = consultar(client, contas).json()
    if status in (StatusCandidatura.PENDENTE, StatusCandidatura.ACEITA):
        assert [e["candidatura_id"] for e in eventos] == [candidatura.id]
    else:
        assert eventos == []


@pytest.mark.parametrize("estado_vaga", [StatusVaga.ENCERRADA, StatusVaga.SUSPENSA])
def test_estado_da_vaga_nao_apaga_um_compromisso_ativo(
    client,
    contas,
    criar_candidatura,
    estado_vaga,
):
    candidatura = criar_candidatura(estado_vaga=estado_vaga)
    eventos = consultar(client, contas).json()
    assert [e["candidatura_id"] for e in eventos] == [candidatura.id]


@pytest.mark.parametrize(
    ("inicio", "fim", "incluido"),
    [
        ("2026-11-16T02:00:00Z", "2026-11-16T03:00:00Z", False),
        ("2026-11-16T03:00:00Z", "2026-11-16T04:00:00Z", True),
        ("2026-11-17T02:30:00Z", "2026-11-17T03:30:00Z", True),
        ("2026-11-17T03:00:00Z", "2026-11-17T04:00:00Z", False),
        ("2026-11-16T01:00:00Z", "2026-11-18T05:00:00Z", True),
    ],
)
def test_limites_do_dia_de_brasilia_e_encontros_entre_dias(
    client,
    contas,
    criar_candidatura,
    inicio,
    fim,
    incluido,
):
    criar_candidatura([(inicio, fim)])
    eventos = consultar(
        client,
        contas,
        {"inicio": "2026-11-16", "fim": "2026-11-17"},
    ).json()
    assert len(eventos) == int(incluido)
    if incluido:
        # O intervalo original deve ser preservado, inclusive fora dos limites do dia.
        assert eventos[0]["inicio"] == inicio
        assert eventos[0]["fim"] == fim


def test_consulta_historica_considera_as_regras_do_fuso_e_nao_offset_fixo(
    client,
    contas,
    criar_candidatura,
):
    # Em 04/11/2018 São Paulo entrou no horário de verão (UTC-02).
    criar_candidatura(
        [
            ("2018-11-04T02:00:00Z", "2018-11-04T02:30:00Z"),
            ("2018-11-04T03:00:00Z", "2018-11-04T04:00:00Z"),
            ("2018-11-05T02:00:00Z", "2018-11-05T03:00:00Z"),
        ]
    )
    resposta = consultar(
        client,
        contas,
        {"inicio": "2018-11-04", "fim": "2018-11-05"},
    )
    assert resposta.status_code == 200
    assert [e["inicio"] for e in resposta.json()] == ["2018-11-04T03:00:00Z"]


def test_agenda_vazia(client, contas):
    resposta = consultar(client, contas)
    assert resposta.status_code == 200
    assert resposta.json() == []


def test_filtra_ocorrencias_fora_do_intervalo(client, contas, criar_candidatura):
    criar_candidatura(
        [
            ("2026-11-15T12:00:00Z", "2026-11-15T15:00:00Z"),
            ("2026-11-16T12:00:00Z", "2026-11-16T15:00:00Z"),
            ("2026-11-23T12:00:00Z", "2026-11-23T15:00:00Z"),
        ]
    )
    eventos = consultar(client, contas).json()
    assert [e["inicio"] for e in eventos] == ["2026-11-16T12:00:00Z"]


def test_calendario_deriva_dos_estados_e_ocorrencias_atuais(
    client,
    db,
    contas,
    criar_candidatura,
):
    candidatura = criar_candidatura()
    assert len(consultar(client, contas).json()) == 1
    candidatura.vaga.ocorrencias[0].fim = datetime.fromisoformat("2026-11-16T16:00:00Z")
    db.flush()
    assert consultar(client, contas).json()[0]["fim"] == "2026-11-16T16:00:00Z"
    candidatura.status = StatusCandidatura.CANCELADA
    db.flush()
    assert consultar(client, contas).json() == []


def test_duas_contas_consultam_somente_a_propria_agenda(
    client,
    db,
    contas,
    senha_hash,
    criar_candidatura,
):
    outra = Voluntario(
        nome="Outra conta", email="outra@example.com", senha_hash=senha_hash
    )
    db.add(outra)
    db.flush()
    contas["outra"] = outra
    primeira = criar_candidatura()
    segunda = criar_candidatura(voluntario=outra)

    for conta, esperado in [("voluntario", primeira.id), ("outra", segunda.id)]:
        eventos = consultar(client, contas, conta=conta).json()
        assert [e["candidatura_id"] for e in eventos] == [esperado]


@pytest.mark.parametrize("titular", ["voluntario_id", "usuario_id", "id"])
def test_nao_aceita_titular_pela_query(client, contas, titular):
    assert consultar(client, contas, {**SEMANA, titular: 999}).status_code == 422


def test_sem_token_ou_com_token_invalido(client):
    assert client.get(URL, params=SEMANA).status_code == 401
    assert (
        client.get(
            URL,
            params=SEMANA,
            headers={"Authorization": "Bearer invalido"},
        ).status_code
        == 401
    )


@pytest.mark.parametrize("conta", ["organizacao", "administrador", "projeto"])
def test_recurso_exclusivo_de_voluntario(client, contas, conta):
    assert consultar(client, contas, conta=conta).status_code == 403


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"inicio": "2026-11-16"},
        {"fim": "2026-11-23"},
        {"inicio": "2026-11-16", "fim": "2026-11-16"},
        {"inicio": "2026-11-23", "fim": "2026-11-16"},
        {"inicio": "2026-02-29", "fim": "2026-03-01"},
        {"inicio": "2026-11-31", "fim": "2026-12-01"},
        {"inicio": "2026-11-16T00:00:00Z", "fim": "2026-11-23"},
        {"inicio": "2026-11-16", "fim": "2026-11-23T00:00:00-03:00"},
        {"inicio": "16/11/2026", "fim": "2026-11-23"},
        {"inicio": "1794787200", "fim": "2026-11-23"},
        {"inicio": "2026-1-6", "fim": "2026-11-23"},
        {"inicio": "", "fim": "2026-11-23"},
    ],
)
def test_parametros_invalidos_retornam_422(client, contas, params):
    resposta = consultar(client, contas, params)
    assert resposta.status_code == 422
    assert resposta.json()["detail"]


def test_unicidade_da_candidatura_no_banco(db, criar_candidatura):
    original = criar_candidatura()
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(
            Candidatura(voluntario_id=original.voluntario_id, vaga_id=original.vaga_id)
        )
        db.flush()
    assert db.scalars(select(Candidatura)).all() == [original]


def test_candidatura_exige_voluntario_existente(db, criar_candidatura):
    original = criar_candidatura()
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(Candidatura(voluntario_id=999999, vaga_id=original.vaga_id))
        db.flush()
