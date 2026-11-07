from unittest.mock import MagicMock

import jwt
import pytest
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.voluntarios.router as router_module
from app.voluntarios.repository import VoluntarioEntity, VoluntarioRepository
from app.voluntarios.router import get_db, get_voluntario_service, router
from app.voluntarios.schemas import (
    CadastroVoluntarioRequest,
    CadastroVoluntarioResponse,
    VoluntarioPublicoDTO,
)
from app.voluntarios.service import (
    ALGORITHM,
    SECRET_KEY,
    ConsentimentoObrigatorioException,
    EmailJaCadastradoException,
    IdentificacaoJaCadastradaException,
    VoluntarioService,
)

_ph = PasswordHasher()

BODY = {
    "nome_completo": "Maria de Souza",
    "email": "maria@teste.com",
    "identificacao": "99988877766",
    "password": "SenhaForte@2026",
    "consentimento_termos": True,
}

ROW = {
    "id": 1,
    "nome_completo": "Maria de Souza",
    "email": "maria@teste.com",
    "identificacao": "99988877766",
    "password_hash": "hash",
    "consentimento_termos": 1,
    "perfil": "Voluntario",
    "ativo": 1,
}


class MockVoluntarioRepository(VoluntarioRepository):
    def __init__(self):
        self.banco_memoria = {
            "existente@voluntario.org": VoluntarioEntity(
                id="usr_mock_001",
                nome_completo="Carlos Já Cadastrado",
                email="existente@voluntario.org",
                identificacao="11122233344",
                password_hash=_ph.hash("SenhaSegura123"),
                consentimento_termos=True,
                perfil="Voluntario",
                ativo=True,
            )
        }

    def buscar_por_email(self, email: str):
        return self.banco_memoria.get(email.lower())

    def buscar_por_identificador(self, identificador: str):
        for voluntario in self.banco_memoria.values():
            if voluntario.identificacao == identificador.strip():
                return voluntario
        return None

    def salvar(self, voluntario: VoluntarioEntity) -> VoluntarioEntity:
        self.banco_memoria[voluntario.email.lower()] = voluntario
        return voluntario


class ServiceFake:
    def __init__(self, erro=None):
        self.erro = erro

    def cadastrar_voluntario(self, dados):
        if self.erro:
            raise self.erro
        return CadastroVoluntarioResponse(
            voluntario=VoluntarioPublicoDTO(
                id="1",
                nome_completo=dados.nome_completo,
                email=dados.email,
                identificacao=dados.identificacao,
            ),
            access_token="token",
        )


def _requisicao(**alteracoes) -> CadastroVoluntarioRequest:
    return CadastroVoluntarioRequest(**{**BODY, **alteracoes})


def _client(erro=None) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_voluntario_service] = lambda: ServiceFake(erro)
    return TestClient(app)


def _conn_com_resultado(row):
    conn = MagicMock()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = row
    return conn, cursor


@pytest.fixture
def repo_mock():
    return MockVoluntarioRepository()


@pytest.fixture
def service(repo_mock):
    return VoluntarioService(voluntario_repository=repo_mock)


def test_cadastro_retorna_dto_publico_com_perfil_fixo(service, repo_mock):
    resposta = service.cadastrar_voluntario(_requisicao())

    assert resposta.voluntario.nome_completo == "Maria de Souza"
    assert resposta.voluntario.email == "maria@teste.com"
    assert resposta.voluntario.perfil == "Voluntario"
    assert resposta.token_type == "Bearer"
    assert resposta.expires_in_minutes == 60

    salvo = repo_mock.buscar_por_email("maria@teste.com")
    assert salvo is not None
    assert salvo.perfil == "Voluntario"
    assert salvo.ativo is True
    assert salvo.consentimento_termos is True


def test_cadastro_emite_jwt_de_60_minutos_sem_dados_sensiveis(service, repo_mock):
    resposta = service.cadastrar_voluntario(_requisicao())
    salvo = repo_mock.buscar_por_email("maria@teste.com")

    payload = jwt.decode(resposta.access_token, SECRET_KEY, algorithms=[ALGORITHM])

    assert payload["sub"] == salvo.id
    assert payload["email"] == "maria@teste.com"
    assert payload["perfil"] == "Voluntario"
    assert payload["exp"] - payload["iat"] == 60 * 60
    assert "password_hash" not in payload
    assert "password" not in payload


def test_cadastro_normaliza_email_para_minusculas(service, repo_mock):
    service.cadastrar_voluntario(_requisicao(email="Maria@Teste.com"))

    assert repo_mock.buscar_por_email("maria@teste.com") is not None


@pytest.mark.parametrize(
    "alteracoes, excecao",
    [
        ({"email": "existente@voluntario.org"}, EmailJaCadastradoException),
        ({"identificacao": "11122233344"}, IdentificacaoJaCadastradaException),
        ({"consentimento_termos": False}, ConsentimentoObrigatorioException),
    ],
    ids=["email_duplicado", "identificacao_duplicada", "sem_consentimento"],
)
def test_cadastro_rejeita_e_nao_persiste(service, repo_mock, alteracoes, excecao):
    with pytest.raises(excecao):
        service.cadastrar_voluntario(_requisicao(**alteracoes))

    assert len(repo_mock.banco_memoria) == 1


def test_senha_e_armazenada_como_hash_argon2(service, repo_mock):
    senha = "MinhaSenhaSuperSecreta@123"

    service.cadastrar_voluntario(_requisicao(password=senha))
    salvo = repo_mock.buscar_por_email("maria@teste.com")

    assert salvo.password_hash != senha
    assert salvo.password_hash.startswith("$argon2")
    _ph.verify(salvo.password_hash, senha)
    with pytest.raises(VerifyMismatchError):
        _ph.verify(salvo.password_hash, "SenhaErradaQualquer")


def test_repositorio_buscar_por_email_encontrado():
    conn, cursor = _conn_com_resultado(ROW)

    resultado = VoluntarioRepository(conn).buscar_por_email("MARIA@teste.com")

    assert isinstance(resultado, VoluntarioEntity)
    assert resultado.id == "1"
    assert resultado.consentimento_termos is True
    assert resultado.ativo is True
    assert cursor.execute.call_args[0][1] == ("maria@teste.com",)


def test_repositorio_converte_flags_para_bool():
    conn, _ = _conn_com_resultado({**ROW, "consentimento_termos": 0, "ativo": 0})

    resultado = VoluntarioRepository(conn).buscar_por_email("maria@teste.com")

    assert resultado.consentimento_termos is False
    assert resultado.ativo is False


def test_repositorio_buscar_por_email_nao_encontrado():
    conn, _ = _conn_com_resultado(None)

    assert VoluntarioRepository(conn).buscar_por_email("x@teste.com") is None


def test_repositorio_buscar_por_identificador_encontrado():
    conn, cursor = _conn_com_resultado(ROW)

    resultado = VoluntarioRepository(conn).buscar_por_identificador(" 99988877766 ")

    assert resultado.identificacao == "99988877766"
    assert cursor.execute.call_args[0][1] == ("99988877766",)


def test_repositorio_buscar_por_identificador_nao_encontrado():
    conn, _ = _conn_com_resultado(None)

    assert VoluntarioRepository(conn).buscar_por_identificador("000") is None


def test_repositorio_salvar_executa_insert_e_commit():
    conn, cursor = _conn_com_resultado(None)
    voluntario = VoluntarioEntity(
        id="abc",
        nome_completo="Maria",
        email="MARIA@teste.com",
        identificacao="99988877766",
        password_hash="hash",
        consentimento_termos=True,
    )

    resultado = VoluntarioRepository(conn).salvar(voluntario)

    assert resultado is voluntario
    assert cursor.execute.call_args[0][1][2] == "maria@teste.com"
    conn.commit.assert_called_once()


def test_repositorio_sem_conexao_nao_acessa_banco():
    repo = VoluntarioRepository()
    voluntario = VoluntarioEntity("1", "A", "a@a.com", "1", "h", True)

    assert repo.buscar_por_email("a@a.com") is None
    assert repo.buscar_por_identificador("1") is None
    assert repo.salvar(voluntario) is voluntario


def test_router_cadastro_retorna_201_sem_expor_senha():
    resposta = _client().post("/api/v1/voluntarios", json=BODY)

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["voluntario"]["perfil"] == "Voluntario"
    assert corpo["access_token"] == "token"
    assert "password" not in corpo
    assert "password" not in corpo["voluntario"]


@pytest.mark.parametrize(
    "erro, status_esperado",
    [
        (EmailJaCadastradoException("e-mail duplicado"), 409),
        (IdentificacaoJaCadastradaException("documento duplicado"), 409),
        (ConsentimentoObrigatorioException("sem consentimento"), 400),
    ],
    ids=["email_duplicado", "identificacao_duplicada", "sem_consentimento"],
)
def test_router_converte_excecoes_de_negocio(erro, status_esperado):
    resposta = _client(erro).post("/api/v1/voluntarios", json=BODY)

    assert resposta.status_code == status_esperado
    assert resposta.json()["detail"] == str(erro)


@pytest.mark.parametrize(
    "alteracoes",
    [
        {"password": "curta"},
        {"email": "nao-e-um-email"},
        {"nome_completo": "Ab"},
        {"identificacao": "123"},
    ],
    ids=["senha_curta", "email_invalido", "nome_curto", "identificacao_curta"],
)
def test_router_rejeita_entrada_invalida_com_422(alteracoes):
    resposta = _client().post("/api/v1/voluntarios", json={**BODY, **alteracoes})

    assert resposta.status_code == 422


def test_router_rejeita_corpo_sem_consentimento_com_422():
    corpo = {k: v for k, v in BODY.items() if k != "consentimento_termos"}

    resposta = _client().post("/api/v1/voluntarios", json=corpo)

    assert resposta.status_code == 422


def test_router_get_db_abre_e_fecha_conexao(monkeypatch):
    conexao = MagicMock()
    monkeypatch.setattr(router_module.pymysql, "connect", lambda **kwargs: conexao)

    gerador = get_db()
    assert next(gerador) is conexao
    gerador.close()

    conexao.close.assert_called_once()


def test_router_get_voluntario_service_monta_service():
    assert isinstance(get_voluntario_service(db=MagicMock()), VoluntarioService)


def test_main_registra_rota_de_voluntarios():
    from app.voluntarios.main import app

    assert isinstance(app, FastAPI)
    assert "/api/v1/voluntarios" in [rota.path for rota in app.routes]
    
def test_main_registra_rota_de_voluntarios():
    from app.voluntarios.main import app

    assert isinstance(app, FastAPI)

    rotas = app.openapi()["paths"]
    assert "/api/v1/voluntarios" in rotas
    assert "post" in rotas["/api/v1/voluntarios"]