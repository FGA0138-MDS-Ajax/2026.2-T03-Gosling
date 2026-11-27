import math

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

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
    VagaInstitucional,
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
            self.validar_fotos(dados.fotos)
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

    def listar(self, pagina: int, por_pagina: int, **filtros) -> ListaVagasResponse:
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

    @staticmethod
    def validar_fotos(fotos: list[str]) -> None:
        for foto in fotos:
            if (
                foto.startswith("/api/v1/midia/")
                and not (pasta_midia() / foto.rsplit("/", 1)[1]).is_file()
            ):
                raise HTTPException(
                    422, "Uma das fotos expirou. Selecione as imagens novamente."
                )

    def obter_vaga_da_organizacao(
        self, vaga_id: str, organizacao_id: str, *, bloquear: bool = False
    ) -> Vaga:
        if not vaga_id.isascii() or not vaga_id.isdecimal() or len(vaga_id) > 10:
            raise VagaNaoEncontradaException("Vaga não encontrada.")
        vaga = self.repository.buscar_por_id(int(vaga_id), bloquear=bloquear)
        if vaga is None:
            raise VagaNaoEncontradaException("Vaga não encontrada.")
        if str(vaga.organizacao_id) != organizacao_id:
            raise AcessoNegadoVagaException(
                "Você não tem permissão para acessar a vaga."
            )
        return vaga

    def detalhar_para_edicao(
        self, vaga_id: str, organizacao_id: str
    ) -> VagaInstitucional:
        vaga = self.obter_vaga_da_organizacao(vaga_id, organizacao_id)
        return self.vaga_institucional(
            vaga, self.repository.tem_candidaturas_ativas(vaga.id)
        )

    @staticmethod
    def vaga_institucional(vaga: Vaga, horarios_bloqueados: bool) -> VagaInstitucional:
        publica = VagaPublica.model_validate(vaga)
        return VagaInstitucional(
            **publica.model_dump(), horarios_bloqueados=horarios_bloqueados
        )

    def atualizar_vaga(
        self, vaga_id: str, organizacao_id: str, dados: AtualizarVagaRequest
    ) -> VagaInstitucional:
        with bloqueio_midia:
            try:
                # A criação de candidaturas deve adquirir este mesmo bloqueio
                # antes de consultar o estado e os encontros da vaga.
                vaga = self.obter_vaga_da_organizacao(
                    vaga_id, organizacao_id, bloquear=True
                )
                self.repository.carregar_ocorrencias_para_edicao(vaga)
                ativa = self.repository.tem_candidaturas_ativas(vaga.id, bloquear=True)
                campos = dados.model_dump(exclude_unset=True)
                encerrar = campos.pop("estado_vaga", None)
                if campos:
                    self.editar_campos(vaga, campos, ativa)
                if encerrar and vaga.status == StatusVaga.SUSPENSA:
                    raise HTTPException(
                        409, "Uma vaga suspensa não pode ser encerrada."
                    )
                if encerrar:
                    vaga.status = StatusVaga.ENCERRADA
                self.repository.descarregar()
                resposta = self.vaga_institucional(vaga, ativa)
                self.repository.confirmar()
                return resposta
            except Exception:
                self.repository.desfazer()
                raise

    def editar_campos(self, vaga: Vaga, campos: dict, ativa: bool) -> None:
        publica = VagaPublica.model_validate(vaga)
        atual = publica.model_dump(include=set(CadastroVagaRequest.model_fields))
        atual["causa"] = publica.causa.nome
        atual["ocorrencias"] = [
            {"inicio": item.inicio, "fim": item.fim} for item in vaga.ocorrencias
        ]
        try:
            validado = CadastroVagaRequest.model_validate({**atual, **campos})
        except ValidationError as exc:
            raise RequestValidationError(
                [{**erro, "loc": ("body", *erro["loc"])} for erro in exc.errors()]
            ) from exc

        antes = [(item.inicio, item.fim) for item in vaga.ocorrencias]
        depois = [(item.inicio, item.fim) for item in validado.ocorrencias]
        if antes != depois:
            if ativa:
                raise AlteracaoHorarioNaoPermitidaException(
                    "Os horários não podem mudar enquanto houver "
                    "candidaturas pendentes ou aceitas."
                )
            existentes = {(item.inicio, item.fim): item for item in vaga.ocorrencias}
            vaga.ocorrencias = [
                existentes.get((inicio, fim)) or OcorrenciaVaga(inicio=inicio, fim=fim)
                for inicio, fim in depois
            ]

        if "fotos" in campos:
            self.validar_fotos(validado.fotos)
        if "causa" in campos and validado.causa != vaga.causa.nome:
            vaga.causa = self.repository.obter_ou_criar_causa(validado.causa)
        for campo, valor in validado.model_dump(
            include=set(campos) - {"causa", "ocorrencias"}
        ).items():
            setattr(vaga, campo, valor)
