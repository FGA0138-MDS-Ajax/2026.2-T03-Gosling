from enum import StrEnum


class Modalidade(StrEnum):
    PRESENCIAL = "PRESENCIAL"
    REMOTO = "REMOTO"
    HIBRIDO = "HIBRIDO"


class Periodo(StrEnum):
    MANHA = "MANHA"
    TARDE = "TARDE"
    NOITE = "NOITE"
    MADRUGADA = "MADRUGADA"


class StatusVaga(StrEnum):
    ABERTA = "ABERTA"
    ENCERRADA = "ENCERRADA"
    SUSPENSA = "SUSPENSA"
