from enum import StrEnum


class StatusCandidatura(StrEnum):
    PENDENTE = "PENDENTE"
    ACEITA = "ACEITA"
    RECUSADA = "RECUSADA"
    CANCELADA = "CANCELADA"


STATUS_ATIVOS = (StatusCandidatura.PENDENTE, StatusCandidatura.ACEITA)
