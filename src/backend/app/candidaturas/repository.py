
from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.candidaturas.enums import STATUS_ATIVOS
from app.candidaturas.models import Candidatura
from app.usuarios.models import Organizacao
from app.vagas.models import OcorrenciaVaga, Vaga


class CandidaturaRepository:
    def __init__(self, session: Session):
        self.session = session

    def ja_candidatado(self, vaga_id: int, voluntario_id: int) -> bool:
        consulta = select(func.count(Candidatura.id)).where(
            Candidatura.vaga_id == vaga_id,
            Candidatura.voluntario_id == voluntario_id,
        )

        total = self.session.execute(consulta).scalar() or 0

        return total > 0

    def criar_candidatura(
        self,
        vaga_id: int,
        voluntario_id: int,
        status: str = "PENDENTE",
    ) -> Candidatura:
        try:
            nova_candidatura = Candidatura(
                vaga_id=vaga_id,
                voluntario_id=voluntario_id,
                status=status,
            )

            self.session.add(nova_candidatura)
            self.session.commit()
            self.session.refresh(nova_candidatura)

            return nova_candidatura

        except Exception as e:
            self.session.rollback()
            raise e

    def buscar_por_id(self, candidatura_id: int) -> Optional[Candidatura]:
        consulta = select(Candidatura).where(
            Candidatura.id == candidatura_id
        )

        return self.session.execute(consulta).scalar_one_or_none()

    def listar_por_vaga(self, vaga_id: int) -> List[Candidatura]:
        consulta = select(Candidatura).where(
            Candidatura.id == vaga_id
        )

        return list(self.session.execute(consulta).scalars().all())

    def listar_eventos(
        self,
        voluntario_id: int,
        inicio: datetime,
        fim: datetime,
    ):
        consulta = (
            select(
                Candidatura.id.label("candidatura_id"),
                Vaga.id.label("vaga_id"),
                Vaga.titulo.label("titulo_vaga"),
                Organizacao.id.label("organizacao_id"),
                Organizacao.nome.label("organizacao_nome"),
                Candidatura.status,
                OcorrenciaVaga.inicio,
                OcorrenciaVaga.fim,
            )
            .select_from(Candidatura)
            .join(Vaga, Vaga.id == Candidatura.vaga_id)
            .join(Organizacao, Organizacao.id == Vaga.organizacao_id)
            .join(OcorrenciaVaga, OcorrenciaVaga.vaga_id == Vaga.id)
            .where(
                Candidatura.voluntario_id == voluntario_id,
                Candidatura.status.in_(STATUS_ATIVOS),
                OcorrenciaVaga.inicio < fim,
                OcorrenciaVaga.fim > inicio,
            )
            .order_by(
                OcorrenciaVaga.inicio,
                OcorrenciaVaga.fim,
                Candidatura.id,
                OcorrenciaVaga.id,
            )
        )

        return self.session.execute(consulta).mappings().all()
