from enum import StrEnum


class Perfil(StrEnum):
    VOLUNTARIO = "VOLUNTARIO"
    ORGANIZACAO = "ORGANIZACAO"
    ADMINISTRADOR = "ADMINISTRADOR"


class TipoOrganizacao(StrEnum):
    ONG = "ONG"
    PROJETO_SOCIAL = "PROJETO_SOCIAL"
