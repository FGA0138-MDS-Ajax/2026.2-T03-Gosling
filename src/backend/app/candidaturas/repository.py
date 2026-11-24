from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session, lazyload

from app.candidaturas.enums import STATUS_ATIVOS
from app.candidaturas.models import Candidatura
from app.usuarios.models import Organizacao, Voluntario
from app.vagas.models import OcorrenciaVaga, Vaga


class CandidaturaRepository:
    def __init__(self, session: Session):
        self.session = session

    def bloquear_voluntario(self, voluntario_id: int) -> bool:
        if self.session.get_bind().dialect.name == "sqlite":
            # SQLite serializa escritas e não implementa SELECT FOR UPDATE.
            voluntarios = Voluntario.__table__
            resultado = self.session.execute(
                update(voluntarios)
                .where(voluntarios.c.id == voluntario_id)
                .values(id=voluntarios.c.id)
            )
            return resultado.rowcount > 0
        consulta = (
            select(Voluntario.id)
            .where(Voluntario.id == voluntario_id)
            .with_for_update()
        )
        return self.session.scalar(consulta) is not None

    def bloquear_vaga(self, vaga_id: int) -> Vaga | None:
        consulta = (
            select(Vaga)
            .options(
                lazyload(Vaga.organizacao),
                lazyload(Vaga.causa),
                lazyload(Vaga.ocorrencias),
            )
            .where(
                Vaga.id == vaga_id,
                Vaga.organizacao.has(
                    and_(
                        Organizacao.ativo.is_(True),
                        Organizacao.homologada.is_(True),
                    )
                ),
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return self.session.scalar(consulta)

    def listar_ocorrencias(self, vaga_id: int) -> Sequence[OcorrenciaVaga]:
        consulta = (
            select(OcorrenciaVaga)
            .where(OcorrenciaVaga.vaga_id == vaga_id)
            .order_by(OcorrenciaVaga.inicio)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        return self.session.scalars(consulta).all()

    def ja_candidatado(self, vaga_id: int, voluntario_id: int) -> bool:
        consulta = (
            select(Candidatura.id)
            .where(
                Candidatura.vaga_id == vaga_id,
                Candidatura.voluntario_id == voluntario_id,
            )
            .with_for_update(read=True)
        )
        return self.session.scalar(consulta) is not None

    def listar_conflitos(
        self, voluntario_id: int, ocorrencias: Sequence[OcorrenciaVaga]
    ):
        if not ocorrencias:
            return []
        sobreposicoes = [
            and_(
                OcorrenciaVaga.inicio < encontro.fim,
                OcorrenciaVaga.fim > encontro.inicio,
            )
            for encontro in ocorrencias
        ]
        consulta = (
            select(
                Vaga.id.label("vaga_id"),
                Vaga.titulo.label("titulo_vaga"),
                OcorrenciaVaga.inicio,
                OcorrenciaVaga.fim,
            )
            .select_from(Candidatura)
            .join(Vaga, Vaga.id == Candidatura.vaga_id)
            .join(OcorrenciaVaga, OcorrenciaVaga.vaga_id == Vaga.id)
            .where(
                Candidatura.voluntario_id == voluntario_id,
                Candidatura.status.in_(STATUS_ATIVOS),
                or_(*sobreposicoes),
            )
            .order_by(OcorrenciaVaga.inicio, Vaga.id, OcorrenciaVaga.id)
            .with_for_update(read=True)
        )
        return self.session.execute(consulta).mappings().all()

    def buscar_do_voluntario(
        self,
        candidatura_id: int,
        voluntario_id: int,
    ) -> Candidatura | None:
        return self.session.scalar(
            select(Candidatura).where(
                Candidatura.id == candidatura_id,
                Candidatura.voluntario_id == voluntario_id,
            )
        )

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
