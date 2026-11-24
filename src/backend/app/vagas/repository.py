import unicodedata
from typing import Any, Dict, Optional

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.candidaturas.enums import STATUS_ATIVOS
from app.candidaturas.models import Candidatura
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga


_CAMPO_PARA_COLUNA = {
    "estado_vaga": "status",
}


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

    def buscar_por_id(
        self, vaga_id: str, *, bloquear: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Busca uma vaga pelo id.

        Retorna o dicionário com as colunas reais da tabela, **mais** o
        alias ``estado_vaga`` (espelhando ``status``), para que a camada
        de serviço/router possa devolver o payload no contrato público
        sem precisar reescrever o nome do campo.
        """
        consulta = "SELECT * FROM vagas WHERE id = :id"
        if bloquear and self.session.get_bind().dialect.name != "sqlite":
            consulta += " FOR UPDATE"
        resultado = self.session.execute(text(consulta), {"id": vaga_id})
        linha = resultado.mappings().first()
        if not linha:
            return None
        vaga = dict(linha)
        if "status" in vaga and "estado_vaga" not in vaga:
            vaga["estado_vaga"] = vaga["status"]
        return vaga

    def tem_candidaturas_ativas(self, vaga_id: str) -> bool:
        """Verifica se a vaga possui candidaturas em status PENDENTE ou ACEITA."""
        consulta = (
            select(Candidatura.id)
            .where(
                Candidatura.vaga_id == vaga_id,
                Candidatura.status.in_(STATUS_ATIVOS),
            )
            .limit(1)
            .with_for_update(read=True)
        )
        return self.session.scalar(consulta) is not None

    def atualizar_vaga(
        self, vaga_id: str, dados_atualizacao: Dict[str, Any]
    ) -> bool:
        """Atualiza dinamicamente apenas os campos informados.

        - ``estado_vaga`` é mapeado para a coluna ``status``.
        - ``ocorrencias`` é tratada à parte (delete+insert) porque não é
          coluna escalar de ``vagas``.
        - Campos desconhecidos vindos do schema (que já usa
          ``extra="forbid"``) chegam aqui somente se forem válidos; ainda
          assim, o guard ``isidentifier`` evita injeção via nome de coluna.
        """
        if not dados_atualizacao:
            return False

        ocorrencias = dados_atualizacao.pop("ocorrencias", None)

        campos_set: list[str] = []
        parametros: Dict[str, Any] = {"vaga_id": vaga_id}
        for chave, valor in dados_atualizacao.items():
            coluna = _CAMPO_PARA_COLUNA.get(chave, chave)
            if not coluna.isidentifier():
                raise ValueError(f"Nome de campo inválido: {coluna!r}")
            campos_set.append(f"{coluna} = :{coluna}")
            parametros[coluna] = valor

        if campos_set:
            self.session.execute(
                text(
                    f"UPDATE vagas SET {', '.join(campos_set)} "
                    "WHERE id = :vaga_id"
                ),
                parametros,
            )

        if ocorrencias is not None:
            self.session.execute(
                text("DELETE FROM ocorrencias_vaga WHERE vaga_id = :vaga_id"),
                {"vaga_id": vaga_id},
            )
            for item in ocorrencias:
                self.session.execute(
                    text(
                        "INSERT INTO ocorrencias_vaga (vaga_id, inicio, fim) "
                        "VALUES (:vaga_id, :inicio, :fim)"
                    ),
                    {
                        "vaga_id": vaga_id,
                        "inicio": item["inicio"],
                        "fim": item["fim"],
                    },
                )

        self.session.commit()
        return True
