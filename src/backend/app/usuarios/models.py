from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
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
    id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    __mapper_args__ = {"polymorphic_identity": Perfil.VOLUNTARIO}


class Organizacao(Usuario):
    __tablename__ = "organizacoes"

    id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    tipo: Mapped[TipoOrganizacao] = mapped_column(
        Enum(TipoOrganizacao, name="tipo_organizacao"),
        default=TipoOrganizacao.ONG,
        server_default="ONG",
    )
    __mapper_args__ = {"polymorphic_identity": Perfil.ORGANIZACAO}
