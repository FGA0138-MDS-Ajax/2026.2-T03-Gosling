import re
from datetime import date

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.candidaturas.enums import StatusCandidatura


class IntervaloCalendario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inicio: date
    fim: date

    @field_validator("inicio", "fim", mode="before")
    @classmethod
    def datas_sem_horario(cls, valor):
        if not isinstance(valor, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", valor):
            raise ValueError("Informe uma data no formato AAAA-MM-DD, sem horário.")
        return valor

    @model_validator(mode="after")
    def inicio_anterior_ao_fim(self):
        if self.inicio >= self.fim:
            raise ValueError(
                "O início deve ser anterior ao fim exclusivo do intervalo."
            )
        return self


class OrganizacaoCalendario(BaseModel):
    id: int
    nome: str


class EventoCalendario(BaseModel):
    candidatura_id: int
    vaga_id: int
    titulo_vaga: str
    organizacao: OrganizacaoCalendario
    status: StatusCandidatura
    inicio: AwareDatetime
    fim: AwareDatetime
