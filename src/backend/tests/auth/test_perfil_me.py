from unittest.mock import MagicMock
import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.voluntarios.me.repository import VoluntarioEntity, VoluntarioRepository
from app.voluntarios.me.router import (
    atualizar_meu_perfil,
    get_usuario_logado,
    obter_meu_perfil,
)
from app.voluntarios.me.schemas import (
    AtualizaPerfilUsuariosRequest,
    CadastroVoluntarioRequest,
)
from app.voluntarios.me.service import (
    ALGORITHM,
    SECRET_KEY,
    ConsentimentoObrigatorioException,
    EmailJaCadastradoException,
    IdentificacaoJaCadastradaException,
    VoluntarioNaoEncontradoException,
    VoluntarioService,
)


@pytest.fixture
def repository_mock():
    return MagicMock()


@pytest.fixture
def service_mock():
    return MagicMock()


@pytest.fixture
def service_real(repository_mock):
    return VoluntarioService(voluntario_repository=repository_mock)


@pytest.fixture
def credenciais_validas():
    token = jwt.encode(
        {"sub": "123"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=token,
    )


# =====================================================
# AUTENTICAÇÃO JWT E DEPENDÊNCIA
# =====================================================

def test_get_usuario_logado_token_valido(credenciais_validas):
    resultado = get_usuario_logado(credenciais_validas)
    assert resultado == "123"


def test_get_usuario_logado_token_sem_sub():
    token = jwt.encode(
        {"email": "teste@email.com"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    credenciais = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=token,
    )
    with pytest.raises(HTTPException) as exc:
        get_usuario_logado(credenciais)

    assert exc.value.status_code == 401
    assert "sub" in exc.value.detail


def test_get_usuario_logado_token_expirado():
    token = jwt.encode(
        {"sub": "123", "exp": 1},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    credenciais = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=token,
    )
    with pytest.raises(HTTPException) as exc:
        get_usuario_logado(credenciais)

    assert exc.value.status_code == 401
    assert "expirado" in exc.value.detail.lower()


def test_get_usuario_logado_token_invalido():
    credenciais = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="token_invalido",
    )
    with pytest.raises(HTTPException) as exc:
        get_usuario_logado(credenciais)

    assert exc.value.status_code == 401
    assert "inválido" in exc.value.detail.lower()


# =====================================================
# TESTES DE ROUTER (ENDPOINTS /ME) - USANDO service_mock
# =====================================================

def test_obter_meu_perfil_sucesso(service_mock):
    perfil = MagicMock()
    service_mock.obter_perfil_por_id.return_value = perfil

    resultado = obter_meu_perfil(
        voluntario_id="123",
        service=service_mock,
    )

    assert resultado == perfil
    service_mock.obter_perfil_por_id.assert_called_once_with("123")


def test_obter_meu_perfil_nao_encontrado(service_mock):
    service_mock.obter_perfil_por_id.side_effect = VoluntarioNaoEncontradoException(
        "Voluntário não encontrado."
    )

    with pytest.raises(HTTPException) as exc:
        obter_meu_perfil(
            voluntario_id="123",
            service=service_mock,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Voluntário não encontrado."


def test_atualizar_meu_perfil_sucesso(service_mock):
    dados = MagicMock()
    perfil_atualizado = MagicMock()
    service_mock.atualizar_perfil.return_value = perfil_atualizado

    resultado = atualizar_meu_perfil(
        dados=dados,
        voluntario_id="123",
        service=service_mock,
    )

    assert resultado == perfil_atualizado
    service_mock.atualizar_perfil.assert_called_once_with(
        voluntario_id="123",
        dados=dados,
    )


def test_atualizar_meu_perfil_nao_encontrado(service_mock):
    dados = MagicMock()
    service_mock.atualizar_perfil.side_effect = VoluntarioNaoEncontradoException(
        "Voluntário não encontrado."
    )

    with pytest.raises(HTTPException) as exc:
        atualizar_meu_perfil(
            dados=dados,
            voluntario_id="123",
            service=service_mock,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Voluntário não encontrado."


# =====================================================
# TESTES DE REGRAS DE NEGÓCIO (SERVICE) - USANDO service_real
# =====================================================

def test_desserializar_lista_formatos(service_real):
    esperado = ["Educação", "Saúde"]

    assert service_real._desserializar_lista([]) == []
    assert service_real._desserializar_lista(["Educação"]) == ["Educação"]
    assert service_real._desserializar_lista('["Educação", "Saúde"]') == esperado
    assert service_real._desserializar_lista("Educação, Saúde") == esperado
    assert service_real._desserializar_lista("invalid_json{") == ["invalid_json{"]

def test_obter_perfil_por_id_service_sucesso(service_real, repository_mock):
    entidade = VoluntarioEntity(
        id="123",
        nome_completo="João Silva",
        email="joao@email.com",
        identificacao="12345678901",
        perfil="Voluntario",
        ativo=True,
        password_hash="hash",
        causas='["Educação"]',
        disponibilidades='["Fins de Semana"]',
    )
    repository_mock.buscar_perfil_por_id.return_value = entidade

    res = service_real.obter_perfil_por_id("123")
    assert res.id == "123"
    assert res.causas == ["Educação"]


def test_obter_perfil_por_id_service_nao_encontrado(service_real, repository_mock):
    repository_mock.buscar_perfil_por_id.return_value = None
    with pytest.raises(VoluntarioNaoEncontradoException):
        service_real.obter_perfil_por_id("999")


def test_atualizar_perfil_service_sucesso(service_real, repository_mock):
    entidade = VoluntarioEntity(
        id="123",
        nome_completo="João Silva",
        email="joao@email.com",
        identificacao="12345678901",
        perfil="Voluntario",
        ativo=True,
        password_hash="hash",
    )
    repository_mock.buscar_perfil_por_id.return_value = entidade
    repository_mock.atualizar_perfil.return_value = entidade

    dados = AtualizaPerfilUsuariosRequest(cidade="Brasília")
    res = service_real.atualizar_perfil("123", dados)
    assert res.id == "123"


def test_atualizar_perfil_service_nao_encontrado(service_real, repository_mock):
    repository_mock.buscar_perfil_por_id.return_value = None
    dados = AtualizaPerfilUsuariosRequest(cidade="Brasília")
    with pytest.raises(VoluntarioNaoEncontradoException):
        service_real.atualizar_perfil("999", dados)


def test_atualizar_perfil_falha_recuperacao(service_real, repository_mock):
    entidade = VoluntarioEntity(
        id="123",
        nome_completo="João Silva",
        email="joao@email.com",
        identificacao="12345678901",
        perfil="Voluntario",
        ativo=True,
        password_hash="hash",
    )
    repository_mock.buscar_perfil_por_id.return_value = entidade
    repository_mock.atualizar_perfil.return_value = None

    dados = AtualizaPerfilUsuariosRequest(cidade="Brasília")
    with pytest.raises(VoluntarioNaoEncontradoException):
        service_real.atualizar_perfil("123", dados)


def test_cadastrar_voluntario_sem_consentimento(service_real):
    dados = CadastroVoluntarioRequest(
        nome_completo="Maria",
        email="maria@email.com",
        identificacao="12345678901",
        password="Password123",
        consentimento_termos=False,
    )
    with pytest.raises(ConsentimentoObrigatorioException):
        service_real.cadastrar_voluntario(dados)


def test_cadastrar_voluntario_email_duplicado(service_real, repository_mock):
    dados = CadastroVoluntarioRequest(
        nome_completo="Maria",
        email="maria@email.com",
        identificacao="12345678901",
        password="Password123",
        consentimento_termos=True,
    )
    repository_mock.buscar_por_email.return_value = MagicMock()
    with pytest.raises(EmailJaCadastradoException):
        service_real.cadastrar_voluntario(dados)


def test_cadastrar_voluntario_identificacao_duplicada(service_real, repository_mock):
    dados = CadastroVoluntarioRequest(
        nome_completo="Maria",
        email="maria@email.com",
        identificacao="12345678901",
        password="Password123",
        consentimento_termos=True,
    )
    repository_mock.buscar_por_email.return_value = None
    repository_mock.buscar_por_identificador.return_value = MagicMock()
    with pytest.raises(IdentificacaoJaCadastradaException):
        service_real.cadastrar_voluntario(dados)


# =====================================================
# TESTES DIRETOS DO REPOSITÓRIO (COBRINDO repository.py)
# =====================================================

@pytest.fixture
def mock_db():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    return conn, cursor


def test_repository_buscar_por_email_sem_conexao():
    repo = VoluntarioRepository(db_connection=None)
    assert repo.buscar_por_email("teste@email.com") is None


def test_repository_buscar_por_email_nao_encontrado(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = None
    repo = VoluntarioRepository(db_connection=conn)
    assert repo.buscar_por_email("ausente@email.com") is None


def test_repository_buscar_por_email_sucesso(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = {
        "id": "123",
        "nome_completo": "João Silva",
        "email": "joao@email.com",
        "identificacao": "12345678901",
        "password_hash": "hash123",
        "consentimento_termos": 1,
        "perfil": "Voluntario",
        "ativo": 1,
    }
    repo = VoluntarioRepository(db_connection=conn)
    res = repo.buscar_por_email("JOAO@email.com")
    assert res is not None
    assert res.id == "123"


def test_repository_buscar_por_identificador_sem_conexao():
    repo = VoluntarioRepository(db_connection=None)
    assert repo.buscar_por_identificador("12345678901") is None


def test_repository_buscar_por_identificador_nao_encontrado(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = None
    repo = VoluntarioRepository(db_connection=conn)
    assert repo.buscar_por_identificador("00000000000") is None


def test_repository_buscar_por_identificador_sucesso(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = {
        "id": "123",
        "nome_completo": "João Silva",
        "email": "joao@email.com",
        "identificacao": "12345678901",
        "password_hash": "hash123",
        "consentimento_termos": True,
        "perfil": "Voluntario",
        "ativo": True,
    }
    repo = VoluntarioRepository(db_connection=conn)
    res = repo.buscar_por_identificador(" 12345678901 ")
    assert res is not None
    assert res.identificacao == "12345678901"


def test_repository_salvar_sem_conexao():
    entidade = VoluntarioEntity(
        id="123",
        nome_completo="João",
        email="joao@email.com",
        identificacao="123",
        perfil="Voluntario",
        ativo=True,
        password_hash="hash",
    )
    repo = VoluntarioRepository(db_connection=None)
    assert repo.salvar(entidade) == entidade


def test_repository_salvar_sucesso(mock_db):
    conn, cursor = mock_db
    entidade = VoluntarioEntity(
        id="123",
        nome_completo="João Silva",
        email="JOAO@email.com",
        identificacao="12345678901",
        perfil="Voluntario",
        ativo=True,
        password_hash="hash123",
        consentimento_termos=True,
    )
    repo = VoluntarioRepository(db_connection=conn)
    res = repo.salvar(entidade)
    assert res == entidade
    conn.commit.assert_called_once()


def test_repository_buscar_perfil_por_id_sem_conexao():
    repo = VoluntarioRepository(db_connection=None)
    assert repo.buscar_perfil_por_id("123") is None


def test_repository_buscar_perfil_por_id_nao_encontrado(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = None
    repo = VoluntarioRepository(db_connection=conn)
    assert repo.buscar_perfil_por_id("999") is None


def test_repository_buscar_perfil_por_id_sucesso(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = {
        "id": "123",
        "nome_completo": "João Silva",
        "email": "joao@email.com",
        "identificacao": "12345678901",
        "perfil": "Voluntario",
        "ativo": 1,
        "password_hash": "hash123",
        "consentimento_termos": True,
        "telefone": "61999999999",
        "cidade": "Gama",
        "estado": "DF",
        "biografia": "Dev",
        "causas": '["Educação"]',
        "disponibilidades": '["Fins de Semana"]',
    }
    repo = VoluntarioRepository(db_connection=conn)
    res = repo.buscar_perfil_por_id("123")
    assert res is not None
    assert res.cidade == "Gama"
    assert res.causas == ["Educação"]


def test_repository_atualizar_perfil_sem_conexao():
    repo = VoluntarioRepository(db_connection=None)
    assert repo.atualizar_perfil("123", {"cidade": "Gama"}) is None


def test_repository_atualizar_perfil_sem_campos_para_atualizar(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = {
        "id": "123",
        "nome_completo": "João",
        "email": "joao@email.com",
        "identificacao": "123",
        "perfil": "Voluntario",
        "ativo": True,
        "password_hash": "hash",
    }
    repo = VoluntarioRepository(db_connection=conn)
    res = repo.atualizar_perfil("123", {})
    assert res is not None


def test_repository_atualizar_perfil_sucesso(mock_db):
    conn, cursor = mock_db
    cursor.fetchone.return_value = {
        "id": "123",
        "nome_completo": "João Atualizado",
        "email": "joao@email.com",
        "identificacao": "123",
        "perfil": "Voluntario",
        "ativo": True,
        "password_hash": "hash",
        "cidade": "Brasília",
        "causas": '["Educação"]',
    }
    repo = VoluntarioRepository(db_connection=conn)
    dados = {
        "nome_completo": "João Atualizado",
        "cidade": "Brasília",
        "causas": ["Educação"],
    }
    res = repo.atualizar_perfil("123", dados)
    assert res is not None
    assert res.nome_completo == "João Atualizado"
    conn.commit.assert_called_once()


def test_repository_carregar_json_auxiliar():
    assert VoluntarioRepository._carregar_json(None) is None
    assert VoluntarioRepository._carregar_json(["já_lista"]) == ["já_lista"]
    assert VoluntarioRepository._carregar_json('["teste"]') == ["teste"]
    assert VoluntarioRepository._carregar_json("string_simples") == "string_simples"