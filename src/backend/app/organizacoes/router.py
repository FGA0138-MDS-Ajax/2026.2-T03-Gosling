from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.midia import MidiaResponse, confirmar_upload, salvar_imagem
from app.jwt_geraçao.dependencies import get_organizacao_logada, get_vaga_service
from app.midias.models import UsoMidia
from app.vagas.enums import StatusVaga
from app.vagas.schemas import PaginatedResponseVagas
from app.vagas.service import VagaService

router = APIRouter(prefix="/organizacoes", tags=["Organizações"])


@router.post("/me/midia/{uso}", status_code=201, response_model=MidiaResponse)
async def enviar_midia_institucional(
    uso: Literal["logo", "capa", "galeria"],
    request: Request,
    organizacao_id: Annotated[int, Depends(get_organizacao_logada)],
    db: Annotated[Session, Depends(get_db)],
) -> MidiaResponse:
    arquivo = await salvar_imagem(request, db, organizacao_id, UsoMidia(uso.upper()))
    return confirmar_upload(db, arquivo)


@router.get(
    "/me/vagas",
    response_model=PaginatedResponseVagas,
    status_code=status.HTTP_200_OK,
    summary="Listar vagas da organização autenticada",
    description=(
        "Retorna as vagas da organização identificada pelo JWT, "
        "com total de candidaturas e paginação."
    ),
)
def listar_minhas_vagas(
    response: Response,
    pagina: int = Query(1, ge=1, description="Número da página (mínimo 1)"),
    tamanho_pagina: int = Query(
        10, ge=1, le=100, description="Itens por página (1 a 100)"
    ),
    organizacao_id: int = Depends(get_organizacao_logada),
    service: VagaService = Depends(get_vaga_service),
    estado: StatusVaga | None = Query(None, alias="status"),
):
    response.headers["Cache-Control"] = "no-store"
    return service.listar_vagas_da_organizacao(
        organizacao_id=organizacao_id,
        pagina=pagina,
        tamanho_pagina=tamanho_pagina,
        estado=estado,
    )
