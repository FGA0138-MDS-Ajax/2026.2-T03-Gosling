from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from app.candidaturas.repository import CandidaturaRepository
from app.candidaturas.schemas import EventoCalendario, IntervaloCalendario

BRASILIA = ZoneInfo("America/Sao_Paulo")


class CalendarioService:
    def __init__(self, repository: CandidaturaRepository):
        self.repository = repository

    def consultar(
        self, voluntario_id: int, intervalo: IntervaloCalendario
    ) -> list[EventoCalendario]:
        inicio = datetime.combine(intervalo.inicio, time.min, BRASILIA).astimezone(UTC)
        fim = datetime.combine(intervalo.fim, time.min, BRASILIA).astimezone(UTC)
        eventos = self.repository.listar_eventos(voluntario_id, inicio, fim)
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
