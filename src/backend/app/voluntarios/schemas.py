from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional


class CadastroVoluntarioRequest(BaseModel):
    nome_completo: str = Field(
        ...,
        min_length=3,
        max_length=150,
        description="Nome completo do voluntário",
        examples=["Maria da Silva"],
    )
    email: EmailStr = Field(
        ...,
        description="E-mail de contato e login",
        examples=["maria.silva@voluntario.org"],
    )
    identificacao: str = Field(
        ...,
        min_length=11,
        max_length=20,
        description="Documento de identificação (CPF ou documento de pessoa física)",
        examples=["12345678901"],
    )
    password: str = Field(
        ...,
        min_length=8,
        description="Senha de acesso (mínimo de 8 caracteres)",
        examples=["SenhaForte@2026"],
    )
    consentimento_termos: bool = Field(
        ...,
        description="Confirmação de consentimento e aceite dos termos de uso",
        examples=[True],
    )


class VoluntarioPublicoDTO(BaseModel):
    id: str
    nome_completo: str
    email: str
    identificacao: str
    perfil: str = "Voluntario"


class CadastroVoluntarioResponse(BaseModel):
    mensagem: str = "Voluntário cadastrado com sucesso."
    voluntario: VoluntarioPublicoDTO
    access_token: str
    token_type: str = "Bearer"
    expires_in_minutes: int = 60


## Schemas da Issue #20


class AtualizaPerfilUsuariosRequest(BaseModel):
    nome_completo: Optional[str] = Field(None, min_length=2, max_length=150)
    telefone: Optional[str] = Field(None, max_length=20)
    cidade: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, min_length=2, max_length=2)
    biografia: Optional[str] = Field(None, max_length=500)
    causas: Optional[List[str]] = Field(
        default_factory=list,
        description="Causas de interesse, como educação e meio ambiente.",
    )
    disponibilidades: Optional[List[str]] = Field(
        default_factory=list,
        description="Lista de disponibilidades (ex: ['Fins de Semana'], ['Noite'])",
    )


class PerfilVoluntarioResponse(BaseModel):
    """
    Ja aqui é o retorno dos dados que são permitidos serem alterados
    no banco de dados pelo usuário.

    """

    id: str
    nome_completo: str
    email: str
    identificacao: str
    perfil: str
    telefone: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    biografia: Optional[str] = None
    causas: List[str] = Field(default_factory=list)
    disponibilidades: Optional[List[str]] = Field(default_factory=list)
