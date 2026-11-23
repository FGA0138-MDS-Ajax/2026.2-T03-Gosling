import unicodedata
from typing import Any, Dict, Optional

from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session, lazyload

from app.candidaturas.models import Candidatura
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga


class VagaRepository:
    def __init__(self, session: Session):
        self.session = session

    def buscar_organizacao(self, usuario_id: int) -> Organizacao | None:
        return self.session.get(Organizacao, usuario_id)

    def adicionar(self, vaga: Vaga) -> None:
        self.session.add(vaga)
        self.session.flush()

    def listar_publicas(
        self,
        pagina: int,
        por_pagina: int,
        causa=None,
        modalidade=None,
        periodo=None,
        causa_id=None,
    ):
        filtros = [
            Vaga.status == StatusVaga.ABERTA,
            Organizacao.ativo.is_(True),
            Organizacao.homologada.is_(True),
        ]
        if causa_id is not None:
            filtros.append(Vaga.causa_id == causa_id)
        elif causa:
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

    def buscar_vaga_do_titular(self, vaga_id: int, organizacao_id: int) -> Vaga | None:
        return self.session.scalar(
            select(Vaga)
            .options(lazyload("*"))
            .where(Vaga.id == vaga_id, Vaga.organizacao_id == organizacao_id)
        )

    def reservar_edicao_rascunho(self, vaga: Vaga, versao: int) -> bool:
        alteracao = self.session.execute(
            update(Vaga)
            .where(
                Vaga.id == vaga.id,
                Vaga.organizacao_id == vaga.organizacao_id,
                Vaga.status == StatusVaga.RASCUNHO,
                Vaga.versao == versao,
            )
            .values(versao=versao + 1)
            .execution_options(synchronize_session=False)
        )
        if alteracao.rowcount != 1:
            return False

        self.session.refresh(vaga, attribute_names=["versao", "atualizado_em"])
        return True

    def listar_vagas_por_organizacao(
        self,
        organizacao_id: int,
        pagina: int = 1,
        tamanho_pagina: int = 10,
        estado: StatusVaga | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        filtros = [Vaga.organizacao_id == organizacao_id]
        if estado is None:
            filtros.append(Vaga.status != StatusVaga.RASCUNHO)
        else:
            filtros.append(Vaga.status == estado)
        total_itens = self.session.execute(
            select(func.count(Vaga.id)).where(*filtros)
        ).scalar_one()

        candidaturas = (
            select(func.count(Candidatura.id))
            .where(Candidatura.vaga_id == Vaga.id)
            .scalar_subquery()
        )
        consulta = select(
            Vaga.id,
            Vaga.titulo,
            Vaga.status.label("estado_vaga"),
            Vaga.local,
            Vaga.cidade,
            Vaga.estado.label("estado_uf"),
            Vaga.criado_em.label("data_criacao"),
            Vaga.atualizado_em,
            Vaga.rascunho,
            candidaturas.label("total_candidaturas"),
        ).where(*filtros)
        linhas = (
            self.session.execute(
                consulta.order_by(Vaga.atualizado_em.desc(), Vaga.id.desc())
                .limit(tamanho_pagina)
                .offset((pagina - 1) * tamanho_pagina)
            )
            .mappings()
            .all()
        )

        return [dict(linha) for linha in linhas], total_itens

    def confirmar(self) -> None:
        self.session.commit()

    def desfazer(self) -> None:
        self.session.rollback()

    def buscar_por_id(self, vaga_id: str) -> Optional[Dict[str, Any]]:
        """Busca uma vaga pelo id."""
        resultado = self.session.execute(
            text("SELECT * FROM vagas WHERE id = :id"),
            {"id": vaga_id},
        )
        linha = resultado.mappings().first()
        return dict(linha) if linha else None

    def tem_candidaturas_ativas(self, vaga_id: str) -> bool:
        """Verifica se a vaga possui candidaturas em status PENDENTE ou ACEITA."""
        total = self.session.execute(
            text(
                "SELECT COUNT(*) FROM candidaturas "
                "WHERE vaga_id = :vaga_id AND status IN ('PENDENTE', 'ACEITA')"
            ),
            {"vaga_id": vaga_id},
        ).scalar_one()
        return total > 0

    def atualizar_vaga(self, vaga_id: str, dados_atualizacao: Dict[str, Any]) -> bool:
        """Atualiza dinamicamente apenas os campos informados."""
        if not dados_atualizacao:
            return False

        for chave in dados_atualizacao:
            if not chave.isidentifier():
                raise ValueError(f"Nome de campo inválido: {chave!r}")

        campos_set = ", ".join(f"{chave} = :{chave}" for chave in dados_atualizacao)
        parametros = {**dados_atualizacao, "vaga_id": vaga_id}

        resultado = self.session.execute(
            text(f"UPDATE vagas SET {campos_set} WHERE id = :vaga_id"),
            parametros,
        )
        self.session.commit()
        return resultado.rowcount > 0
