import re

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    field_validator,
)

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


class AtualizarOrganizacaoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nome: str = Field(min_length=3, max_length=150)
    email: EmailStr = Field(max_length=254)
    razao_social: str | None = Field(default=None, min_length=3, max_length=200)
    cnpj: str | None = None
    area_atuacao: str = Field(min_length=3, max_length=150)
    endereco: str = Field(min_length=5, max_length=500)
    responsavel: str = Field(min_length=3, max_length=150)
    descricao: str = Field(default="", max_length=5000)
    telefone: str = Field(pattern=r"^[0-9]{10,15}$")

    @field_validator(
        "nome",
        "email",
        "razao_social",
        "area_atuacao",
        "endereco",
        "responsavel",
        "descricao",
        mode="before",
    )
    @classmethod
    def limpar_textos(cls, valor: object) -> object:
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        return valor.lower()

    @field_validator("telefone", mode="before")
    @classmethod
    def normalizar_telefone(cls, valor: object) -> object:
        if isinstance(valor, str):
            return valor.strip().translate(str.maketrans("", "", "()+- "))
        return valor

    @field_validator("cnpj")
    @classmethod
    def validar_cnpj(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        if not valor.isascii():
            raise ValueError("CNPJ inválido.")
        valor = valor.strip().upper().translate(str.maketrans("", "", "./-"))
        if not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", valor) or len(set(valor)) == 1:
            raise ValueError("CNPJ inválido.")
        base = valor[:12]
        pesos_dos_digitos = (
            (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2),
            (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2),
        )
        for pesos in pesos_dos_digitos:
            soma = sum(
                (ord(caractere) - 48) * peso
                for caractere, peso in zip(base, pesos, strict=True)
            )
            resto = soma % 11
            base += str(0 if resto < 2 else 11 - resto)
        if valor != base:
            raise ValueError("CNPJ inválido.")
        return valor


class CadastroOrganizacaoRequest(AtualizarOrganizacaoRequest):
    razao_social: str = Field(min_length=3, max_length=200)
    cnpj: str = Field(...)
    senha: SecretStr = Field(min_length=8, max_length=1024)
    consentimento_termos: bool = Field(strict=True)

    @field_validator("consentimento_termos")
    @classmethod
    def exigir_consentimento(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("É necessário aceitar os termos.")
        return valor


class OrganizacaoPublica(UsuarioPublico):
    razao_social: str | None = None
    cnpj: str | None = None
    area_atuacao: str | None = None
    endereco: str | None = None
    responsavel: str | None = None
    descricao: str | None = None
    telefone: str | None = None
    homologada: bool
