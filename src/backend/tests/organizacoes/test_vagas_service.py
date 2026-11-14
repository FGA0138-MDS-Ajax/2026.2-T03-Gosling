import math
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.voluntarios.me.vagas.service import VagaService


def vaga_bruta(id=1, titulo="Vaga A", candidaturas=2):
    return {
        "id": id,
        "titulo": titulo,
        "estado_vaga": "ABERTA",
        "cidade": "Gama",
        "estado_uf": "DF",
        "data_criacao": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "total_candidaturas": candidaturas,
    }


def test_converte_vagas_do_repository_em_resposta_paginada():
    repo = MagicMock()
    repo.listar_vagas_por_organizacao.return_value = ([vaga_bruta()], 1)

    resposta = VagaService(repo).listar_vagas_da_organizacao(
        organizacao_id=10, pagina=1, tamanho_pagina=10
    )

    assert resposta.total_itens == 1
    assert resposta.total_paginas == 1
    assert resposta.itens[0].id == "1"
    assert resposta.itens[0].titulo == "Vaga A"
    assert resposta.itens[0].total_candidaturas == 2


def test_repassa_organizacao_e_paginacao_ao_repository():
    repo = MagicMock()
    repo.listar_vagas_por_organizacao.return_value = ([], 0)

    VagaService(repo).listar_vagas_da_organizacao(
        organizacao_id=10, pagina=3, tamanho_pagina=5
    )

    repo.listar_vagas_por_organizacao.assert_called_once_with(
        organizacao_id=10, pagina=3, tamanho_pagina=5
    )


def test_sem_vagas_retorna_zero_itens_e_zero_paginas():
    repo = MagicMock()
    repo.listar_vagas_por_organizacao.return_value = ([], 0)

    resposta = VagaService(repo).listar_vagas_da_organizacao(10, 1, 10)

    assert resposta.itens == []
    assert resposta.total_paginas == 0


def test_calcula_total_de_paginas_arredondando_para_cima():
    repo = MagicMock()
    repo.listar_vagas_por_organizacao.return_value = ([vaga_bruta()], 11)

    resposta = VagaService(repo).listar_vagas_da_organizacao(10, 1, 5)

    assert resposta.total_paginas == math.ceil(11 / 5) == 3