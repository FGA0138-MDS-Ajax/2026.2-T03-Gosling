from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from app.vagas.enums import Modalidade, Periodo, StatusVaga
from app.causas.schemas import IdCausa
from app.localizacao.schemas import Localizacao, LocalizacaoPublica


class OcorrenciaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inicio: AwareDatetime
    fim: AwareDatetime

    @model_validator(mode="after")
    def validar_intervalo(self):
        if self.inicio >= self.fim:
            raise ValueError("O início do encontro deve ser anterior ao fim.")
        self.inicio = self.inicio.astimezone(UTC)
        self.fim = self.fim.astimezone(UTC)
        return self


def validar_url_publica(valor: str) -> str:
    import re

    if re.fullmatch(r"/api/v1/midia/[a-f0-9]{32}\.webp", valor):
        return valor
    from pydantic import TypeAdapter

    url = TypeAdapter(HttpUrl).validate_python(valor)
    if url.scheme != "https":
        raise ValueError("Use uma URL HTTPS para arquivos externos.")
    return str(url)


class DocumentoExigido(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nome: str = Field(min_length=2, max_length=150)
    modelo_url: str | None = Field(default=None, max_length=2000)

    @field_validator("modelo_url")
    @classmethod
    def url_segura(cls, valor):
        return validar_url_publica(valor) if valor else None


class CadastroVagaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(min_length=3, max_length=150)
    descricao: str = Field(min_length=10, max_length=5000)
    atividades: str = Field(min_length=10, max_length=5000)
    causa: str | None = Field(default=None, min_length=3, max_length=100)
    causa_id: IdCausa | None = None
    modalidade: Modalidade
    local: str = Field(min_length=3, max_length=500)
    localizacao: Localizacao | None = None
    origem_localizacao: Literal["PROPRIA", "ORGANIZACAO"] | None = None
    periodo: Periodo
    carga_horaria: Decimal = Field(gt=0, max_digits=7, decimal_places=2)
    numero_vagas: int = Field(gt=0, strict=True)
    ocorrencias: list[OcorrenciaRequest] = Field(min_length=1, max_length=100)
    fotos: list[Annotated[str, Field(max_length=2000)]] = Field(
        default_factory=list, max_length=10
    )
    documentos_exigidos: list[DocumentoExigido] = Field(
        default_factory=list, max_length=20
    )

    @field_validator("fotos")
    @classmethod
    def urls_seguras(cls, valor):
        return [validar_url_publica(url) for url in valor]

    @field_validator("causa_id", mode="before")
    @classmethod
    def causa_nao_nula(cls, valor):
        if valor is None:
            raise ValueError("Selecione uma causa do catálogo.")
        return valor

    @field_validator(
        "titulo", "descricao", "atividades", "causa", "local", mode="before"
    )
    @classmethod
    def limpar_textos(cls, valor: object) -> object:
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("carga_horaria")
    @classmethod
    def normalizar_horas(cls, valor: Decimal) -> Decimal:
        return valor.quantize(Decimal("0.01"))

    @model_validator(mode="after")
    def selecionar_causa(self):
        if (self.causa is None) == (self.causa_id is None):
            raise ValueError("Informe somente causa_id; o campo causa é legado.")
        return self

    @model_validator(mode="after")
    def endereco_da_atividade(self):
        if self.modalidade == Modalidade.REMOTO:
            if self.localizacao is not None or self.origem_localizacao is not None:
                raise ValueError("Atividade remota não usa endereço presencial.")
        elif self.origem_localizacao == "ORGANIZACAO":
            if self.localizacao is not None:
                raise ValueError(
                    "Escolha o endereço da organização ou um endereço próprio."
                )
        elif self.origem_localizacao == "PROPRIA" and self.localizacao is None:
            raise ValueError("Informe o endereço próprio da atividade.")
        return self

    @model_validator(mode="after")
    def validar_ocorrencias(self):
        self.ocorrencias.sort(key=lambda item: item.inicio)
        for anterior, atual in zip(self.ocorrencias, self.ocorrencias[1:]):
            if atual.inicio < anterior.fim:
                raise ValueError("Os encontros da vaga têm horários sobrepostos.")
        return self


class OrganizacaoResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    homologada: bool = False
    descricao: str | None = None


class CausaPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    codigo: str | None = None
    ativo: bool = False


class OcorrenciaPublica(OcorrenciaRequest):
    model_config = ConfigDict(from_attributes=True)

    id: int


class VagaPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descricao: str
    atividades: str
    causa: CausaPublica
    organizacao: OrganizacaoResumo
    modalidade: Modalidade
    local: str
    localizacao: LocalizacaoPublica | None = None
    origem_localizacao: str = "LEGADO"
    periodo: Periodo
    carga_horaria: Decimal
    numero_vagas: int
    status: StatusVaga
    ocorrencias: list[OcorrenciaPublica]
    fotos: list[str] = Field(default_factory=list)
    documentos_exigidos: list[DocumentoExigido] = Field(default_factory=list)
    candidaturas_disponiveis: bool = False

    @field_validator("fotos", "documentos_exigidos", mode="before")
    @classmethod
    def listas_existentes(cls, valor):
        return [] if valor is None else valor


class ListaVagasResponse(BaseModel):
    itens: list[VagaPublica]
    total: int
    pagina: int
    por_pagina: int


class AtualizarVagaRequest(BaseModel):
    titulo: Optional[str] = Field(None, min_length=3, max_length=100)
    descricao: Optional[str] = Field(None, min_length=10)
    cidade: Optional[str] = None
    estado_uf: Optional[str] = Field(None, min_length=2, max_length=2)
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    estado_vaga: Optional[str] = Field(
        None,
        description="Estado da vaga publicada: ABERTA, ENCERRADA ou SUSPENSA",
    )


class VagaResumoResponse(BaseModel):
    id: str
    titulo: str | None
    estado_vaga: str
    local: str | None = None
    cidade: Optional[str] = None
    estado_uf: Optional[str] = None
    data_criacao: datetime | None
    atualizado_em: datetime | None = None
    total_candidaturas: int = Field(
        default=0,
        description="Contagem acumulada de inscritos na vaga",
    )


class PaginatedResponseVagas(BaseModel):
    itens: List[VagaResumoResponse]
    pagina: int
    tamanho_pagina: int
    total_itens: int
    total_paginas: int
