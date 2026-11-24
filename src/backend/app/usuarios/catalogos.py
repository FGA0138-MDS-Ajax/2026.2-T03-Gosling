from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Causa(Base):
    __tablename__ = "causas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(100))
    nome_normalizado: Mapped[str] = mapped_column(String(300), unique=True)
    codigo: Mapped[str | None] = mapped_column(String(100), unique=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    ordem: Mapped[int] = mapped_column(default=1000, server_default="1000")
    aliases: Mapped[list[str] | None] = mapped_column(JSON)
