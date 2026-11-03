
from fastapi import APIRouter, Depends, HTTPException, status
import pymysql

from backend.app.jwt_geraçao.repository import UsuarioRepository
from backend.app.jwt_geraçao.schemas import LoginRequest, LoginResponse
from backend.app.jwt_geraçao.service import (
    AuthService,
    CredenciaisInvalidasException,
    ContaSemAcessoException,
)
from fastapi import APIRouter

router = APIRouter()

@router.get("/exemplo")
def exemplo():
    return {"ok": True}
router = APIRouter(prefix="/api/v1/auth", tags=["Autenticação"])


def get_db_connection():
    """Abre a conexão com o banco e fecha ao fim da requisição."""
    conn = pymysql.connect(
        host="localhost",
        user="api_user",
        password="Exemplo_senha",
        database="Exemplo",
    )
    try:
        yield conn
    finally:
        conn.close()


def get_auth_service(conn=Depends(get_db_connection)) -> AuthService:
    # 1. Instancia o repositório com a conexão
    repository = UsuarioRepository(db_connection=conn)
    # 2. Devolve o serviço pronto
    return AuthService(usuario_repository=repository)


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Realiza o login e emite JWT de 60 minutos",
)
def login(
    dados_login: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> LoginResponse:
    try:
        return service.autenticar_e_gerar_token(dados_login)
    except CredenciaisInvalidasException as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(err),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ContaSemAcessoException as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )
