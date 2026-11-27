from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    computed_field,
    field_validator,
    model_validator,
)

from app.vagas.enums import Modalidade, Periodo, StatusVaga


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
    causa: str = Field(min_length=3, max_length=100)
    modalidade: Modalidade
    local: str = Field(min_length=3, max_length=500)
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
    periodo: Periodo
    carga_horaria: Decimal
    numero_vagas: int
    status: StatusVaga
    ocorrencias: list[OcorrenciaPublica]
    fotos: list[str] = Field(default_factory=list)
    documentos_exigidos: list[DocumentoExigido] = Field(default_factory=list)
    @computed_field
    @property
    def candidaturas_disponiveis(self) -> bool:
        agora = datetime.now(UTC)
        return self.status == StatusVaga.ABERTA and any(
            encontro.fim > agora for encontro in self.ocorrencias
        )

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
    model_config = ConfigDict(extra="forbid")

    titulo: str | None = None
    descricao: str | None = None
    atividades: str | None = None
    causa: str | None = None
    modalidade: Modalidade | None = None
    local: str | None = None
    periodo: Periodo | None = None
    carga_horaria: Decimal | None = None
    numero_vagas: int | None = Field(default=None, strict=True)
    ocorrencias: list[OcorrenciaRequest] | None = None
    fotos: list[str] | None = None
    documentos_exigidos: list[DocumentoExigido] | None = None
    estado_vaga: Literal["ENCERRADA"] | None = None

    @model_validator(mode="after")
    def rejeitar_campos_nulos(self):
        if any(getattr(self, campo) is None for campo in self.model_fields_set):
            raise ValueError("Campos enviados para edição não podem ser nulos.")
        return self


class VagaInstitucional(VagaPublica):
    horarios_bloqueados: bool

    @computed_field
    @property
    def estado_vaga(self) -> StatusVaga:
        return self.status


class VagaResumoResponse(BaseModel):
    id: str
    titulo: str
    estado_vaga: str
    local: str | None = None
    descricao: str | None = None
    cidade: Optional[str] = None
    estado_uf: Optional[str] = None
    data_criacao: Optional[datetime] = None
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
