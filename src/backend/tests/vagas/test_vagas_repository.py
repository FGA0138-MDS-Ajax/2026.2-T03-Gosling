import unicodedata
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError

from app.usuarios.catalogos import Causa
from app.usuarios.enums import TipoOrganizacao
from app.usuarios.models import Organizacao, Voluntario
from app.vagas.enums import Modalidade, Periodo, StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga
from app.vagas.repository import VagaRepository


def normalizar(nome: str) -> str:
    return unicodedata.normalize("NFKC", nome).casefold()


def criar_organizacao(
    db, senha_hash, email, ativo=True, homologada=True
) -> Organizacao:
    organizacao = Organizacao(
        nome=f"Org {email}",
        email=email,
        senha_hash=senha_hash,
        tipo=TipoOrganizacao.ONG,
    )
    organizacao.ativo = ativo
    organizacao.homologada = homologada
    db.add(organizacao)
    db.flush()
    return organizacao


def criar_causa(db, nome="Educação") -> Causa:
    causa = Causa(nome=nome, nome_normalizado=normalizar(nome))
    db.add(causa)
    db.flush()
    return causa


def montar_vaga(
    organizacao, causa, titulo="Vaga de teste", status=StatusVaga.ABERTA
) -> Vaga:
    return Vaga(
        titulo=titulo,
        descricao="Descrição da vaga de teste",
        atividades="Atividades da vaga de teste",
        modalidade=next(iter(Modalidade)),
        local="Brasília",
        periodo=next(iter(Periodo)),
        carga_horaria=Decimal("4.00"),
        numero_vagas=2,
        organizacao=organizacao,
        causa=causa,
        status=status,
        ocorrencias=[
            OcorrenciaVaga(
                inicio=datetime(2026, 12, 1, 13, 0, tzinfo=UTC),
                fim=datetime(2026, 12, 1, 17, 0, tzinfo=UTC),
            )
        ],
    )


def outro_status() -> StatusVaga:
    for status in StatusVaga:
        if status is not StatusVaga.ABERTA:
            return status
    pytest.skip("StatusVaga só possui o valor ABERTA.")


def contar_causas(db, nome_normalizado: str) -> int:
    consulta = select(func.count(Causa.id)).where(
        Causa.nome_normalizado == nome_normalizado
    )
    return db.execute(consulta).scalar_one()


def simular_busca_vazia(monkeypatch, session, quantidade: int) -> None:
    original = session.scalar
    chamadas = []

    def scalar(*args, **kwargs):
        chamadas.append(1)
        if len(chamadas) <= quantidade:
            return None
        return original(*args, **kwargs)

    monkeypatch.setattr(session, "scalar", scalar)


@pytest.fixture
def repo(db):
    return VagaRepository(db)


@pytest.fixture
def organizacao(db, senha_hash):
    return criar_organizacao(db, senha_hash, "ong-repo@example.com")


@pytest.fixture
def causa(db):
    return criar_causa(db)


@pytest.fixture
def requer_unicidade_da_causa(db):
    inspetor = inspect(db.connection())
    tabela = Causa.__tablename__
    colunas = [
        item["column_names"] for item in inspetor.get_unique_constraints(tabela)
    ]
    colunas += [
        item["column_names"]
        for item in inspetor.get_indexes(tabela)
        if item["unique"]
    ]
    if ["nome_normalizado"] not in colunas:
        pytest.skip("Causa.nome_normalizado não tem restrição de unicidade.")


def test_buscar_organizacao_retorna_a_organizacao_pelo_id(repo, organizacao):
    encontrada = repo.buscar_organizacao(organizacao.id)

    assert encontrada is not None
    assert encontrada.id == organizacao.id


def test_buscar_organizacao_retorna_none_para_id_inexistente(repo):
    assert repo.buscar_organizacao(999999) is None


def test_buscar_organizacao_retorna_none_quando_o_id_e_de_voluntario(
    repo, db, senha_hash
):
    voluntario = Voluntario(
        nome="Ana", email="ana-repo@example.com", senha_hash=senha_hash
    )
    db.add(voluntario)
    db.flush()

    assert repo.buscar_organizacao(voluntario.id) is None


def test_obter_ou_criar_causa_cria_causa_nova(repo, db):
    causa = repo.obter_ou_criar_causa("Saúde")

    assert causa.id is not None
    assert causa.nome == "Saúde"
    assert causa.nome_normalizado == normalizar("Saúde")
    assert contar_causas(db, normalizar("Saúde")) == 1


def test_obter_ou_criar_causa_reaproveita_ignorando_caixa(repo, db):
    existente = criar_causa(db, "Educação")

    retornada = repo.obter_ou_criar_causa("EDUCAÇÃO")

    assert retornada.id == existente.id
    assert contar_causas(db, normalizar("Educação")) == 1


def test_obter_ou_criar_causa_recupera_a_causa_criada_por_outra_transacao(
    repo, db, monkeypatch, requer_unicidade_da_causa
):
    existente = criar_causa(db, "Meio Ambiente")
    simular_busca_vazia(monkeypatch, db, quantidade=1)

    retornada = repo.obter_ou_criar_causa("Meio Ambiente")

    assert retornada.id == existente.id
    assert contar_causas(db, normalizar("Meio Ambiente")) == 1


def test_obter_ou_criar_causa_propaga_erro_quando_nao_encontra_a_causa(
    repo, db, monkeypatch, requer_unicidade_da_causa
):
    criar_causa(db, "Cultura")
    simular_busca_vazia(monkeypatch, db, quantidade=10**6)

    with pytest.raises(IntegrityError):
        repo.obter_ou_criar_causa("Cultura")


def test_adicionar_persiste_a_vaga_e_gera_o_id(repo, organizacao, causa):
    vaga = montar_vaga(organizacao, causa)

    repo.adicionar(vaga)

    assert vaga.id is not None


def test_listar_publicas_sem_vagas_retorna_lista_vazia_e_total_zero(repo):
    vagas, total = repo.listar_publicas(pagina=1, por_pagina=10)

    assert vagas == []
    assert total == 0


def test_listar_publicas_retorna_somente_vagas_abertas(repo, organizacao, causa):
    repo.adicionar(montar_vaga(organizacao, causa, titulo="Aberta"))
    repo.adicionar(
        montar_vaga(organizacao, causa, titulo="Outra", status=outro_status())
    )

    vagas, total = repo.listar_publicas(pagina=1, por_pagina=10)

    assert total == 1
    assert [vaga.titulo for vaga in vagas] == ["Aberta"]


def test_listar_publicas_ignora_vagas_de_organizacao_inativa(
    repo, db, senha_hash, organizacao, causa
):
    inativa = criar_organizacao(db, senha_hash, "inativa@example.com", ativo=False)
    repo.adicionar(montar_vaga(organizacao, causa, titulo="Da ativa"))
    repo.adicionar(montar_vaga(inativa, causa, titulo="Da inativa"))

    vagas, total = repo.listar_publicas(pagina=1, por_pagina=10)

    assert total == 1
    assert [vaga.titulo for vaga in vagas] == ["Da ativa"]


def test_listar_publicas_ignora_vagas_de_organizacao_nao_homologada(
    repo, db, senha_hash, organizacao, causa
):
    pendente = criar_organizacao(
        db, senha_hash, "pendente@example.com", homologada=False
    )
    repo.adicionar(montar_vaga(organizacao, causa, titulo="Da homologada"))
    repo.adicionar(montar_vaga(pendente, causa, titulo="Da pendente"))

    vagas, total = repo.listar_publicas(pagina=1, por_pagina=10)

    assert total == 1
    assert [vaga.titulo for vaga in vagas] == ["Da homologada"]


def test_listar_publicas_ordena_da_mais_recente_para_a_mais_antiga(
    repo, organizacao, causa
):
    for titulo in ("A", "B", "C"):
        repo.adicionar(montar_vaga(organizacao, causa, titulo=titulo))

    vagas, _ = repo.listar_publicas(pagina=1, por_pagina=10)

    assert [vaga.titulo for vaga in vagas] == ["C", "B", "A"]


@pytest.fixture
def cinco_vagas(repo, organizacao, causa):
    for numero in range(1, 6):
        repo.adicionar(montar_vaga(organizacao, causa, titulo=f"Vaga {numero}"))


def test_listar_publicas_retorna_a_fatia_da_pagina_e_o_total(repo, cinco_vagas):
    vagas, total = repo.listar_publicas(pagina=2, por_pagina=2)

    assert total == 5
    assert [vaga.titulo for vaga in vagas] == ["Vaga 3", "Vaga 2"]


def test_listar_publicas_ultima_pagina_pode_ter_menos_itens(repo, cinco_vagas):
    vagas, total = repo.listar_publicas(pagina=3, por_pagina=2)

    assert total == 5
    assert [vaga.titulo for vaga in vagas] == ["Vaga 1"]


def test_listar_publicas_pagina_alem_do_fim_retorna_vazio(repo, cinco_vagas):
    vagas, total = repo.listar_publicas(pagina=4, por_pagina=2)

    assert vagas == []
    assert total == 5


def repo_com_sessao_simulada(total=5, linhas=None):
    session = MagicMock()
    resultado = session.execute.return_value
    resultado.scalar_one.return_value = total
    resultado.mappings.return_value.all.return_value = linhas or []
    return VagaRepository(session), session


def test_listar_vagas_por_organizacao_retorna_linhas_como_dicts_e_total():
    repo, _ = repo_com_sessao_simulada(
        total=5, linhas=[{"id": 1, "titulo": "Vaga A"}]
    )

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert vagas == [{"id": 1, "titulo": "Vaga A"}]
    assert total == 5


def test_listar_vagas_por_organizacao_sem_vagas_retorna_vazio_e_total_zero():
    repo, _ = repo_com_sessao_simulada(total=0, linhas=[])

    vagas, total = repo.listar_vagas_por_organizacao(organizacao_id=10)

    assert vagas == []
    assert total == 0


def test_confirmar_faz_commit_da_sessao():
    session = MagicMock()

    VagaRepository(session).confirmar()

    session.commit.assert_called_once_with()


def test_desfazer_faz_rollback_da_sessao():
    session = MagicMock()

    VagaRepository(session).desfazer()

    session.rollback.assert_called_once_with()
