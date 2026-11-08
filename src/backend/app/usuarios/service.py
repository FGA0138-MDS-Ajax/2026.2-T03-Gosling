from app.usuarios.repository import UsuarioRepository
from app.usuarios.schemas import UsuarioCredenciais


class UsuarioService:
    def __init__(self, repository: UsuarioRepository):
        self.repository = repository

    def buscar_por_email(self, email: str) -> UsuarioCredenciais | None:
        usuario = self.repository.buscar_por_email(email.strip().lower())
        return (
            UsuarioCredenciais.model_validate(usuario) if usuario is not None else None
        )

    def buscar_por_id(self, usuario_id: int) -> UsuarioCredenciais | None:
        usuario = self.repository.buscar_por_id(usuario_id)
        return (
            UsuarioCredenciais.model_validate(usuario) if usuario is not None else None
        )
