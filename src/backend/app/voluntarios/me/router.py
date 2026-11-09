import os
import jwt
import pymysql
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.voluntarios.me.repository import VoluntarioRepository
from app.voluntarios.me.schemas import (
    AtualizaPerfilUsuariosRequest,
    CadastroVoluntarioRequest,
    CadastroVoluntarioResponse,
    PerfilVoluntarioResponse,
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

router = APIRouter(prefix="/api/v1/voluntarios", tags=["Voluntários"])
security = HTTPBearer()
def get_db():
    connection = None
    try:
        connection = pymysql.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "root"),
            database=os.getenv("DB_NAME", "volunja_db"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
        yield connection
    finally:
        if connection:
            connection.close()


def get_voluntario_service(db=Depends(get_db)) -> VoluntarioService:
    repository = VoluntarioRepository(db_connection=db)
    return VoluntarioService(voluntario_repository=repository)


@router.post(
    "",
    response_model=CadastroVoluntarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar voluntário e iniciar sessão",
        description=(
        "Persiste uma conta de pessoa física como voluntário e retorna "
        "a sessão inicial via JWT."
    ),
)
def cadastrar_voluntario(
    dados: CadastroVoluntarioRequest,
    service: VoluntarioService = Depends(get_voluntario_service),
):
    try:
        return service.cadastrar_voluntario(dados)
    except ConsentimentoObrigatorioException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except (EmailJaCadastradoException, IdentificacaoJaCadastradaException) as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

#Issue 20

def get_usuario_logado(
        credenciais: HTTPAuthorizationCredentials = Security(security),

)-> str:
    token = credenciais.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        voluntario_id = payload.get("sub")

        if not voluntario_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token JWT inválido: identificador (sub) ausente"
            )
        return voluntario_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Por favor, autentique-se novamente."
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou corrompido."
        )


@router.get(
    "/me",
    response_model=PerfilVoluntarioResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter perfil voluntário autenticado",
    description=(
    "Recupera dados pessoais, causas e disponibilidade usando estritamente"
    "a identidade extraída do token JWT"
),

)

def obter_meu_perfil(
        voluntario_id: str = Depends(get_usuario_logado),
        service: VoluntarioService = Depends(get_voluntario_service),
):
    try:
        return service.obter_perfil_por_id(voluntario_id)
    except VoluntarioNaoEncontradoException as e:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.put(
    "/me",
    response_model=PerfilVoluntarioResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar perfil do voluntario autenticado",
    description=(
        "Valida e persiste alterações em dados pessoais, causas e disponibilidades. "
        "Preserva dados imutáveis (id,email,identicação e perfil)."
    ),
)
def atualizar_meu_perfil(
        dados: AtualizaPerfilUsuariosRequest,
        voluntario_id: str = Depends(get_usuario_logado),
        service: VoluntarioService = Depends(get_voluntario_service),
):
    try:
        return service.atualizar_perfil(
            voluntario_id= voluntario_id,dados = dados
        )
    except VoluntarioNaoEncontradoException as e:
        raise HTTPException( status_code=status.HTTP_404_NOT_FOUND, detail=str(e))