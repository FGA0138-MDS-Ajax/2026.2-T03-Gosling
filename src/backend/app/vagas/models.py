from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
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
from app.localizacao.models import LocalizacaoMixin, restricao_coordenadas
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import Modalidade, Periodo, StatusVaga


def agora_utc() -> datetime:
    return datetime.now(UTC)


class Vaga(LocalizacaoMixin, Base):
    __tablename__ = "vagas"
    __table_args__ = (
        Index("ix_vagas_status_id", "status", "id"),
        Index("ix_vagas_organizacao_status_id", "organizacao_id", "status", "id"),
        restricao_coordenadas("vagas"),
        CheckConstraint(
            "status = 'RASCUNHO' OR (causa_id IS NOT NULL "
            "AND titulo IS NOT NULL AND descricao IS NOT NULL "
            "AND atividades IS NOT NULL AND modalidade IS NOT NULL "
            "AND local IS NOT NULL AND periodo IS NOT NULL "
            "AND carga_horaria IS NOT NULL AND numero_vagas IS NOT NULL)",
            name="ck_vagas_dados_publicados",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organizacao_id: Mapped[int] = mapped_column(
        ForeignKey("organizacoes.id", ondelete="CASCADE"), index=True
    )
    causa_id: Mapped[int | None] = mapped_column(ForeignKey("causas.id"), index=True)
    titulo: Mapped[str | None] = mapped_column(String(150))
    descricao: Mapped[str | None] = mapped_column(Text)
    atividades: Mapped[str | None] = mapped_column(Text)
    modalidade: Mapped[Modalidade | None] = mapped_column(
        Enum(Modalidade, name="modalidade_vaga")
    )
    local: Mapped[str | None] = mapped_column(String(500))
    origem_localizacao: Mapped[str] = mapped_column(
        String(20), default="LEGADO", server_default="LEGADO"
    )
    periodo: Mapped[Periodo | None] = mapped_column(Enum(Periodo, name="periodo_vaga"))
    carga_horaria: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    numero_vagas: Mapped[int | None]
    fotos: Mapped[list[str] | None] = mapped_column(JSON)
    documentos_exigidos: Mapped[list[dict[str, str | None]] | None] = mapped_column(
        JSON
    )
    status: Mapped[StatusVaga] = mapped_column(
        Enum(StatusVaga, name="status_vaga"), default=StatusVaga.ABERTA
    )
    rascunho: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))
    versao: Mapped[int] = mapped_column(default=1, server_default="1")
    criado_em: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=agora_utc)
    atualizado_em: Mapped[datetime | None] = mapped_column(
        UTCDateTime(), default=agora_utc, onupdate=agora_utc
    )

    organizacao: Mapped[Organizacao] = relationship(lazy="joined")
    causa: Mapped[Causa | None] = relationship(lazy="joined")
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
    vaga_id: Mapped[int] = mapped_column(ForeignKey("vagas.id", ondelete="CASCADE"))
    inicio: Mapped[datetime] = mapped_column(UTCDateTime())
    fim: Mapped[datetime] = mapped_column(UTCDateTime())
