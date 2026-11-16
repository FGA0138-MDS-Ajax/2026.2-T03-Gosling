import unicodedata

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga
from typing import Any,Dict, Optional



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

    def listar_publicas(self, pagina: int, por_pagina: int):
        filtros = (
            Vaga.status == StatusVaga.ABERTA,
            Organizacao.ativo.is_(True),
            Organizacao.homologada.is_(True),
        )
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

    def confirmar(self) -> None:
        self.session.commit()

    def desfazer(self) -> None:
        self.session.rollback()

    def buscar_por_id(self,vaga_id: str) -> Optional[Dict[str,Any]]:
        if not self.conn:
            return None

        with self.conn.cursor() as cursor:
            sql = "SELECT * FROM vagas WHERE id = %s"
            cursor.execute(sql, (vaga_id))
            return cursor.fetchone()

    def tem_candidaturas_ativas(self,vaga_id:str)-> bool:
        if not self.conn:
            return False
        with self.conn.cursor() as cursor:
            sql = (
                "SELECT COUNT(*) AS total FROM candidaturas"
                "WHERE vaga_id = %s AND status IN ('PENDENTE' , 'ACEITA')"
            )
            cursor.execute(sql,(vaga_id))
            resultado = cursor.fetchone()
            return resultado["total"] > 0

    def atualizar_vaga(self,vaga_id: str, dados_atualizacao: Dict[str,Any]) -> bool:
        if not self.conn or not dados_atualizacao:
            return False

        campos_set = [f"{chave} = %s" for chave in dados_atualizacao.keys()]
        valores = list(dados_atualizacao.values())
        valores.append(vaga_id)

        sql = f"UPDATE vaga SET {','.join(campos_set)}WHERE id = %s"

        with self.conn.cursor() as cursor:
            cursor.execute(sql, tuple(valores))
            self.conn.commit()
            return cursor.rowcount > 0


