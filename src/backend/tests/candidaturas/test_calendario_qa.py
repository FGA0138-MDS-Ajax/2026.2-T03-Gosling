"""Issue #51 (CN10-RF26): calendário, intervalos e acesso à própria agenda.

Casos de teste CT08 e CT13 do Documento de Visão.

Complementa tests/candidaturas/test_calendario.py com os casos que ele não cobre.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.candidaturas.enums import StatusCandidatura
from app.core.config import get_jwt_secret
from app.core.security import JWT_ALGORITHM
from tests.candidaturas.test_calendario import URL, consultar
from tests.vagas.test_publicacao import autenticar

pytest_plugins = ["tests.candidaturas.test_calendario"]

CAMPOS_DO_EVENTO = {
    "candidatura_id",
    "vaga_id",
    "titulo_vaga",
    "organizacao",
    "status",
    "inicio",
    "fim",
}


def token(user_id, perfil, *, segredo=None, expira_em=timedelta(minutes=30)):
    agora = datetime.now(UTC)
    return jwt.encode(
        {"sub": str(user_id), "perfil": perfil, "iat": agora, "exp": agora + expira_em},
        segredo or get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


# Critério 1 — apenas candidaturas ativas e todas as ocorrências do intervalo


def test_mistura_de_status_mostra_so_as_ativas_em_ordem_cronologica(
    client, contas, criar_candidatura
):
    aceita = criar_candidatura(
        [("2026-11-19T12:00:00Z", "2026-11-19T14:00:00Z")],
        status=StatusCandidatura.ACEITA,
    )
    criar_candidatura(
        [("2026-11-17T12:00:00Z", "2026-11-17T14:00:00Z")],
        status=StatusCandidatura.RECUSADA,
    )
    pendente = criar_candidatura([("2026-11-16T12:00:00Z", "2026-11-16T14:00:00Z")])
    criar_candidatura(
        [("2026-11-18T12:00:00Z", "2026-11-18T14:00:00Z")],
        status=StatusCandidatura.CANCELADA,
    )

    eventos = consultar(client, contas).json()

    assert [(e["candidatura_id"], e["status"]) for e in eventos] == [
        (pendente.id, "PENDENTE"),
        (aceita.id, "ACEITA"),
    ]


def test_traz_todas_as_ocorrencias_do_mes_e_nenhuma_de_fora(
    client, contas, criar_candidatura
):
    semanais = [
        (f"2026-11-{dia:02d}T13:00:00Z", f"2026-11-{dia:02d}T16:00:00Z")
        for dia in (2, 9, 16, 23, 30)
    ]
    fora = [
        ("2026-10-26T13:00:00Z", "2026-10-26T16:00:00Z"),
        ("2026-12-07T13:00:00Z", "2026-12-07T16:00:00Z"),
    ]
    candidatura = criar_candidatura(fora[:1] + semanais + fora[1:])

    eventos = consultar(
        client, contas, {"inicio": "2026-11-01", "fim": "2026-12-01"}
    ).json()

    assert [(e["inicio"], e["fim"]) for e in eventos] == semanais
    assert {e["candidatura_id"] for e in eventos} == {candidatura.id}


def test_resposta_segue_o_contrato_e_nao_fica_em_cache(
    client, contas, criar_candidatura
):
    criar_candidatura()

    resposta = consultar(client, contas)

    assert resposta.status_code == 200
    assert resposta.headers["Cache-Control"] == "no-store"
    evento = resposta.json()[0]
    assert set(evento) == CAMPOS_DO_EVENTO
    assert set(evento["organizacao"]) == {"id", "nome"}
    assert evento["organizacao"]["nome"] == contas["organizacao"].nome


# Critério 2 — intervalo vazio, limites, parâmetros ausentes e datas inválidas


def test_intervalo_sem_encontros_retorna_lista_vazia_mesmo_com_candidaturas(
    client, contas, criar_candidatura
):
    criar_candidatura([("2026-11-10T12:00:00Z", "2026-11-10T15:00:00Z")])
    criar_candidatura([("2026-11-25T12:00:00Z", "2026-11-25T15:00:00Z")])

    resposta = consultar(client, contas)

    assert resposta.status_code == 200
    assert resposta.json() == []


def test_encontro_que_comeca_a_meia_noite_do_fim_fica_de_fora(
    client, contas, criar_candidatura
):
    # 23/11 00:00 em Brasília = 03:00Z: é o fim exclusivo da semana consultada.
    criar_candidatura(
        [
            ("2026-11-23T02:59:00Z", "2026-11-23T03:30:00Z"),
            ("2026-11-23T03:00:00Z", "2026-11-23T04:00:00Z"),
        ]
    )

    eventos = consultar(client, contas).json()

    assert [e["inicio"] for e in eventos] == ["2026-11-23T02:59:00Z"]


def test_intervalo_que_atravessa_o_ano(client, contas, criar_candidatura):
    criar_candidatura(
        [
            ("2026-12-31T22:00:00Z", "2027-01-01T02:00:00Z"),
            ("2027-01-02T12:00:00Z", "2027-01-02T15:00:00Z"),
        ]
    )

    eventos = consultar(
        client, contas, {"inicio": "2026-12-28", "fim": "2027-01-04"}
    ).json()

    assert [e["inicio"] for e in eventos] == [
        "2026-12-31T22:00:00Z",
        "2027-01-02T12:00:00Z",
    ]


def test_29_de_fevereiro_e_valido_em_ano_bissexto(client, contas):
    resposta = consultar(client, contas, {"inicio": "2028-02-29", "fim": "2028-03-01"})
    assert resposta.status_code == 200
    assert resposta.json() == []


@pytest.mark.parametrize(
    "params",
    [
        {"inicio": "2026-11-16", "fim": "2026-11-23", "pagina": "2"},
        {"inicio": "2026-13-01", "fim": "2027-01-01"},
        {"inicio": "2026-11-16", "fim": "2026-11-00"},
        {"inicio": " 2026-11-16", "fim": "2026-11-23"},
        {"inicio": "2026-11-16", "fim": "amanhã"},
    ],
)
def test_outros_parametros_invalidos_retornam_422(client, contas, params):
    resposta = consultar(client, contas, params)
    assert resposta.status_code == 422
    assert resposta.json()["detail"]


# Critério 3 — sem autenticação, outro perfil e agenda de outro titular


def test_token_expirado_e_recusado(client, contas):
    vencido = token(
        contas["voluntario"].id, "VOLUNTARIO", expira_em=timedelta(minutes=-1)
    )
    resposta = client.get(
        URL,
        params={"inicio": "2026-11-16", "fim": "2026-11-23"},
        headers={"Authorization": f"Bearer {vencido}"},
    )
    assert resposta.status_code == 401


def test_token_assinado_com_outra_chave_e_recusado(client, contas):
    falso = token(
        contas["voluntario"].id,
        "VOLUNTARIO",
        segredo="chave-que-nao-e-a-do-servidor-0123456789",
    )
    resposta = client.get(
        URL,
        params={"inicio": "2026-11-16", "fim": "2026-11-23"},
        headers={"Authorization": f"Bearer {falso}"},
    )
    assert resposta.status_code == 401


def test_perfil_alterado_no_token_nao_da_acesso_a_agenda(client, contas):
    # Token válido da organização, mas com o perfil trocado para VOLUNTARIO.
    adulterado = token(contas["organizacao"].id, "VOLUNTARIO")
    resposta = client.get(
        URL,
        params={"inicio": "2026-11-16", "fim": "2026-11-23"},
        headers={"Authorization": f"Bearer {adulterado}"},
    )
    assert resposta.status_code in (401, 403)


def test_conta_desativada_perde_acesso_mesmo_com_token_valido(
    client, db, contas, criar_candidatura
):
    criar_candidatura()
    headers = autenticar(client, contas, "voluntario")
    assert (
        client.get(
            URL, params={"inicio": "2026-11-16", "fim": "2026-11-23"}, headers=headers
        ).status_code
        == 200
    )
    contas["voluntario"].ativo = False
    db.flush()

    resposta = client.get(
        URL, params={"inicio": "2026-11-16", "fim": "2026-11-23"}, headers=headers
    )

    assert resposta.status_code == 401
    assert "Oficina de leitura" not in resposta.text


def test_titular_vem_so_do_token_e_nao_da_query(
    client, db, contas, senha_hash, criar_candidatura
):
    from app.usuarios.models import Voluntario

    outra = Voluntario(
        nome="Outra conta", email="outra@example.com", senha_hash=senha_hash
    )
    db.add(outra)
    db.flush()
    criar_candidatura(voluntario=outra)

    propria = consultar(client, contas)
    tentativa = consultar(
        client,
        contas,
        {"inicio": "2026-11-16", "fim": "2026-11-23", "voluntario_id": str(outra.id)},
    )

    assert propria.json() == []
    assert tentativa.status_code == 422
