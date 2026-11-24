from datetime import UTC, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import HTTPException, UploadFile

from app.candidaturas.comprovantes import codigo_comprovante, gerar_comprovante
from app.candidaturas.documentos import pasta_documentos, validar_documentos
from app.candidaturas.models import Candidatura, DocumentoCandidatura
from app.candidaturas.repository import CandidaturaRepository
from app.candidaturas.schemas import (
    CandidaturaRegistrada,
    ComprovanteCandidatura,
    EventoCalendario,
    HorarioConflitante,
    IntervaloCalendario,
)
from app.vagas.enums import StatusVaga


BRASILIA = ZoneInfo("America/Sao_Paulo")


class VagaNaoEncontradaException(Exception):
    pass


class VagaNaoAbertaException(Exception):
    pass


class CandidaturaDuplicadaException(Exception):
    pass


class ConflitoHorarioException(Exception):
    def __init__(self, conflitos: list[HorarioConflitante]):
        self.conflitos = conflitos


class CandidaturaService:
    def __init__(self, repository: CandidaturaRepository):
        self.repository = repository

    def candidatar(
        self,
        vaga_id: int,
        voluntario_id: int,
        indices: list[int],
        arquivos: list[UploadFile],
    ) -> CandidaturaRegistrada:
        session = self.repository.session
        caminhos: list[Path] = []
        try:
            if not self.repository.bloquear_voluntario(voluntario_id):
                raise HTTPException(403, "Voluntário indisponível.")
            vaga = self.repository.bloquear_vaga(vaga_id)
            if vaga is None:
                raise VagaNaoEncontradaException("Vaga não encontrada.")
            if vaga.status != StatusVaga.ABERTA:
                raise VagaNaoAbertaException(
                    "Não é possível se candidatar: A vaga não está no estado ABERTA."
                )
            if self.repository.ja_candidatado(vaga_id, voluntario_id):
                raise CandidaturaDuplicadaException(
                    "Você já possui uma candidatura registrada para esta vaga."
                )
            ocorrencias = self.repository.listar_ocorrencias(vaga_id)
            if not any(encontro.fim > datetime.now(UTC) for encontro in ocorrencias):
                raise VagaNaoAbertaException(
                    "Os encontros desta vaga já se encerraram."
                )
            conflitos = self.repository.listar_conflitos(voluntario_id, ocorrencias)
            if conflitos:
                raise ConflitoHorarioException(
                    [HorarioConflitante.model_validate(item) for item in conflitos]
                )

            documentos = validar_documentos(
                [doc["nome"] for doc in vaga.documentos_exigidos or []],
                indices,
                arquivos,
            )
            candidatura = Candidatura(vaga_id=vaga_id, voluntario_id=voluntario_id)
            session.add(candidatura)
            session.flush()
            if documentos:
                pasta = pasta_documentos()
                pasta.mkdir(parents=True, exist_ok=True)
                for documento in documentos:
                    caminho = pasta / documento.arquivo
                    with caminho.open("xb") as destino:
                        caminhos.append(caminho)
                        destino.write(documento.conteudo)
                    session.add(
                        DocumentoCandidatura(
                            candidatura_id=candidatura.id,
                            indice=documento.indice,
                            nome=documento.nome,
                            arquivo=documento.arquivo,
                        )
                    )
            resposta = CandidaturaRegistrada(
                id=candidatura.id,
                vaga_id=vaga_id,
                status=candidatura.status,
                comprovante=ComprovanteCandidatura(
                    codigo=codigo_comprovante(candidatura)
                ),
            )
            session.commit()
            return resposta
        except Exception:
            session.rollback()
            for caminho in caminhos:
                caminho.unlink(missing_ok=True)
            raise

    def comprovante(
        self,
        candidatura_id: int,
        voluntario_id: int,
        nome_voluntario: str,
    ) -> bytes:
        candidatura = self.repository.buscar_do_voluntario(
            candidatura_id, voluntario_id
        )
        if candidatura is None:
            raise HTTPException(404, "Candidatura não encontrada.")
        return gerar_comprovante(candidatura, nome_voluntario)


class CalendarioService:
    def __init__(self, repository: CandidaturaRepository):
        self.repository = repository

    def consultar(
        self,
        voluntario_id: int,
        intervalo: IntervaloCalendario,
    ) -> list[EventoCalendario]:
        inicio = datetime.combine(
            intervalo.inicio,
            time.min,
            BRASILIA,
        ).astimezone(UTC)

        fim = datetime.combine(
            intervalo.fim,
            time.min,
            BRASILIA,
        ).astimezone(UTC)

        eventos = self.repository.listar_eventos(
            voluntario_id,
            inicio,
            fim,
        )

        return [
            EventoCalendario(
                candidatura_id=evento["candidatura_id"],
                vaga_id=evento["vaga_id"],
                titulo_vaga=evento["titulo_vaga"],
                organizacao={
                    "id": evento["organizacao_id"],
                    "nome": evento["organizacao_nome"],
                },
                status=evento["status"],
                inicio=evento["inicio"],
                fim=evento["fim"],
            )
            for evento in eventos
        ]
