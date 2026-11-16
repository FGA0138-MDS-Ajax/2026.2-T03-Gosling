from fastapi import APIRouter, Depends, Query

from app.jwt_geraçao.dependencies import get_organizacao_logada, get_vaga_service
from app.vagas.schemas import PaginatedResponseVagas
from app.vagas.service import VagaService

router = APIRouter(prefix="/api/v1/organizacoes", tags=["Organizações"])


@router.get("/me/vagas", response_model=PaginatedResponseVagas)
def listar_minhas_vagas(
    organizacao_id: int = Depends(get_organizacao_logada),
    service: VagaService = Depends(get_vaga_service),
    pagina: int = Query(1, ge=1),
    tamanho_pagina: int = Query(10, ge=1, le=100),
):
    return service.listar_vagas_da_organizacao(
        organizacao_id=str(organizacao_id),
        pagina=pagina,
        tamanho_pagina=tamanho_pagina,
    )