from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.usuarios.enums import Perfil, TipoOrganizacao


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    perfil: Mapped[Perfil] = mapped_column(Enum(Perfil, name="perfil_usuario"))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    __mapper_args__ = {
        "polymorphic_on": perfil,
        "polymorphic_identity": Perfil.ADMINISTRADOR,
    }


class Voluntario(Usuario):
    __tablename__ = "voluntarios"
    __table_args__ = (
        UniqueConstraint("identificacao", name="uq_voluntarios_identificacao"),
    )
    id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    identificacao: Mapped[str | None] = mapped_column(String(20))
    consentimento_termos: Mapped[bool] = mapped_column(Boolean, server_default="0")
    telefone: Mapped[str | None] = mapped_column(String(20))
    cidade: Mapped[str | None] = mapped_column(String(100))
    estado: Mapped[str | None] = mapped_column(String(2))
    biografia: Mapped[str | None] = mapped_column(String(500))
    causas: Mapped[list[str] | None] = mapped_column(JSON)
    disponibilidades: Mapped[list[str] | None] = mapped_column(JSON)
    __mapper_args__ = {"polymorphic_identity": Perfil.VOLUNTARIO}


class Organizacao(Usuario):
    __tablename__ = "organizacoes"
    __table_args__ = (UniqueConstraint("cnpj", name="uq_organizacoes_cnpj"),)

    id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    tipo: Mapped[TipoOrganizacao] = mapped_column(
        Enum(TipoOrganizacao, name="tipo_organizacao"),
        default=TipoOrganizacao.ONG,
        server_default="ONG",
    )

    razao_social: Mapped[str | None] = mapped_column(String(200))
    cnpj: Mapped[str | None] = mapped_column(String(14))
    area_atuacao: Mapped[str | None] = mapped_column(String(150))
    endereco: Mapped[str | None] = mapped_column(String(500))
    responsavel: Mapped[str | None] = mapped_column(String(150))
    descricao: Mapped[str | None] = mapped_column(Text)
    telefone: Mapped[str | None] = mapped_column(String(15))

    consentimento_termos: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    homologada: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    __mapper_args__ = {"polymorphic_identity": Perfil.ORGANIZACAO}
