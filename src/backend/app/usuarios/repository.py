from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.usuarios.models import Organizacao, Usuario


class UsuarioRepository:
    def __init__(self, session: Session):
        self.session = session

    def buscar_por_email(self, email: str) -> Usuario | None:
        return self.session.scalar(select(Usuario).where(Usuario.email == email))

    def buscar_por_id(self, usuario_id: int) -> Usuario | None:
        return self.session.scalar(select(Usuario).where(Usuario.id == usuario_id))

    def adicionar(self, usuario: Usuario) -> None:
        self.session.add(usuario)

    def buscar_organizacao_por_id(self, usuario_id: int) -> Organizacao | None:
        return self.session.get(Organizacao, usuario_id)

    def buscar_por_cnpj(self, cnpj: str) -> Organizacao | None:
        return self.session.scalar(select(Organizacao).where(Organizacao.cnpj == cnpj))

    def salvar(self, usuario: Usuario) -> Usuario:
        self.session.add(usuario)
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            raise
        self.session.refresh(usuario)
        return usuario
