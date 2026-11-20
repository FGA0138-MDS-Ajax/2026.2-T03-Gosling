import unicodedata
from typing import Any, Dict, Optional

from sqlalchemy import func, select, text
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

    def listar_vagas_por_organizacao(
        self, organizacao_id: int, pagina: int = 1, tamanho_pagina: int = 10
    ) -> tuple[list[dict[str, Any]], int]:
        offset = (pagina - 1) * tamanho_pagina

        total_itens = self.session.execute(
            text("SELECT COUNT(*) FROM vagas WHERE organizacao_id = :organizacao_id"),
            {"organizacao_id": organizacao_id},
        ).scalar_one()

        linhas = (
            self.session.execute(
                text(
                    "SELECT v.id, v.titulo, v.estado_vaga, v.cidade, v.estado_uf, "
                    "v.data_criacao, COUNT(c.id) AS total_candidaturas "
                    "FROM vagas v "
                    "LEFT JOIN candidaturas c ON c.vaga_id = v.id "
                    "WHERE v.organizacao_id = :organizacao_id "
                    "GROUP BY v.id, v.titulo, v.estado_vaga, v.cidade, "
                    "v.estado_uf, v.data_criacao "
                    "ORDER BY v.data_criacao DESC, v.id DESC "
                    "LIMIT :limite OFFSET :offset"
                ),
                {
                    "organizacao_id": organizacao_id,
                    "limite": tamanho_pagina,
                    "offset": offset,
                },
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