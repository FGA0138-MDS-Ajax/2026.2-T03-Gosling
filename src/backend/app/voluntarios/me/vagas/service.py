import math

from app.voluntarios.me.vagas.repository import VagaRepository
from app.voluntarios.me.vagas.schemas import (
    PaginatedResponseVagas,
    VagaResumoResponse,
)


class VagaService:
    def __init__(self, vaga_repository: VagaRepository):
        self.vaga_repository = vaga_repository

    def listar_vagas_da_organizacao(
        self, organizacao_id: int, pagina: int, tamanho_pagina: int
    ) -> PaginatedResponseVagas:
        vagas, total_itens = self.vaga_repository.listar_vagas_por_organizacao(
            organizacao_id=organizacao_id,
            pagina=pagina,
            tamanho_pagina=tamanho_pagina,
        )

        itens = [
            VagaResumoResponse(
                id=str(vaga["id"]),
                titulo=vaga["titulo"],
                estado_vaga=vaga["estado_vaga"],
                cidade=vaga.get("cidade"),
                estado_uf=vaga.get("estado_uf"),
                data_criacao=vaga["data_criacao"],
                total_candidaturas=int(vaga["total_candidaturas"]),
            )
            for vaga in vagas
        ]

        return PaginatedResponseVagas(
            itens=itens,
            pagina=pagina,
            tamanho_pagina=tamanho_pagina,
            total_itens=total_itens,
            total_paginas=math.ceil(total_itens / tamanho_pagina),
        )