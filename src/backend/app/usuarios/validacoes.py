import re
import unicodedata
from typing import Annotated

from pydantic import AfterValidator, Field, SecretStr

PADRAO_TELEFONE = r"^[0-9]{10,11}$"


def normalizar_telefone(valor: object) -> object:
    if not isinstance(valor, str):
        return valor
    numero = valor.strip().translate(str.maketrans("", "", "()+- "))
    if re.fullmatch(r"55[0-9]{10,11}", numero):
        numero = numero[2:]
    return numero


def validar_senha_cadastro(valor: SecretStr) -> SecretStr:
    senha = valor.get_secret_value()
    if (
        not any(unicodedata.category(c) == "Lu" for c in senha)
        or not any(c in "0123456789" for c in senha)
        or not any(unicodedata.category(c)[0] in ("P", "S") for c in senha)
        or any(c.isspace() for c in senha)
    ):
        raise ValueError(
            "Use pelo menos 8 caracteres, uma letra maiúscula, "
            "um número e um símbolo, sem espaços."
        )
    return valor


SenhaCadastro = Annotated[
    SecretStr,
    Field(min_length=8, max_length=1024),
    AfterValidator(validar_senha_cadastro),
]
