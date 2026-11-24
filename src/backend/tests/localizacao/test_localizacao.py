from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.localizacao.models import aplicar_localizacao
from app.localizacao.schemas import Localizacao
from app.usuarios.models import Organizacao


def test_endereco_normaliza_cep_e_mantem_bairro_e_regiao_distintos():
    local = Localizacao(
        cep=" 72000-001 ",
        bairro=" Setor A ",
        regiao_administrativa="Taguatinga",
        cidade="Brasília",
        estado="DF",
        numero="S/N",
        latitude=0,
        longitude=0,
    )
    assert local.cep == "72000001"
    assert local.bairro == "Setor A"
    assert local.regiao_administrativa == "Taguatinga"
    assert local.origem_coordenadas == "MANUAL"
    assert local.latitude == local.longitude == Decimal(0)


@pytest.mark.parametrize(
    "dados",
    [
        {"cep": "1234"},
        {"cep": "123456789"},
        {"cep": "abcd1234"},
        {"cep": 72000000},
        {"estado": "XX"},
        {"numero": ""},
        {"latitude": 90.1, "longitude": 0},
        {"latitude": 0, "longitude": -180.1},
        {"latitude": 1},
        {"longitude": 1},
        {"latitude": "NaN", "longitude": 1},
        {"latitude": True, "longitude": False},
        {"origem_coordenadas": "NAVEGADOR"},
        {"latitude": 1, "longitude": 1, "origem_coordenadas": "CEP"},
        {"latitude": 1, "longitude": 1, "usuario_id": 1},
    ],
)
def test_recusa_cep_uf_coordenadas_e_campos_invalidos(dados):
    with pytest.raises(ValidationError):
        Localizacao(**dados)


def test_localizacao_e_opcional_e_pode_ser_removida_sem_mudar_texto_antigo():
    ong = Organizacao(endereco="Texto anterior preservado")
    assert ong.localizacao is None
    aplicar_localizacao(
        ong, Localizacao(cep="70000000", cidade="Brasília", estado="DF")
    )
    assert ong.localizacao["cep"] == "70000000"
    assert ong.latitude is None
    aplicar_localizacao(ong, None)
    assert ong.localizacao is None
    assert ong.endereco == "Texto anterior preservado"
