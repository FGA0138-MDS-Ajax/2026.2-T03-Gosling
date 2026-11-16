import unicodedata

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga


class VagaRepository:
    def __init__(self, session: Session):
        self.session = session

    def buscar_organizacao(self, usuario_id: int) -> Organizacao | None:
        return self.session.get(Organizacao, usuario_id)

    def obter_ou_criar_causa(self, nome: str) -> Causa:
        normalizado = unicodedata.normalize("NFKC", nome).casefold()
        consulta = select(Causa).where(Causa.nome_normalizado == normalizado)
        causa = self.session.scalar(consulta)
        if causa is not None:
            return causa
        try:
            with self.session.begin_nested():
                causa = Causa(nome=nome, nome_normalizado=normalizado)
                self.session.add(causa)
                self.session.flush()
        except IntegrityError:
            causa = self.session.scalar(consulta.with_for_update())
            if causa is None:
                raise
        return causa

    def adicionar(self, vaga: Vaga) -> None:
        self.session.add(vaga)
        self.session.flush()

    def listar_publicas(
        self, pagina: int, por_pagina: int, causa=None, modalidade=None, periodo=None
    ):
        filtros = [
            Vaga.status == StatusVaga.ABERTA,
            Organizacao.ativo.is_(True),
            Organizacao.homologada.is_(True),
        ]
        if causa:
            normalizado = unicodedata.normalize("NFKC", causa.strip()).casefold()
            filtros.append(
                Vaga.causa_id.in_(
                    select(Causa.id).where(Causa.nome_normalizado == normalizado)
                )
            )
        if modalidade:
            filtros.append(Vaga.modalidade == modalidade)
        if periodo:
            filtros.append(Vaga.periodo == periodo)
        total = self.session.scalar(
            select(func.count(Vaga.id)).join(Vaga.organizacao).where(*filtros)
        )
        vagas = self.session.scalars(
            select(Vaga)
            .join(Vaga.organizacao)
            .where(*filtros)
            .order_by(Vaga.id.desc())
            .offset((pagina - 1) * por_pagina)
            .limit(por_pagina)
        ).all()
        return vagas, total

    def buscar_publica(self, vaga_id: int) -> Vaga | None:
        return self.session.scalar(
            select(Vaga)
            .join(Vaga.organizacao)
            .where(
                Vaga.id == vaga_id,
                Vaga.status == StatusVaga.ABERTA,
                Organizacao.ativo.is_(True),
                Organizacao.homologada.is_(True),
            )
        )

    def confirmar(self) -> None:
        self.session.commit()

    def desfazer(self) -> None:
        self.session.rollback()
