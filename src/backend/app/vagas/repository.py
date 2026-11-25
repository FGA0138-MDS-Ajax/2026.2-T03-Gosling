import unicodedata
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, lazyload
from sqlalchemy.orm.attributes import set_committed_value

from app.candidaturas.enums import STATUS_ATIVOS
from app.candidaturas.models import Candidatura
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import OcorrenciaVaga, Vaga


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

    def listar_vagas_por_organizacao(
        self, organizacao_id: int, pagina: int = 1, tamanho_pagina: int = 10
    ) -> tuple[list[dict[str, Any]], int]:
        da_organizacao = Vaga.organizacao_id == organizacao_id
        total_itens = self.session.execute(
            select(func.count(Vaga.id)).where(da_organizacao)
        ).scalar_one()
        total_candidaturas = (
            select(func.count(Candidatura.id))
            .where(Candidatura.vaga_id == Vaga.id)
            .scalar_subquery()
        )
        consulta = (
            select(
                Vaga.id,
                Vaga.titulo,
                Vaga.descricao,
                Vaga.status.label("estado_vaga"),
                Vaga.local,
                total_candidaturas.label("total_candidaturas"),
            )
            .where(da_organizacao)
            .order_by(Vaga.id.desc())
            .offset((pagina - 1) * tamanho_pagina)
            .limit(tamanho_pagina)
        )
        linhas = self.session.execute(consulta).mappings().all()
        return [dict(linha) for linha in linhas], total_itens

    def confirmar(self) -> None:
        self.session.commit()

    def desfazer(self) -> None:
        self.session.rollback()

    def buscar_por_id(self, vaga_id: int, *, bloquear: bool = False) -> Vaga | None:
        consulta = select(Vaga).where(Vaga.id == vaga_id)
        if bloquear:
            consulta = (
                consulta.options(
                    lazyload(Vaga.organizacao),
                    lazyload(Vaga.causa),
                    lazyload(Vaga.ocorrencias),
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        return self.session.scalar(consulta)

    def carregar_ocorrencias_para_edicao(self, vaga: Vaga) -> None:
        consulta = (
            select(OcorrenciaVaga)
            .where(OcorrenciaVaga.vaga_id == vaga.id)
            .order_by(OcorrenciaVaga.inicio)
            .with_for_update()
        )
        set_committed_value(vaga, "ocorrencias", list(self.session.scalars(consulta)))

    def tem_candidaturas_ativas(self, vaga_id: int, *, bloquear: bool = False) -> bool:
        consulta = (
            select(Candidatura.id)
            .where(
                Candidatura.vaga_id == vaga_id, Candidatura.status.in_(STATUS_ATIVOS)
            )
            .limit(1)
        )
        if bloquear:
            consulta = consulta.with_for_update()
        return self.session.scalar(consulta) is not None

    def descarregar(self) -> None:
        self.session.flush()
