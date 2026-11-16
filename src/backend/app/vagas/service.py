from fastapi import HTTPException
from typing import Any,Dict
from app.vagas.schemas import AtualizarVagaRequest
from app.usuarios.enums import TipoOrganizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga
from app.vagas.repository import VagaRepository
from app.vagas.schemas import (
    CadastroVagaRequest,
    ListaVagasResponse,
    VagaPublica,
)

class VagaNaoEncontradaException(Exception):
    pass


class AcessoNegadoVagaException(Exception):
    pass

class AlteracaoHorarioNaoPermitidaException (Exception):
    pass

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

    def atualizar_vaga(
            self,vaga_id: str, organizacao_id: str, dados: AtualizarVagaRequest
    ) -> Dict[str, Any]:

        vaga = self.vaga_repository.buscar_por_id(vaga_id)

        if not vaga:
            raise VagaNaoEncontradaException("Vaga não encontrada.")

        if str(vaga["organizacao_id"]) != str(organizacao_id):
            raise AcessoNegadoVagaException(
                 "Acesso negado: Você não tem permissão para alterar esta vaga."
            )

        payload = dados.model_dump(exclude_unset=True)

        if not payload:
            return vaga

        alterou_data_inicio = (
            "data_inicio" in payload and payload["data_inicio"] != vaga.get("data_inicio")
        )

        alterou_data_fim = (
            "data_fim" in payload and payload["data_fim"] != vaga.get("data_fim")
        )

        if alterou_data_inicio or alterou_data_fim:
            if self.vaga_repository.tem_candidaturas_ativas(vaga_id):
                raise AlteracaoHorarioNaoPermitidaException(
                    "Não é permitido alterar os horários da vaga pois existe"
                    "candidaturas pendentes ou aceitas vinculadas a ela"
                )
        self.vaga_repository.atualizar_vaga(vaga_id,payload)
        return self.vaga_repository.buscar_por_id(vaga_id)

