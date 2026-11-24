from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

IdCausa = Annotated[int, Field(strict=True, gt=0)]


class CausaCatalogo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str | None
    nome: str
    ativo: bool
    aliases: list[str]

    @field_validator("aliases", mode="before")
    @classmethod
    def lista_existente(cls, valor):
        return valor or []
