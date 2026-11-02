from pydantic import BaseModel, ConfigDict, EmailStr
from app.usuarios.enums import Perfil, TipoOrganizacao

class UsuarioPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    email: EmailStr
    perfil: Perfil
    tipo: TipoOrganizacao | None = None

class UsuarioCredenciais(UsuarioPublico):
    senha_hash: str
    ativo: bool
