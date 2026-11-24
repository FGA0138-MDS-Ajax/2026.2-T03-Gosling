import math
from typing import Any, Dict

from fastapi import HTTPException
from app.causas.repository import CausaRepository
from app.causas.service import CatalogoService, erro_causa, normalizar

from app.core.midia import bloqueio_midia, pasta_midia
from app.usuarios.enums import TipoOrganizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga
from app.vagas.repository import VagaRepository
from app.vagas.schemas import (
    AtualizarVagaRequest,
    CadastroVagaRequest,
    ListaVagasResponse,
    PaginatedResponseVagas,
    VagaPublica,
    VagaResumoResponse,
)


class VagaNaoEncontradaException(Exception):
    pass


class AcessoNegadoVagaException(Exception):
    pass


class AlteracaoHorarioNaoPermitidaException(Exception):
    pass


class VagaService:
    def __init__(self, repository: VagaRepository):
        self.repository = repository

    def validar_publicador(self, usuario_id: int):
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
        return organizacao

    def publicar(self, usuario_id: int, dados: CadastroVagaRequest) -> VagaPublica:
        organizacao = self.validar_publicador(usuario_id)

        with bloqueio_midia:
            for foto in dados.fotos:
                if (
                    foto.startswith("/api/v1/midia/")
                    and not (pasta_midia() / foto.rsplit("/", 1)[1]).is_file()
                ):
                    raise HTTPException(
                        422, "Uma das fotos expirou. Selecione as imagens novamente."
                    )
            try:
                causa = CatalogoService(
                    CausaRepository(self.repository.session)
                ).publicavel(dados.causa_id, dados.causa)
                vaga = Vaga(
                    **dados.model_dump(exclude={"causa", "causa_id", "ocorrencias"}),
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

    def listar(self, pagina: int, por_pagina: int, **filtros) -> ListaVagasResponse:
        catalogo = CatalogoService(CausaRepository(self.repository.session))
        if filtros.get("causa_id") is not None:
            if filtros["causa_id"] not in catalogo.por_id:
                erro_causa("causa_id", "Causa não encontrada.", origem="query")
        elif filtros.get("causa"):
            causa = catalogo.por_nome.get(normalizar(filtros["causa"]))
            if causa is not None:
                filtros["causa_id"] = causa.id
                filtros["causa"] = None
        vagas, total = self.repository.listar_publicas(pagina, por_pagina, **filtros)
        return ListaVagasResponse(
            itens=[VagaPublica.model_validate(vaga) for vaga in vagas],
            total=total,
            pagina=pagina,
            por_pagina=por_pagina,
        )

    def detalhar(self, vaga_id: int) -> VagaPublica:
        vaga = self.repository.buscar_publica(vaga_id)
        if vaga is None:
            raise HTTPException(404, "Vaga não encontrada ou indisponível.")
        return VagaPublica.model_validate(vaga)

    def listar_vagas_da_organizacao(
        self, organizacao_id: int, pagina: int, tamanho_pagina: int
    ) -> PaginatedResponseVagas:
        """Listagem paginada das vagas da organização (Issue #36)."""
        vagas, total_itens = self.repository.listar_vagas_por_organizacao(
            organizacao_id=organizacao_id,
            pagina=pagina,
            tamanho_pagina=tamanho_pagina,
        )

        itens = [
            VagaResumoResponse(
                id=str(vaga["id"]),
                titulo=vaga["titulo"],
                estado_vaga=vaga["estado_vaga"],
                local=vaga.get("local"),
                descricao=vaga.get("descricao"),
                cidade=vaga.get("cidade"),
                estado_uf=vaga.get("estado_uf"),
                data_criacao=vaga.get("data_criacao"),
                total_candidaturas=int(vaga["total_candidaturas"]),
            )
            for vaga in vagas
        ]

        return PaginatedResponseVagas(
            itens=itens,
            pagina=pagina,
            tamanho_pagina=tamanho_pagina,
            total_itens=total_itens,
            total_paginas=math.ceil(total_itens / tamanho_pagina),
        )

    def atualizar_vaga(
        self, vaga_id: str, organizacao_id: str, dados: AtualizarVagaRequest
    ) -> Dict[str, Any]:
        """Regra de negócio para alteração de vaga (Issue #32)."""
        vaga = self.repository.buscar_por_id(vaga_id, bloquear=True)
        if not vaga:
            raise VagaNaoEncontradaException("Vaga não encontrada.")

        if str(vaga["organizacao_id"]) != str(organizacao_id):
            raise AcessoNegadoVagaException(
                "Acesso negado: Você não tem permissão para alterar esta vaga."
            )

        payload = dados.model_dump(exclude_unset=True)
        if not payload:
            return vaga

        alterou_inicio = "data_inicio" in payload and payload[
            "data_inicio"
        ] != vaga.get("data_inicio")
        alterou_fim = "data_fim" in payload and payload["data_fim"] != vaga.get(
            "data_fim"
        )
        if alterou_inicio or alterou_fim or payload.get("ocorrencias"):
            if self.repository.tem_candidaturas_ativas(vaga_id):
                raise AlteracaoHorarioNaoPermitidaException(
                    "Não é permitido alterar os horários da vaga pois existem "
                    "candidaturas pendentes ou aceitas vinculadas a ela."
                )

        self.repository.atualizar_vaga(vaga_id, payload)
        return self.repository.buscar_por_id(vaga_id)
