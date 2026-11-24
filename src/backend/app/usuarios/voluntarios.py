from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.schemas import LoginResponse
from app.auth.service import criar_sessao
from app.causas.repository import CausaRepository
from app.causas.schemas import IdCausa
from app.causas.service import CatalogoService, nomes_legados
from app.core.database import get_db
from app.core.midia import confirmar_upload, remover_imagem_sem_vinculo, salvar_imagem
from app.core.security import hash_password
from app.localizacao.models import aplicar_localizacao
from app.localizacao.schemas import (
    Localizacao,
    LocalizacaoPublica,
    validar_regiao_compativel,
)
from app.midias.models import UsoMidia
from app.dependencies import require_perfil
from app.usuarios.disponibilidade import (
    DIAS,
    TURNOS,
    FaixaDisponibilidade,
    atualizar_legado,
    ler_carga_legada,
    ler_disponibilidade_legada,
)
from app.usuarios.enums import Perfil
from app.usuarios.models import Usuario, Voluntario
from app.usuarios.schemas import UsuarioPublico
from app.usuarios.validacoes import PADRAO_TELEFONE, SenhaCadastro
from app.usuarios.validacoes import normalizar_telefone as normalizar_numero_telefone

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
    localizacao: Localizacao | None = None
    password: SenhaCadastro
    consentimento_termos: bool = Field(strict=True)
    causas: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(
        default_factory=list, max_length=100
    )
    causa_ids: list[IdCausa] | None = Field(default=None, max_length=100)
    disponibilidade_semanal: list[FaixaDisponibilidade] = Field(
        default_factory=list, max_length=21
    )
    carga_horaria_semanal: int | None = Field(default=None, ge=1, le=60, strict=True)

    @model_validator(mode="after")
    def contrato_de_interesses(self):
        if "causa_ids" in self.model_fields_set:
            if self.causa_ids is None or "causas" in self.model_fields_set:
                raise ValueError(
                    "Informe causa_ids como lista, sem o campo legado causas."
                )
        return self

    @model_validator(mode="after")
    def regiao_compativel(self):
        return validar_regiao_compativel(self)

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
    localizacao: Localizacao | None = None
    biografia: str | None = Field(default=None, max_length=500)
    causas: list[ItemPerfil] | None = Field(default=None, max_length=100)
    causa_ids: list[IdCausa] | None = Field(default=None, max_length=100)
    causas_legadas: list[str] | None = Field(default=None, max_length=100)
    disponibilidades: list[Disponibilidade] | None = Field(default=None, max_length=100)
    disponibilidade_semanal: list[FaixaDisponibilidade] | None = Field(
        default=None, max_length=21
    )
    carga_horaria_semanal: int | None = Field(default=None, ge=1, le=60, strict=True)

    @model_validator(mode="after")
    def contrato_de_interesses(self):
        return Cadastro.contrato_de_interesses(self)

    @model_validator(mode="after")
    def regiao_compativel(self):
        return validar_regiao_compativel(self)

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
    localizacao: LocalizacaoPublica | None = None
    biografia: str | None
    causas: list[str]
    causa_ids: list[int] = Field(default_factory=list)
    causas_legadas: list[str] = Field(default_factory=list)
    disponibilidades: list[str]
    disponibilidade_semanal: list[FaixaDisponibilidade] = Field(default_factory=list)
    carga_horaria_semanal: int | None = None
    foto_url: str | None = None

    @field_validator(
        "causas",
        "causa_ids",
        "disponibilidades",
        "disponibilidade_semanal",
        mode="before",
    )
    @classmethod
    def listas_de_contas_existentes(cls, valor, info):
        if info.field_name == "causas":
            return nomes_legados(valor)
        return [] if valor is None else valor


@router.post("", response_model=LoginResponse, status_code=201)
def cadastrar(dados: Cadastro, db: Banco, response: Response):
    if not dados.consentimento_termos:
        raise HTTPException(400, "É necessário aceitar os termos.")
    email = str(dados.email).lower()
    catalogo = CatalogoService(CausaRepository(db))
    if dados.causa_ids is not None:
        ids = catalogo.validar_ids(dados.causa_ids)
    else:
        ids, _ = catalogo.resolver_nomes(dados.causas)
    conta = Voluntario(
        nome=dados.nome_completo,
        email=email,
        identificacao=dados.identificacao,
        telefone=dados.telefone,
        cidade=dados.cidade,
        estado=dados.estado,
        consentimento_termos=True,
        senha_hash=hash_password(dados.password.get_secret_value()),
        causas=catalogo.nomes_para_exibicao(ids, []),
        causa_ids=ids,
        disponibilidade_semanal=[f.model_dump() for f in dados.disponibilidade_semanal],
        carga_horaria_semanal=dados.carga_horaria_semanal,
    )
    if dados.localizacao is not None:
        aplicar_localizacao(conta, dados.localizacao)
        conta.cidade = dados.localizacao.cidade or dados.cidade
        conta.estado = dados.localizacao.estado or dados.estado
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
def consultar(conta: Conta, db: Banco, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return montar_perfil(conta, db)


def montar_perfil(conta: Voluntario, db: Session) -> PerfilVoluntario:
    perfil = PerfilVoluntario.model_validate(conta)
    catalogo = CatalogoService(CausaRepository(db))
    ids, legadas = catalogo.interesses_atuais(conta.causa_ids, conta.causas)
    perfil.causa_ids = ids
    perfil.causas_legadas = legadas
    perfil.causas = catalogo.nomes_para_exibicao(ids, legadas)
    if conta.disponibilidade_semanal is None:
        perfil.disponibilidade_semanal = [
            FaixaDisponibilidade(**faixa)
            for faixa in ler_disponibilidade_legada(conta.disponibilidades)
        ]
        perfil.carga_horaria_semanal = ler_carga_legada(conta.disponibilidades)
    return perfil


@router.put("/me", response_model=PerfilVoluntario)
def atualizar(dados: Edicao, conta: Conta, db: Banco, response: Response):
    response.headers["Cache-Control"] = "no-store"
    campos = dados.model_dump(exclude_unset=True)
    if any(campo in campos for campo in ("causa_ids", "causas", "causas_legadas")):
        catalogo = CatalogoService(CausaRepository(db))
        anteriores, legadas = catalogo.interesses_atuais(conta.causa_ids, conta.causas)
        if "causa_ids" in campos:
            ids = catalogo.validar_ids(campos.pop("causa_ids"), anteriores)
        elif "causas" in campos:
            ids, legadas = catalogo.resolver_nomes(
                campos.pop("causas") or [], anteriores, legadas
            )
        else:
            ids = anteriores
        if "causas_legadas" in campos:
            legadas = catalogo.validar_legadas(
                campos.pop("causas_legadas") or [], legadas
            )
        conta.causa_ids = ids
        conta.causas = catalogo.nomes_para_exibicao(ids, legadas)
    if "localizacao" in campos:
        aplicar_localizacao(conta, dados.localizacao)
        campos.pop("localizacao")
        # O objeto novo contém a região; não aplique novamente os campos legados.
        campos.pop("cidade", None)
        campos.pop("estado", None)
    elif any(
        campo in campos and campos[campo] != getattr(conta, campo)
        for campo in ("cidade", "estado")
    ):
        # A região mudou sem confirmação de um novo ponto.
        cidade_anterior, estado_anterior = conta.cidade, conta.estado
        aplicar_localizacao(conta, None)
        conta.cidade, conta.estado = cidade_anterior, estado_anterior
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
    return montar_perfil(conta, db)


@router.put("/me/foto", response_model=PerfilVoluntario)
async def atualizar_foto(request: Request, conta: Conta, db: Banco, response: Response):
    response.headers["Cache-Control"] = "no-store"
    anterior = conta.foto_url
    arquivo = await salvar_imagem(request, db, conta.id, UsoMidia.AVATAR)
    conta.foto_url = arquivo.url
    confirmar_upload(db, arquivo)
    remover_imagem_sem_vinculo(db, anterior)
    return montar_perfil(conta, db)


@router.delete("/me/foto", response_model=PerfilVoluntario)
def excluir_foto(conta: Conta, db: Banco, response: Response):
    response.headers["Cache-Control"] = "no-store"
    anterior = conta.foto_url
    conta.foto_url = None
    db.commit()
    remover_imagem_sem_vinculo(db, anterior)
    return montar_perfil(conta, db)
