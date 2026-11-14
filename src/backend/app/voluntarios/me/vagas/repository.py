from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


class VagaRepository:
    def __init__(self, session: Session):
        self.session = session

    def listar_vagas_por_organizacao(
        self, organizacao_id: int, pagina: int = 1, tamanho_pagina: int = 10
    ) -> tuple[list[dict[str, Any]], int]:
        offset = (pagina - 1) * tamanho_pagina

        total_itens = self.session.execute(
            text("SELECT COUNT(*) FROM vagas WHERE organizacao_id = :organizacao_id"),
            {"organizacao_id": organizacao_id},
        ).scalar_one()

        linhas = (
            self.session.execute(
                text(
                    "SELECT v.id, v.titulo, v.estado_vaga, v.cidade, v.estado_uf, "
                    "v.data_criacao, COUNT(c.id) AS total_candidaturas "
                    "FROM vagas v "
                    "LEFT JOIN candidaturas c ON c.vaga_id = v.id "
                    "WHERE v.organizacao_id = :organizacao_id "
                    "GROUP BY v.id, v.titulo, v.estado_vaga, v.cidade, "
                    "v.estado_uf, v.data_criacao "
                    "ORDER BY v.data_criacao DESC, v.id DESC "
                    "LIMIT :limite OFFSET :offset"
                ),
                {
                    "organizacao_id": organizacao_id,
                    "limite": tamanho_pagina,
                    "offset": offset,
                },
            )
            .mappings()
            .all()
        )

        return [dict(linha) for linha in linhas], total_itens