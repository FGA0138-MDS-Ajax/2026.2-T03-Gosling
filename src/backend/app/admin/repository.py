from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectin_polymorphic

from app.usuarios.enums import Perfil
from app.usuarios.models import Organizacao, Usuario, Voluntario
from app.usuarios.repository import UsuarioRepository
from app.vagas.models import Vaga


class AdminRepository(UsuarioRepository):
    def listar(self, pagina, por_pagina, busca, perfil, ativo):
        filtros = []
        if busca:
            filtros.append(or_(
                Usuario.nome.icontains(busca, autoescape=True),
                Usuario.email.icontains(busca, autoescape=True),
            ))
        if perfil is not None:
            filtros.append(Usuario.perfil == perfil)
        if ativo is not None:
            filtros.append(Usuario.ativo == ativo)
        vagas = (
            select(Vaga.organizacao_id, func.count(Vaga.id).label("total"))
            .group_by(Vaga.organizacao_id).subquery()
        )
        total = self.session.scalar(
            select(func.count(Usuario.id)).where(*filtros)
        )
        itens = self.session.execute(
            select(Usuario, func.coalesce(vagas.c.total, 0))
            .outerjoin(vagas, Usuario.id == vagas.c.organizacao_id)
            .options(selectin_polymorphic(Usuario, [Voluntario, Organizacao]))
            .where(*filtros).order_by(Usuario.id.desc())
            .offset((pagina - 1) * por_pagina).limit(por_pagina)
        ).all()
        return itens, total

    def contar_vagas(self, usuario_id):
        return self.session.scalar(
            select(func.count(Vaga.id)).where(Vaga.organizacao_id == usuario_id)
        )

    def bloquear_administradores(self):
        return self.session.scalars(
            select(Usuario)
            .where(Usuario.perfil == Perfil.ADMINISTRADOR)
            .order_by(Usuario.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).all()

    def buscar_para_excluir(self, usuario_id):
        usuario = self.session.scalar(
            select(Usuario).where(Usuario.id == usuario_id)
            .with_for_update().execution_options(populate_existing=True)
        )
        if usuario is not None and usuario.perfil == Perfil.ORGANIZACAO:
            usuario = self.session.scalar(
                select(Organizacao).where(Organizacao.id == usuario_id)
                .with_for_update().execution_options(populate_existing=True)
            )
        return usuario

    def bloquear_vagas(self, usuario_id):
        return self.session.scalars(
            select(Vaga.id).where(Vaga.organizacao_id == usuario_id)
            .order_by(Vaga.id).with_for_update()
        ).all()

    def excluir(self, usuario):
        self.session.delete(usuario)

    def flush(self):
        self.session.flush()

    def confirmar(self):
        self.session.commit()

    def desfazer(self):
        self.session.rollback()
