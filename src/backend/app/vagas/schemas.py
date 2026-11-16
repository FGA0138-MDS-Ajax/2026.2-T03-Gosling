
from datetime import UTC, datetime
from decimal import Decimal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.vagas.enums import Modalidade, Periodo, StatusVaga


# ============================================================
# OCORRÊNCIAS
# ============================================================

class OcorrenciaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inicio: AwareDatetime
    fim: AwareDatetime

    @model_validator(mode="after")
    def validar_intervalo(self):
        if self.inicio >= self.fim:
            raise ValueError(
                "O início do encontro deve ser anterior ao fim."
            )

        self.inicio = self.inicio.astimezone(UTC)
        self.fim = self.fim.astimezone(UTC)

        return self


class OcorrenciaPublica(OcorrenciaRequest):
    model_config = ConfigDict(from_attributes=True)

    id: int


# ============================================================
# CADASTRO DE VAGAS
# ============================================================

class CadastroVagaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(min_length=3, max_length=150)
    descricao: str = Field(min_length=10, max_length=5000)
    atividades: str = Field(min_length=10, max_length=5000)
    causa: str = Field(min_length=3, max_length=100)
    modalidade: Modalidade
    local: str = Field(min_length=3, max_length=500)
    periodo: Periodo
    carga_horaria: Decimal = Field(
        gt=0,
        max_digits=7,
        decimal_places=2,
    )
    numero_vagas: int = Field(gt=0, strict=True)
    ocorrencias: list[OcorrenciaRequest] = Field(
        min_length=1,
        max_length=100,
    )

    @field_validator(
        "titulo",
        "descricao",
        "atividades",
        "causa",
        "local",
        mode="before",
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

        for anterior, atual in zip(
            self.ocorrencias,
            self.ocorrencias[1:],
        ):
            if atual.inicio < anterior.fim:
                raise ValueError(
                    "Os encontros da vaga têm horários sobrepostos."
                )

        return self


 

class AtualizarVagaRequest(BaseModel):
    """
    DTO para atualização parcial dos dados de uma vaga.

    Os campos são opcionais para permitir alterações específicas.
    """

    model_config = ConfigDict(extra="forbid")

    titulo: str | None = Field(
        default=None,
        min_length=3,
        max_length=150,
    )
    descricao: str | None = Field(
        default=None,
        min_length=10,
        max_length=5000,
    )
    atividades: str | None = Field(
        default=None,
        min_length=10,
        max_length=5000,
    )
    causa: str | None = Field(
        default=None,
        min_length=3,
        max_length=100,
    )
    modalidade: Modalidade | None = None
    local: str | None = Field(
        default=None,
        min_length=3,
        max_length=500,
    )
    periodo: Periodo | None = None
    carga_horaria: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=7,
        decimal_places=2,
    )
    numero_vagas: int | None = Field(
        default=None,
        gt=0,
        strict=True,
    )
    ocorrencias: list[OcorrenciaRequest] | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    status: StatusVaga | None = None

    @field_validator(
        "titulo",
        "descricao",
        "atividades",
        "causa",
        "local",
        mode="before",
    )
    @classmethod
    def limpar_textos(cls, valor: object) -> object:
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("carga_horaria")
    @classmethod
    def normalizar_horas(
        cls,
        valor: Decimal | None,
    ) -> Decimal | None:
        if valor is None:
            return None

        return valor.quantize(Decimal("0.01"))

    @model_validator(mode="after")
    def validar_atualizacao(self):
        if not self.model_fields_set:
            raise ValueError(
                "Informe pelo menos um campo para atualizar."
            )

        if self.ocorrencias is not None:
            self.ocorrencias.sort(key=lambda item: item.inicio)

            for anterior, atual in zip(
                self.ocorrencias,
                self.ocorrencias[1:],
            ):
                if atual.inicio < anterior.fim:
                    raise ValueError(
                        "Os encontros da vaga têm horários sobrepostos."
                    )

        return self


 

class OrganizacaoResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str


class CausaPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str


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

 

class VagaResumoResponse(BaseModel):
    """
    DTO resumido para listagens de vagas.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    status: StatusVaga
    local: str
    data_criacao: datetime
    total_candidaturas: int = Field(
        default=0,
        description="Contagem acumulada de inscritos na vaga",
    )


class ListaVagasResponse(BaseModel):
    itens: list[VagaPublica]
    total: int
    pagina: int
    por_pagina: int


class PaginatedResponseVagas(BaseModel):
    """
    Envelope para respostas paginadas de listagens resumidas.
    """

    itens: list[VagaResumoResponse]
    pagina: int
    tamanho_pagina: int
    total_itens: int
    total_paginas: int
