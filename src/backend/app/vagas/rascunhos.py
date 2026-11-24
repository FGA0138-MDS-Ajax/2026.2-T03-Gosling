from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_serializer,
    field_validator,
)

from app.causas.schemas import IdCausa
from app.localizacao.schemas import Localizacao
from app.vagas.enums import Modalidade, Periodo
from app.vagas.schemas import CadastroVagaRequest, validar_url_publica

BRASILIA = ZoneInfo("America/Sao_Paulo")


class EncontroRascunho(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data_inicio: date | None = None
    hora_inicio: time | None = None
    data_fim: date | None = None
    hora_fim: time | None = None

    @field_validator("hora_inicio", "hora_fim")
    @classmethod
    def hora_local(cls, valor: time | None) -> time | None:
        if valor is not None and (valor.tzinfo or valor.second or valor.microsecond):
            raise ValueError("Informe a hora no horário de Brasília, no formato HH:MM.")
        return valor

    @field_serializer("hora_inicio", "hora_fim", when_used="json")
    def serializar_hora(self, valor: time | None) -> str | None:
        return valor.isoformat(timespec="minutes") if valor is not None else None

    def para_publicacao(self) -> dict:
        if None in (self.data_inicio, self.hora_inicio, self.data_fim, self.hora_fim):
            raise ValueError("Preencha as datas e os horários do encontro.")

        return {
            "inicio": horario_brasilia(self.data_inicio, self.hora_inicio),
            "fim": horario_brasilia(self.data_fim, self.hora_fim),
        }


def horario_brasilia(dia: date, hora: time) -> datetime:
    local = datetime.combine(dia, hora, tzinfo=BRASILIA)
    utc = local.astimezone(UTC)
    if utc.astimezone(BRASILIA).replace(tzinfo=None) != local.replace(tzinfo=None):
        raise ValueError("Data ou horário inválido no horário de Brasília.")
    return utc


class DocumentoRascunho(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str = Field(default="", max_length=150)
    modelo_url: str | None = Field(default=None, max_length=2000)


class DadosRascunho(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str | None = Field(default=None, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)
    atividades: str | None = Field(default=None, max_length=5000)
    causa_id: IdCausa | None = None
    modalidade: Modalidade | None = None
    local: str | None = Field(default=None, max_length=500)
    localizacao: Localizacao | None = None
    origem_localizacao: Literal["PROPRIA", "ORGANIZACAO"] | None = None
    periodo: Periodo | None = None
    carga_horaria: Decimal | None = Field(default=None, max_digits=7, decimal_places=2)
    numero_vagas: int | None = Field(default=None, strict=True)
    ocorrencias: list[EncontroRascunho] = Field(default_factory=list, max_length=100)
    fotos: list[Annotated[str, Field(max_length=2000)]] = Field(
        default_factory=list, max_length=10
    )
    documentos_exigidos: list[DocumentoRascunho] = Field(
        default_factory=list, max_length=20
    )

    @field_validator("fotos")
    @classmethod
    def urls_das_fotos(cls, valor):
        return [validar_url_publica(url) for url in valor]

    def para_publicacao(self) -> CadastroVagaRequest:
        dados = self.model_dump(exclude_none=True, exclude={"ocorrencias"})
        dados["ocorrencias"] = []
        erros = []

        for indice, encontro in enumerate(self.ocorrencias):
            try:
                dados["ocorrencias"].append(encontro.para_publicacao())
            except (ValueError, OverflowError) as erro:
                erros.append(
                    {
                        "loc": ("body", "ocorrencias", indice),
                        "type": "value_error",
                        "msg": str(erro),
                    }
                )

        if erros:
            raise RequestValidationError(erros)

        try:
            return CadastroVagaRequest.model_validate(dados)
        except ValidationError as erro:
            raise RequestValidationError(
                [
                    {**item, "loc": ("body", *item["loc"])}
                    for item in erro.errors(include_input=False, include_context=False)
                ]
            ) from None


class PublicarRascunhoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    versao: int = Field(ge=1, strict=True)
    dados: DadosRascunho | None = None


class AtualizarRascunhoRequest(PublicarRascunhoRequest):
    dados: DadosRascunho


class RascunhoResponse(BaseModel):
    id: int
    status: Literal["RASCUNHO"] = "RASCUNHO"
    versao: int
    criado_em: datetime
    atualizado_em: datetime
    dados: DadosRascunho


def erro_versao() -> HTTPException:
    return HTTPException(
        409, "O rascunho foi alterado em outra aba. Abra a versão mais recente."
    )
