from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.schemas import LoginResponse
from app.auth.service import criar_sessao
from app.core.database import get_db
from app.core.security import hash_password
from app.core.midia import remover_imagem_local, salvar_imagem
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.models import Usuario, Voluntario
from app.usuarios.schemas import UsuarioPublico
from app.usuarios.validacoes import PADRAO_TELEFONE, SenhaCadastro
from app.usuarios.validacoes import normalizar_telefone as normalizar_numero_telefone
from app.usuarios.disponibilidade import (
    DIAS,
    TURNOS,
    FaixaDisponibilidade,
    atualizar_legado,
    ler_carga_legada,
    ler_disponibilidade_legada,
)

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
    telefone: str | None = Field(default=None, pattern=PADRAO_TELEFONE)
    cidade: str | None = Field(default=None, min_length=2, max_length=100)
    estado: UF | None = None
    password: SenhaCadastro
    consentimento_termos: bool = Field(strict=True)
    causas: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(
        default_factory=list, max_length=100
    )
    disponibilidade_semanal: list[FaixaDisponibilidade] = Field(
        default_factory=list, max_length=21
    )
    carga_horaria_semanal: int | None = Field(default=None, ge=1, le=60, strict=True)

    @field_validator("disponibilidade_semanal")
    @classmethod
    def faixas_unicas(cls, valor):
        if len({(f.dia, f.periodo) for f in valor}) != len(valor):
            raise ValueError("Cada combinação de dia e período deve aparecer uma vez.")
        return valor

    @field_validator("nome_completo", "cidade", "email", mode="before")
    @classmethod
    def limpar(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("telefone", mode="before")
    @classmethod
    def normalizar_telefone(cls, valor):
        if isinstance(valor, str):
            return normalizar_numero_telefone(valor) or None
        return valor

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


def validar_disponibilidade(valor: str) -> str:
    tipo, _, preferencia = valor.partition(":")
    if tipo == "DIA" and preferencia not in DIAS:
        raise ValueError("Informe um dia da semana válido.")
    if tipo == "PERIODO" and preferencia not in TURNOS:
        raise ValueError("Informe um período válido: MANHA, TARDE ou NOITE.")
    if tipo == "CARGA_HORARIA" and (
        not preferencia.isascii()
        or not preferencia.isdigit()
        or not 1 <= int(preferencia) <= 60
    ):
        raise ValueError("Informe um número inteiro de horas entre 1 e 60.")
    # Textos anteriores ao formato com prefixos continuam compatíveis.
    return valor


Disponibilidade = Annotated[ItemPerfil, AfterValidator(validar_disponibilidade)]


class Edicao(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nome_completo: str | None = Field(default=None, min_length=2, max_length=150)
    telefone: str | None = Field(default=None, pattern=PADRAO_TELEFONE)
    cidade: str | None = Field(default=None, max_length=100)
    estado: UF | None = None
    biografia: str | None = Field(default=None, max_length=500)
    causas: list[ItemPerfil] | None = Field(default=None, max_length=100)
    disponibilidades: list[Disponibilidade] | None = Field(default=None, max_length=100)
    disponibilidade_semanal: list[FaixaDisponibilidade] | None = Field(
        default=None, max_length=21
    )
    carga_horaria_semanal: int | None = Field(default=None, ge=1, le=60, strict=True)

    @field_validator("disponibilidades")
    @classmethod
    def carga_horaria_unica(cls, valor):
        if valor and sum(item.startswith("CARGA_HORARIA:") for item in valor) > 1:
            raise ValueError("Informe apenas uma carga horária semanal.")
        return valor

    @field_validator("disponibilidade_semanal")
    @classmethod
    def faixas_unicas(cls, valor):
        return Cadastro.faixas_unicas(valor) if valor is not None else valor

    @field_validator("telefone", mode="before")
    @classmethod
    def normalizar_telefone(cls, valor):
        return Cadastro.normalizar_telefone(valor)


class PerfilVoluntario(UsuarioPublico):
    identificacao: str | None
    telefone: str | None
    cidade: str | None
    estado: str | None
    biografia: str | None
    causas: list[str]
    disponibilidades: list[str]
    disponibilidade_semanal: list[FaixaDisponibilidade] = Field(default_factory=list)
    carga_horaria_semanal: int | None = None
    foto_url: str | None = None

    @field_validator(
        "causas", "disponibilidades", "disponibilidade_semanal", mode="before"
    )
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
        causas=dados.causas,
        disponibilidade_semanal=[f.model_dump() for f in dados.disponibilidade_semanal],
        carga_horaria_semanal=dados.carga_horaria_semanal,
    )
    conta.disponibilidades = atualizar_legado(
        [], conta.disponibilidade_semanal, conta.carga_horaria_semanal
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
    return montar_perfil(conta)


def montar_perfil(conta: Voluntario) -> PerfilVoluntario:
    perfil = PerfilVoluntario.model_validate(conta)
    if conta.disponibilidade_semanal is None:
        perfil.disponibilidade_semanal = [
            FaixaDisponibilidade(**faixa)
            for faixa in ler_disponibilidade_legada(conta.disponibilidades)
        ]
        perfil.carga_horaria_semanal = ler_carga_legada(conta.disponibilidades)
    return perfil


@router.put("/me", response_model=PerfilVoluntario)
def atualizar(dados: Edicao, conta: Conta, db: Banco):
    campos = dados.model_dump(exclude_unset=True)
    nome = campos.pop("nome_completo", None)
    if nome is not None:
        conta.nome = nome
    if "disponibilidade_semanal" in campos or "carga_horaria_semanal" in campos:
        faixas_atuais = conta.disponibilidade_semanal
        carga_atual = conta.carga_horaria_semanal
        if faixas_atuais is None:
            faixas_atuais = ler_disponibilidade_legada(conta.disponibilidades)
            carga_atual = ler_carga_legada(conta.disponibilidades)
        conta.disponibilidade_semanal = (
            campos.pop("disponibilidade_semanal", faixas_atuais) or []
        )
        conta.carga_horaria_semanal = campos.pop("carga_horaria_semanal", carga_atual)
        conta.disponibilidades = atualizar_legado(
            conta.disponibilidades,
            conta.disponibilidade_semanal,
            conta.carga_horaria_semanal,
        )
        campos.pop("disponibilidades", None)
    elif "disponibilidades" in campos:
        faixas_anteriores = ler_disponibilidade_legada(conta.disponibilidades)
        faixas_recebidas = ler_disponibilidade_legada(campos["disponibilidades"])
        # O formato antigo agrega dias e períodos e perde os pares exatos da grade.
        # Reenviar os mesmos dias/períodos não representa uma alteração desses pares.
        if (
            conta.disponibilidade_semanal is None
            or faixas_recebidas != faixas_anteriores
        ):
            conta.disponibilidade_semanal = faixas_recebidas
        conta.carga_horaria_semanal = ler_carga_legada(campos["disponibilidades"])
    for campo, valor in campos.items():
        setattr(conta, campo, valor)
    db.commit()
    return montar_perfil(conta)


@router.put("/me/foto", response_model=PerfilVoluntario)
async def atualizar_foto(request: Request, conta: Conta, db: Banco):
    anterior = conta.foto_url
    nova = await salvar_imagem(request, avatar=True)
    try:
        conta.foto_url = nova
        db.commit()
    except Exception:
        db.rollback()
        remover_imagem_local(nova)
        raise
    remover_imagem_local(anterior)
    return montar_perfil(conta)


@router.delete("/me/foto", response_model=PerfilVoluntario)
def excluir_foto(conta: Conta, db: Banco):
    anterior = conta.foto_url
    conta.foto_url = None
    db.commit()
    remover_imagem_local(anterior)
    return montar_perfil(conta)
