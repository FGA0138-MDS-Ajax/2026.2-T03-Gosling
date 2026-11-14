from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VagaResumoResponse(BaseModel):
    id: str
    titulo: str
    estado_vaga: str
    cidade: Optional[str] = None
    estado_uf: Optional[str] = None
    data_criacao: datetime
    total_candidaturas: int = Field(
        default=0, description="Contagem acumulada de inscritos na vaga"
    )


class PaginatedResponseVagas(BaseModel):
    itens: list[VagaResumoResponse]
    pagina: int
    tamanho_pagina: int
    total_itens: int
    total_paginas: int