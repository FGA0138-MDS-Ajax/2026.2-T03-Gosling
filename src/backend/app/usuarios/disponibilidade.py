from typing import Literal

from pydantic import BaseModel, ConfigDict

Dia = Literal["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"]
Turno = Literal["MANHA", "TARDE", "NOITE"]
DIAS = ("SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO")
TURNOS = ("MANHA", "TARDE", "NOITE")


class FaixaDisponibilidade(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dia: Dia
    periodo: Turno


def ler_disponibilidade_legada(itens: list[str] | None) -> list[dict[str, str]]:
    itens = itens or []
    dias = [dia for dia in DIAS if f"DIA:{dia}" in itens]
    turnos = [turno for turno in TURNOS if f"PERIODO:{turno}" in itens]
    return [{"dia": dia, "periodo": turno} for dia in dias for turno in turnos]


def ler_carga_legada(itens: list[str] | None) -> int | None:
    for item in itens or []:
        if item.startswith("CARGA_HORARIA:"):
            valor = item.removeprefix("CARGA_HORARIA:")
            if valor.isascii() and valor.isdigit() and 1 <= int(valor) <= 60:
                return int(valor)
    return None


def atualizar_legado(itens, faixas, carga):
    outros = [
        item
        for item in itens or []
        if item
        not in {
            *(f"DIA:{dia}" for dia in DIAS),
            *(f"PERIODO:{turno}" for turno in TURNOS),
        }
        and not item.startswith("CARGA_HORARIA:")
    ]
    return [
        *[f"DIA:{dia}" for dia in DIAS if any(f["dia"] == dia for f in faixas)],
        *[
            f"PERIODO:{turno}"
            for turno in TURNOS
            if any(f["periodo"] == turno for f in faixas)
        ],
        *outros,
        *([f"CARGA_HORARIA:{carga}"] if carga is not None else []),
    ]
