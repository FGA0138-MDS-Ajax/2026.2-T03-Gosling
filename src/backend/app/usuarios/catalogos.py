from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Causa(Base):
    __tablename__ = "causas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(100))
    nome_normalizado: Mapped[str] = mapped_column(String(300), unique=True)
