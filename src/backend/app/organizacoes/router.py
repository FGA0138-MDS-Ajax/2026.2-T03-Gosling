from fastapi import APIRouter, Depends, Query, status
from app.voluntarios.me.vagas.schemas import PaginatedResponseVagas
from app.jwt_geraçao.dependencies import get_organizacao_logada, get_vaga_service
from app.voluntarios.me.vagas.service import VagaService
from app.voluntarios.me.vagas.repository import VagaRepository
# ajuste o caminho abaixo para onde get_organizacao_logada está definida
 

router = APIRouter(prefix="/organizacoes", tags=["Organizações"])


@router.get(
    "/me/vagas",
    response_model=PaginatedResponseVagas,
    status_code=status.HTTP_200_OK,
    summary="Listar vagas da organização autenticada",
    description="Retorna as vagas da organização identificada pelo JWT com total de candidaturas e paginação.",
)

def listar_minhas_vagas(
    pagina: int = Query(1, ge=1, description="Número da página (mínimo 1)"),
    tamanho_pagina: int = Query(
        10, ge=1, le=100, description="Itens por página (1 a 100)"
    ),
    organizacao_id: str = Depends(get_organizacao_logada),
    service: VagaService = Depends(get_vaga_service),
):
    return service.listar_vagas_da_organizacao(
        organizacao_id=organizacao_id,
        pagina=pagina,
        tamanho_pagina=tamanho_pagina,
    )