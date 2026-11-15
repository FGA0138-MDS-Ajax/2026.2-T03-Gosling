from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.core.datetime import UTCDateTime
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import Modalidade, Periodo, StatusVaga


class Vaga(Base):
    __tablename__ = "vagas"
    __table_args__ = (Index("ix_vagas_status_id", "status", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organizacao_id: Mapped[int] = mapped_column(
        ForeignKey("organizacoes.id", ondelete="CASCADE"), index=True
    )
    causa_id: Mapped[int] = mapped_column(ForeignKey("causas.id"), index=True)
    titulo: Mapped[str] = mapped_column(String(150))
    descricao: Mapped[str] = mapped_column(Text)
    atividades: Mapped[str] = mapped_column(Text)
    modalidade: Mapped[Modalidade] = mapped_column(
        Enum(Modalidade, name="modalidade_vaga")
    )
    local: Mapped[str] = mapped_column(String(500))
    periodo: Mapped[Periodo] = mapped_column(Enum(Periodo, name="periodo_vaga"))
    carga_horaria: Mapped[Decimal] = mapped_column(Numeric(7, 2))
    numero_vagas: Mapped[int]
    status: Mapped[StatusVaga] = mapped_column(
        Enum(StatusVaga, name="status_vaga"), default=StatusVaga.ABERTA
    )

    organizacao: Mapped[Organizacao] = relationship(lazy="joined")
    causa: Mapped[Causa] = relationship(lazy="joined")
    ocorrencias: Mapped[list["OcorrenciaVaga"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="OcorrenciaVaga.inicio",
        lazy="selectin",
    )


class OcorrenciaVaga(Base):
    __tablename__ = "ocorrencias_vaga"
    __table_args__ = (
        CheckConstraint("inicio < fim", name="ck_ocorrencias_vaga_intervalo"),
        Index("ix_ocorrencias_vaga_intervalo", "vaga_id", "inicio", "fim"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    vaga_id: Mapped[int] = mapped_column(
        ForeignKey("vagas.id", ondelete="CASCADE")
    )
    inicio: Mapped[datetime] = mapped_column(UTCDateTime())
    fim: Mapped[datetime] = mapped_column(UTCDateTime())
