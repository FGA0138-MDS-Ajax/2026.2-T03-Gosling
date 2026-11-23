import math
from typing import Any, Dict

from fastapi import HTTPException
from app.causas.repository import CausaRepository
from app.causas.service import CatalogoService, erro_causa, normalizar

from app.core.midia import bloqueio_midia, pasta_midia
from app.localizacao.models import aplicar_localizacao
from app.localizacao.schemas import Localizacao
from app.usuarios.enums import TipoOrganizacao
from app.usuarios.models import Organizacao
from app.vagas.enums import Modalidade, StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga
from app.vagas.rascunhos import (
    AtualizarRascunhoRequest,
    DadosRascunho,
    PublicarRascunhoRequest,
    RascunhoResponse,
    erro_versao,
)
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
        vaga = Vaga(organizacao=organizacao)

        with bloqueio_midia:
            try:
                return self._confirmar_publicacao(vaga, organizacao, dados)
            except Exception:
                self.repository.desfazer()
                raise

    def _confirmar_publicacao(
        self, vaga: Vaga, organizacao: Organizacao, dados: CadastroVagaRequest
    ) -> VagaPublica:
        self._validar_fotos(dados.fotos)
        catalogo = CatalogoService(CausaRepository(self.repository.session))
        vaga.causa = catalogo.publicavel(dados.causa_id, dados.causa)
        campos = dados.model_dump(
            exclude={
                "causa",
                "causa_id",
                "ocorrencias",
                "localizacao",
                "origem_localizacao",
            }
        )
        for campo, valor in campos.items():
            setattr(vaga, campo, valor)

        self._localizar_atividade(vaga, organizacao, dados)
        vaga.ocorrencias = [
            OcorrenciaVaga(inicio=item.inicio, fim=item.fim)
            for item in dados.ocorrencias
        ]
        vaga.status = StatusVaga.ABERTA
        vaga.rascunho = None
        self.repository.adicionar(vaga)
        resposta = VagaPublica.model_validate(vaga)
        self.repository.confirmar()
        return resposta

    @staticmethod
    def _validar_fotos(fotos: list[str]) -> None:
        for foto in fotos:
            if foto.startswith("/api/v1/midia/"):
                arquivo = pasta_midia() / foto.rsplit("/", 1)[1]
                if not arquivo.is_file():
                    raise HTTPException(
                        422, "Uma das fotos expirou. Selecione as imagens novamente."
                    )

    @staticmethod
    def _localizar_atividade(
        vaga: Vaga, organizacao: Organizacao, dados: CadastroVagaRequest
    ) -> None:
        if dados.modalidade == Modalidade.REMOTO:
            vaga.origem_localizacao = "REMOTA"
        elif dados.origem_localizacao == "ORGANIZACAO":
            if organizacao.localizacao is None:
                raise HTTPException(
                    422,
                    detail=[
                        {
                            "loc": ["body", "origem_localizacao"],
                            "msg": "Cadastre o endereço da organização para usá-lo.",
                            "type": "value_error",
                        }
                    ],
                )
            aplicar_localizacao(
                vaga, Localizacao.model_validate(organizacao.localizacao)
            )
            vaga.origem_localizacao = "ORGANIZACAO"
        elif dados.localizacao is not None:
            aplicar_localizacao(vaga, dados.localizacao)
            vaga.origem_localizacao = "PROPRIA"
        else:
            vaga.origem_localizacao = "LEGADO"

    @staticmethod
    def _resposta_rascunho(vaga: Vaga) -> RascunhoResponse:
        return RascunhoResponse(
            id=vaga.id,
            versao=vaga.versao,
            criado_em=vaga.criado_em,
            atualizado_em=vaga.atualizado_em,
            dados=vaga.rascunho or {},
        )

    def criar_rascunho(self, usuario_id: int, dados: DadosRascunho) -> RascunhoResponse:
        organizacao = self.repository.buscar_organizacao(usuario_id)
        if (
            not organizacao
            or not organizacao.ativo
            or organizacao.tipo != TipoOrganizacao.ONG
        ):
            raise HTTPException(403, "Somente uma ONG pode criar um rascunho.")

        with bloqueio_midia:
            try:
                self._validar_fotos(dados.fotos)
                vaga = Vaga(
                    organizacao=organizacao,
                    status=StatusVaga.RASCUNHO,
                    rascunho=dados.model_dump(mode="json", exclude_unset=True),
                )
                self.repository.adicionar(vaga)
                resposta = self._resposta_rascunho(vaga)
                self.repository.confirmar()
                return resposta
            except Exception:
                self.repository.desfazer()
                raise

    def consultar_rascunho(self, usuario_id: int, vaga_id: int) -> RascunhoResponse:
        vaga = self.repository.buscar_vaga_do_titular(vaga_id, usuario_id)
        if vaga is None or vaga.status != StatusVaga.RASCUNHO:
            raise HTTPException(404, "Rascunho não encontrado.")
        return self._resposta_rascunho(vaga)

    def _rascunho_para_editar(self, usuario_id: int, vaga_id: int, versao: int) -> Vaga:
        vaga = self.repository.buscar_vaga_do_titular(vaga_id, usuario_id)
        if vaga is None:
            raise HTTPException(404, "Rascunho não encontrado.")
        if vaga.status != StatusVaga.RASCUNHO or vaga.versao != versao:
            raise erro_versao()
        return vaga

    def atualizar_rascunho(
        self, usuario_id: int, vaga_id: int, pedido: AtualizarRascunhoRequest
    ) -> RascunhoResponse:
        with bloqueio_midia:
            try:
                vaga = self._rascunho_para_editar(usuario_id, vaga_id, pedido.versao)
                novos = pedido.dados.model_dump(mode="json", exclude_unset=True)
                dados = {**(vaga.rascunho or {}), **novos}
                self._validar_fotos(dados.get("fotos", []))
                if not self.repository.reservar_edicao_rascunho(vaga, pedido.versao):
                    raise erro_versao()

                vaga.rascunho = dados
                self.repository.adicionar(vaga)
                resposta = self._resposta_rascunho(vaga)
                self.repository.confirmar()
                return resposta
            except Exception:
                self.repository.desfazer()
                raise

    def publicar_rascunho(
        self, usuario_id: int, vaga_id: int, pedido: PublicarRascunhoRequest
    ) -> VagaPublica:
        with bloqueio_midia:
            try:
                versao = pedido.versao
                vaga = self._rascunho_para_editar(usuario_id, vaga_id, versao)
                organizacao = self.validar_publicador(usuario_id)
                campos = dict(vaga.rascunho or {})
                if pedido.dados is not None:
                    campos.update(pedido.dados.model_dump(exclude_unset=True))
                dados = DadosRascunho.model_validate(campos).para_publicacao()
                if not self.repository.reservar_edicao_rascunho(vaga, versao):
                    raise erro_versao()
                return self._confirmar_publicacao(vaga, organizacao, dados)
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
        self,
        organizacao_id: int,
        pagina: int,
        tamanho_pagina: int,
        estado: StatusVaga | None = None,
    ) -> PaginatedResponseVagas:
        """Listagem paginada das vagas da organização (Issue #36)."""
        vagas, total_itens = self.repository.listar_vagas_por_organizacao(
            organizacao_id=organizacao_id,
            pagina=pagina,
            tamanho_pagina=tamanho_pagina,
            estado=estado,
        )

        itens = []
        for vaga in vagas:
            rascunho = vaga.get("rascunho") or {}
            localizacao = rascunho.get("localizacao") or {}
            itens.append(
                VagaResumoResponse(
                    id=str(vaga["id"]),
                    titulo=vaga["titulo"] or rascunho.get("titulo"),
                    estado_vaga=vaga["estado_vaga"],
                    local=vaga.get("local") or rascunho.get("local"),
                    cidade=vaga.get("cidade") or localizacao.get("cidade"),
                    estado_uf=vaga.get("estado_uf") or localizacao.get("estado"),
                    data_criacao=vaga["data_criacao"],
                    atualizado_em=vaga.get("atualizado_em"),
                    total_candidaturas=int(vaga["total_candidaturas"]),
                )
            )

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
        vaga = self.repository.buscar_por_id(vaga_id)
        if not vaga:
            raise VagaNaoEncontradaException("Vaga não encontrada.")

        if str(vaga["organizacao_id"]) != str(organizacao_id):
            raise AcessoNegadoVagaException(
                "Acesso negado: Você não tem permissão para alterar esta vaga."
            )

        if vaga.get("status") == StatusVaga.RASCUNHO or dados.estado_vaga == "RASCUNHO":
            raise HTTPException(409, "Use o editor de rascunhos para essa alteração.")

        payload = dados.model_dump(exclude_unset=True)
        if not payload:
            return vaga

        alterou_inicio = "data_inicio" in payload and payload[
            "data_inicio"
        ] != vaga.get("data_inicio")
        alterou_fim = "data_fim" in payload and payload["data_fim"] != vaga.get(
            "data_fim"
        )
        if alterou_inicio or alterou_fim:
            if self.repository.tem_candidaturas_ativas(vaga_id):
                raise AlteracaoHorarioNaoPermitidaException(
                    "Não é permitido alterar os horários da vaga pois existem "
                    "candidaturas pendentes ou aceitas vinculadas a ela."
                )

        self.repository.atualizar_vaga(vaga_id, payload)
        return self.repository.buscar_por_id(vaga_id)
