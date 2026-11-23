from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.candidaturas.enums import STATUS_ATIVOS
from app.candidaturas.models import Candidatura
from app.usuarios.models import Organizacao
from app.vagas.models import OcorrenciaVaga, Vaga


class CandidaturaRepository:
    def __init__(self, session: Session):
        self.session = session

    def listar_eventos(self, voluntario_id: int, inicio: datetime, fim: datetime):
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
