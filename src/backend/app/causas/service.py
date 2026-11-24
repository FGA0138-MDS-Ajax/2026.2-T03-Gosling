import json
import unicodedata
from functools import cached_property

from fastapi import HTTPException

from app.causas.repository import CausaRepository


def normalizar(nome: str) -> str:
    return unicodedata.normalize("NFKC", nome.strip()).casefold()


def nomes_legados(valor):
    if isinstance(valor, str):
        try:
            valor = json.loads(valor)
        except (ValueError, TypeError):
            valor = [valor]
    if isinstance(valor, str):
        valor = [valor]
    return (
        [nome for nome in valor if isinstance(nome, str)]
        if isinstance(valor, list)
        else []
    )


def erro_causa(campo, mensagem, indice=None, origem="body"):
    loc = [origem, campo] + ([indice] if indice is not None else [])
    raise HTTPException(
        422,
        detail=[
            {
                "loc": loc,
                "msg": mensagem,
                "type": "value_error",
            }
        ],
    )


class CatalogoService:
    def __init__(self, repository: CausaRepository):
        self.repository = repository

    @cached_property
    def causas(self):
        return self.repository.listar()

    @cached_property
    def por_id(self):
        return {causa.id: causa for causa in self.causas}

    @cached_property
    def por_nome(self):
        indice = {}
        for causa in self.causas:
            for nome in [causa.nome, *(causa.aliases or [])]:
                indice.setdefault(normalizar(nome), causa)
        return indice

    def listar(self, incluir_inativas=False):
        return [c for c in self.causas if incluir_inativas or c.ativo]

    def validar_ids(self, ids, anteriores=(), campo="causa_ids"):
        if len(ids) != len(set(ids)):
            erro_causa(campo, "Selecione cada causa apenas uma vez.")
        for indice, identificador in enumerate(ids):
            causa = self.por_id.get(identificador)
            if causa is None or (not causa.ativo and identificador not in anteriores):
                erro_causa(campo, "Selecione uma causa existente e disponível.", indice)
        return ids

    def resolver_nomes(self, nomes, anteriores=(), legadas=(), campo="causas"):
        antigas = {normalizar(nome): nome for nome in legadas}
        ids, privadas = [], []
        for indice, nome in enumerate(nomes):
            causa = self.por_nome.get(normalizar(nome))
            if causa is None:
                if normalizar(nome) not in antigas:
                    erro_causa(campo, "Selecione uma causa do catálogo.", indice)
                privadas.append(antigas[normalizar(nome)])
            else:
                self.validar_ids([causa.id], anteriores, campo)
                if causa.id not in ids:
                    ids.append(causa.id)
        return ids, list(dict.fromkeys(privadas))

    def publicavel(self, identificador=None, nome=None):
        causa = (
            self.por_id.get(identificador)
            if identificador is not None
            else self.por_nome.get(normalizar(nome))
        )
        if causa is None or not causa.ativo:
            erro_causa(
                "causa_id" if identificador is not None else "causa",
                "Selecione uma causa existente e disponível.",
            )
        return causa

    def interesses_atuais(self, ids, nomes):
        nomes = nomes_legados(nomes)
        if ids is None:
            ids = [
                self.por_nome[normalizar(nome)].id
                for nome in nomes
                if normalizar(nome) in self.por_nome
            ]
        ids = list(dict.fromkeys(i for i in ids if i in self.por_id))
        legadas = [
            nome
            for nome in nomes
            if normalizar(nome) not in self.por_nome
            or self.por_nome[normalizar(nome)].id not in ids
        ]
        return ids, list(dict.fromkeys(legadas))

    def validar_legadas(self, nomes, anteriores):
        permitidas = set(anteriores)
        if any(nome not in permitidas for nome in nomes):
            erro_causa(
                "causas_legadas",
                "Só é possível preservar ou remover interesses antigos.",
            )
        return list(dict.fromkeys(nomes))

    def nomes_para_exibicao(self, ids, legadas):
        return list(dict.fromkeys([self.por_id[i].nome for i in ids] + legadas))
