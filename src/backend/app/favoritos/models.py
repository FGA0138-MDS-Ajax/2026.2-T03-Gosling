from datetime import datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime import UTCDateTime


class VagaSalva(Base):
    __tablename__ = "vagas_salvas"

    voluntario_id: Mapped[int] = mapped_column(
        ForeignKey("voluntarios.id", ondelete="CASCADE"), primary_key=True
    )
    vaga_id: Mapped[int] = mapped_column(
        ForeignKey("vagas.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    salvo_em: Mapped[datetime] = mapped_column(UTCDateTime(), server_default=func.now())
