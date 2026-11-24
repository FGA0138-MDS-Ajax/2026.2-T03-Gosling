from datetime import UTC, datetime, time
from typing import Any, List, Optional
from zoneinfo import ZoneInfo

from app.candidaturas.models import Candidatura
from app.candidaturas.repository import CandidaturaRepository
from app.candidaturas.schemas import EventoCalendario, IntervaloCalendario


BRASILIA = ZoneInfo("America/Sao_Paulo")


class VagaNaoEncontradaException(Exception):
    pass


class VagaNaoAbertaException(Exception):
    pass


class CandidaturaDuplicadaException(Exception):
    pass


class CandidaturaService:
    def __init__(
        self,
        candidatura_repository: CandidaturaRepository,
        vaga_repository: Any,
    ):
        self.candidatura_repository = candidatura_repository
        self.vaga_repository = vaga_repository

    def candidatar(self, vaga_id: int, voluntario_id: int) -> Candidatura:
        vaga = self.vaga_repository.buscar_por_id(vaga_id)

        if not vaga:
            raise VagaNaoEncontradaException("Vaga não encontrada.")

        if isinstance(vaga, dict):
            estado_vaga = (
                vaga.get("status")
                or vaga.get("estado_vaga")
                or vaga.get("estado")
            )
        else:
            estado_vaga = (
                getattr(vaga, "status", None)
                or getattr(vaga, "estado_vaga", None)
                or getattr(vaga, "estado", None)
            )

        estado_vaga = getattr(estado_vaga, "value", estado_vaga)

        if estado_vaga != "ABERTA":
            raise VagaNaoAbertaException(
                "Não é possível se candidatar: A vaga não está no estado ABERTA."
            )

        if self.candidatura_repository.ja_candidatado(vaga_id, voluntario_id):
            raise CandidaturaDuplicadaException(
                "Você já possui uma candidatura registrada para esta vaga."
            )

        return self.candidatura_repository.criar_candidatura(
            vaga_id=vaga_id,
            voluntario_id=voluntario_id,
            status="PENDENTE",
        )


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
