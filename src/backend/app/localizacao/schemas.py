import re
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


class Localizacao(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    cep: str | None = None
    logradouro: str | None = Field(default=None, min_length=1, max_length=200)
    numero: str | None = Field(default=None, min_length=1, max_length=30)
    complemento: str | None = Field(default=None, min_length=1, max_length=100)
    bairro: str | None = Field(default=None, min_length=1, max_length=100)
    regiao_administrativa: str | None = Field(
        default=None, min_length=1, max_length=100
    )
    cidade: str | None = Field(default=None, min_length=2, max_length=100)
    estado: UF | None = None
    latitude: Decimal | None = Field(
        default=None, ge=-90, le=90, max_digits=10, decimal_places=7
    )
    longitude: Decimal | None = Field(
        default=None, ge=-180, le=180, max_digits=10, decimal_places=7
    )
    origem_coordenadas: Literal["MANUAL", "NAVEGADOR"] | None = None

    @field_validator("cep", mode="before")
    @classmethod
    def normalizar_cep(cls, valor):
        if valor is None:
            return None
        if not isinstance(valor, str) or not re.fullmatch(
            r"[0-9]{5}-?[0-9]{3}", valor.strip()
        ):
            raise ValueError("Informe um CEP com oito dígitos.")
        return valor.strip().replace("-", "")

    @model_validator(mode="after")
    def validar_coordenadas(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Informe latitude e longitude juntas.")
        if self.latitude is None:
            if self.origem_coordenadas is not None:
                raise ValueError("Informe as coordenadas antes de indicar sua origem.")
        elif self.origem_coordenadas is None:
            self.origem_coordenadas = "MANUAL"
        return self


def validar_regiao_compativel(dados):
    localizacao = dados.localizacao
    if "localizacao" in dados.model_fields_set:
        for campo in ("cidade", "estado"):
            antigo = getattr(dados, campo, None)
            novo = getattr(localizacao, campo, None)
            if antigo is not None and antigo != novo:
                raise ValueError(
                    "A cidade e a UF devem ser iguais nos dados de localização."
                )
    return dados


class LocalizacaoPublica(Localizacao):
    # A região anterior pode ser parcial; a leitura não revalida o legado.
    cidade: str | None = None
    estado: str | None = None
