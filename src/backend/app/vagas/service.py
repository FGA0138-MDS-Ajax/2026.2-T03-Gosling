from fastapi import HTTPException

from app.usuarios.enums import TipoOrganizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga
from app.vagas.repository import VagaRepository
from app.vagas.schemas import (
    CadastroVagaRequest,
    ListaVagasResponse,
    VagaPublica,
)


class VagaService:
    def __init__(self, repository: VagaRepository):
        self.repository = repository

    def publicar(self, usuario_id: int, dados: CadastroVagaRequest) -> VagaPublica:
        organizacao = self.repository.buscar_organizacao(usuario_id)
        if (
            organizacao is None
            or not organizacao.ativo
            or organizacao.tipo != TipoOrganizacao.ONG
            or not organizacao.homologada
        ):
            raise HTTPException(
                status_code=403,
                detail="Somente uma ONG com acesso liberado pode publicar vagas.",
            )

        try:
            causa = self.repository.obter_ou_criar_causa(dados.causa)
            vaga = Vaga(
                **dados.model_dump(exclude={"causa", "ocorrencias"}),
                organizacao=organizacao,
                causa=causa,
                status=StatusVaga.ABERTA,
                ocorrencias=[
                    OcorrenciaVaga(inicio=item.inicio, fim=item.fim)
                    for item in dados.ocorrencias
                ],
            )
            self.repository.adicionar(vaga)
            resposta = VagaPublica.model_validate(vaga)
            self.repository.confirmar()
            return resposta
        except Exception:
            self.repository.desfazer()
            raise

    def listar(self, pagina: int, por_pagina: int) -> ListaVagasResponse:
        vagas, total = self.repository.listar_publicas(pagina, por_pagina)
        return ListaVagasResponse(
            itens=[VagaPublica.model_validate(vaga) for vaga in vagas],
            total=total,
            pagina=pagina,
            por_pagina=por_pagina,
        )
