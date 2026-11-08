from sqlalchemy import select
from sqlalchemy.orm import Session

from app.usuarios.models import Usuario


class UsuarioRepository:
    def __init__(self, session: Session):
        self.session = session

    def buscar_por_email(self, email: str) -> Usuario | None:
        return self.session.scalar(select(Usuario).where(Usuario.email == email))

    def buscar_por_id(self, usuario_id: int) -> Usuario | None:
        return self.session.scalar(select(Usuario).where(Usuario.id == usuario_id))

    def adicionar(self, usuario: Usuario) -> None:
        self.session.add(usuario)
