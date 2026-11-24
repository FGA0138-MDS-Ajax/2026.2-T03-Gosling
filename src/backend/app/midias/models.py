from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime import UTCDateTime


class UsoMidia(StrEnum):
    FOTO_VAGA = "FOTO_VAGA"
    AVATAR = "AVATAR"
    LOGO = "LOGO"
    CAPA = "CAPA"
    GALERIA = "GALERIA"
    MODELO_TERMO = "MODELO_TERMO"


class ArquivoMidia(Base):
    __tablename__ = "arquivos_midia"

    arquivo: Mapped[str] = mapped_column(String(37), primary_key=True)
    titular_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), index=True
    )
    uso: Mapped[str] = mapped_column(String(20))
    nome: Mapped[str] = mapped_column(String(255))
    formato: Mapped[str] = mapped_column(String(30))
    tamanho_bytes: Mapped[int]
    largura: Mapped[int | None]
    altura: Mapped[int | None]
    criado_em: Mapped[datetime] = mapped_column(
        UTCDateTime(), server_default=func.now()
    )

    @property
    def url(self) -> str:
        subpasta = "modelos/" if self.uso == UsoMidia.MODELO_TERMO else ""
        return f"/api/v1/midia/{subpasta}{self.arquivo}"


class MidiaVaga(Base):
    __tablename__ = "midia_vagas"

    vaga_id: Mapped[int] = mapped_column(
        ForeignKey("vagas.id", ondelete="CASCADE"), primary_key=True
    )
    arquivo: Mapped[str] = mapped_column(
        ForeignKey("arquivos_midia.arquivo", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
