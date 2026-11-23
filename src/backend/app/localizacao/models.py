from decimal import Decimal

from sqlalchemy import CheckConstraint, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.localizacao.schemas import Localizacao

CAMPOS = tuple(Localizacao.model_fields)


def restricao_coordenadas(tabela):
    return CheckConstraint(
        "(latitude IS NULL AND longitude IS NULL) OR "
        "(latitude IS NOT NULL AND longitude IS NOT NULL "
        "AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)",
        name=f"ck_{tabela}_coordenadas",
    )


class LocalizacaoMixin:
    cep: Mapped[str | None] = mapped_column(String(8))
    logradouro: Mapped[str | None] = mapped_column(String(200))
    numero: Mapped[str | None] = mapped_column(String(30))
    complemento: Mapped[str | None] = mapped_column(String(100))
    bairro: Mapped[str | None] = mapped_column(String(100))
    regiao_administrativa: Mapped[str | None] = mapped_column(String(100))
    cidade: Mapped[str | None] = mapped_column(String(100))
    estado: Mapped[str | None] = mapped_column(String(2))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    origem_coordenadas: Mapped[str | None] = mapped_column(String(20))

    @property
    def localizacao(self):
        dados = {campo: getattr(self, campo) for campo in CAMPOS}
        return dados if any(valor is not None for valor in dados.values()) else None


def aplicar_localizacao(entidade, dados: Localizacao | None):
    valores = dados.model_dump() if dados is not None else dict.fromkeys(CAMPOS)
    for campo, valor in valores.items():
        setattr(entidade, campo, valor)


def limpar_coordenadas(entidade):
    for campo in ("latitude", "longitude", "origem_coordenadas"):
        setattr(entidade, campo, None)
