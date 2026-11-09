from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    field_validator,
)

from app.usuarios.enums import Perfil, TipoOrganizacao
from app.usuarios.schemas import AtualizarOrganizacaoRequest


class DadosContaAdmin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str = Field(min_length=3, max_length=150)
    email: EmailStr = Field(max_length=254)
    senha: SecretStr = Field(min_length=8, max_length=1024)
    ativo: bool = Field(default=True, strict=True)

    @field_validator("nome", "email", mode="before")
    @classmethod
    def limpar_textos(cls, valor: object) -> object:
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        return valor.lower()


class CriarVoluntarioAdmin(DadosContaAdmin):
    perfil: Literal[Perfil.VOLUNTARIO]


class CriarAdministradorAdmin(DadosContaAdmin):
    perfil: Literal[Perfil.ADMINISTRADOR]


class CriarOngAdmin(AtualizarOrganizacaoRequest):
    perfil: Literal[Perfil.ORGANIZACAO]
    senha: SecretStr = Field(min_length=8, max_length=1024)
    razao_social: str = Field(min_length=3, max_length=200)
    cnpj: str
    ativo: bool = Field(default=True, strict=True)
    homologada: bool = Field(default=True, strict=True)


CriarContaRequest = Annotated[
    CriarVoluntarioAdmin | CriarAdministradorAdmin | CriarOngAdmin,
    Field(discriminator="perfil"),
]


class ContaAdminPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: EmailStr
    perfil: Perfil
    ativo: bool
    tipo: TipoOrganizacao | None = None
    razao_social: str | None = None
    cnpj: str | None = None
    area_atuacao: str | None = None
    endereco: str | None = None
    responsavel: str | None = None
    descricao: str | None = None
    telefone: str | None = None
    homologada: bool | None = None
    consentimento_termos: bool | None = None
    quantidade_vagas: int = 0


class ListaContasResponse(BaseModel):
    itens: list[ContaAdminPublica]
    total: int
    pagina: int
    por_pagina: int
