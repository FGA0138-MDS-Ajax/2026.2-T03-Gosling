import os

import pymysql
from fastapi import APIRouter, Depends, HTTPException, status

from  voluntarios.repository import VoluntarioRepository
from  voluntarios.schemas import (
    CadastroVoluntarioRequest,
    CadastroVoluntarioResponse,
)
from  voluntarios.service import (
    ConsentimentoObrigatorioException,
    EmailJaCadastradoException,
    IdentificacaoJaCadastradaException,
    VoluntarioService,
)

router = APIRouter(prefix="/api/v1/voluntarios", tags=["Voluntários"])


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
    description="Persiste uma conta de pessoa física como voluntário e retorna a sessão inicial via JWT.",
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