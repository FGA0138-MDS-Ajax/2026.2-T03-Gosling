from sqlalchemy import select
from sqlalchemy.orm import Session

from app.usuarios.catalogos import Causa


class CausaRepository:
    def __init__(self, session: Session):
        self.session = session

    def listar(self) -> list[Causa]:
        return list(self.session.scalars(select(Causa).order_by(Causa.ordem, Causa.id)))
