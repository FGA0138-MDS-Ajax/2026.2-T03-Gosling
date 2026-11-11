from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.schemas import LoginResponse
from app.auth.service import criar_sessao
from app.core.database import get_db
from app.core.security import hash_password
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.models import Usuario, Voluntario
from app.usuarios.schemas import UsuarioPublico

router = APIRouter(prefix="/voluntarios", tags=["Voluntários"])
Banco = Annotated[Session, Depends(get_db)]
Titular = Annotated[UsuarioPublico, Depends(require_perfil(Perfil.VOLUNTARIO))]


UF = Literal[
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
]


class Cadastro(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome_completo: str = Field(min_length=3, max_length=150)
    email: EmailStr = Field(max_length=254)
    identificacao: str = Field(min_length=11, max_length=20)
    telefone: str | None = Field(default=None, pattern=r"^[0-9]{10,15}$")
    cidade: str | None = Field(default=None, min_length=2, max_length=100)
    estado: UF | None = None
    password: SecretStr = Field(min_length=8, max_length=1024)
    consentimento_termos: bool = Field(strict=True)

    @field_validator("nome_completo", "cidade", mode="before")
    @classmethod
    def limpar(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("identificacao")
    @classmethod
    def validar_cpf(cls, valor: str) -> str:
        cpf = valor.strip().replace(".", "").replace("-", "")
        if (
            len(cpf) != 11
            or not cpf.isascii()
            or not cpf.isdigit()
            or len(set(cpf)) == 1
        ):
            raise ValueError("CPF inválido.")
        for tamanho in (9, 10):
            soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
            digito = (soma * 10 % 11) % 10
            if int(cpf[tamanho]) != digito:
                raise ValueError("CPF inválido.")
        return cpf


ItemPerfil = Annotated[str, Field(min_length=1, max_length=100)]


class Edicao(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nome_completo: str | None = Field(default=None, min_length=2, max_length=150)
    telefone: str | None = Field(default=None, max_length=20)
    cidade: str | None = Field(default=None, max_length=100)
    estado: UF | None = None
    biografia: str | None = Field(default=None, max_length=500)
    causas: list[ItemPerfil] | None = Field(default=None, max_length=100)
    disponibilidades: list[ItemPerfil] | None = Field(default=None, max_length=100)


class PerfilVoluntario(UsuarioPublico):
    identificacao: str | None
    telefone: str | None
    cidade: str | None
    estado: str | None
    biografia: str | None
    causas: list[str]
    disponibilidades: list[str]

    @field_validator("causas", "disponibilidades", mode="before")
    @classmethod
    def listas_de_contas_existentes(cls, valor):
        return [] if valor is None else valor


@router.post("", response_model=LoginResponse, status_code=201)
def cadastrar(dados: Cadastro, db: Banco, response: Response):
    if not dados.consentimento_termos:
        raise HTTPException(400, "É necessário aceitar os termos.")
    email = str(dados.email).lower()
    conta = Voluntario(
        nome=dados.nome_completo,
        email=email,
        identificacao=dados.identificacao,
        telefone=dados.telefone,
        cidade=dados.cidade,
        estado=dados.estado,
        consentimento_termos=True,
        senha_hash=hash_password(dados.password.get_secret_value()),
    )
    try:
        db.add(conta)
        db.flush()
        sessao = criar_sessao(UsuarioPublico.model_validate(conta))
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(Usuario.id).where(Usuario.email == email)) is not None:
            raise HTTPException(409, "E-mail já cadastrado.") from None
        if (
            db.scalar(
                select(Voluntario.id).where(
                    Voluntario.identificacao == dados.identificacao
                )
            )
            is not None
        ):
            raise HTTPException(409, "Documento já cadastrado.") from None
        raise
    response.headers["Cache-Control"] = "no-store"
    return sessao


def obter_conta(db: Banco, titular: Titular) -> Voluntario:
    conta = db.get(Voluntario, titular.id)
    if conta is None:
        raise HTTPException(404, "Voluntário não encontrado.")
    return conta


Conta = Annotated[Voluntario, Depends(obter_conta)]


@router.get("/me", response_model=PerfilVoluntario)
def consultar(conta: Conta):
    return conta


@router.put("/me", response_model=PerfilVoluntario)
def atualizar(dados: Edicao, conta: Conta, db: Banco):
    campos = dados.model_dump(exclude_unset=True)
    nome = campos.pop("nome_completo", None)
    if nome is not None:
        conta.nome = nome
    for campo, valor in campos.items():
        setattr(conta, campo, valor)
    db.commit()
    return conta
