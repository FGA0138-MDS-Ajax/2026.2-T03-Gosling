from datetime import datetime

from sqlalchemy import Enum, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.candidaturas.enums import StatusCandidatura
from app.core.database import Base
from app.core.datetime import UTCDateTime
from app.vagas.models import Vaga


class Candidatura(Base):
    __tablename__ = "candidaturas"
    __table_args__ = (
        UniqueConstraint(
            "voluntario_id", "vaga_id", name="uq_candidatura_voluntario_vaga"
        ),
        Index("ix_candidaturas_voluntario_status", "voluntario_id", "status"),
        Index("ix_candidaturas_vaga_id", "vaga_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    voluntario_id: Mapped[int] = mapped_column(
        ForeignKey("voluntarios.id", ondelete="CASCADE")
    )
    vaga_id: Mapped[int] = mapped_column(ForeignKey("vagas.id", ondelete="CASCADE"))
    status: Mapped[StatusCandidatura] = mapped_column(
        Enum(StatusCandidatura, name="status_candidatura", create_constraint=True),
        default=StatusCandidatura.PENDENTE,
        server_default="PENDENTE",
    )
    criado_em: Mapped[datetime] = mapped_column(
        UTCDateTime(), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        UTCDateTime(), server_default=func.now(), onupdate=func.now()
    )

    vaga: Mapped[Vaga] = relationship()


class DocumentoCandidatura(Base):
    __tablename__ = "documentos_candidatura"
    __table_args__ = (
        UniqueConstraint("candidatura_id", "indice", name="uq_documento_candidatura"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    candidatura_id: Mapped[int] = mapped_column(
        ForeignKey("candidaturas.id", ondelete="CASCADE")
    )
    indice: Mapped[int]
    nome: Mapped[str] = mapped_column(String(150))
    arquivo: Mapped[str] = mapped_column(String(36))
