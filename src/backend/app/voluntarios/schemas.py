from pydantic import BaseModel, EmailStr, Field


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
