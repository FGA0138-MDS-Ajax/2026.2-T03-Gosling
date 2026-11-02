from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

from app.usuarios.schemas import UsuarioPublico


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    senha: SecretStr = Field(min_length=1, max_length=1024)


class SessaoResponse(BaseModel):
    usuario: UsuarioPublico
    expires_at: int


class LoginResponse(SessaoResponse):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
