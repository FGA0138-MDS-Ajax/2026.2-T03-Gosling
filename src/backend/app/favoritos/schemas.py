from pydantic import BaseModel, ConfigDict


class SemParametros(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VagasSalvasResponse(BaseModel):
    vaga_ids: list[int]
