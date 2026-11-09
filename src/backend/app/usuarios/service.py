from app.usuarios.repository import UsuarioRepository
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.core.security import hash_password
from app.usuarios.enums import Perfil, TipoOrganizacao
from app.usuarios.models import Organizacao
from app.usuarios.schemas import (
    AtualizarOrganizacaoRequest,
    CadastroOrganizacaoRequest,
    OrganizacaoPublica,
    UsuarioCredenciais,
)


class UsuarioService:
    def __init__(self, repository: UsuarioRepository):
        self.repository = repository

    def buscar_por_email(self, email: str) -> UsuarioCredenciais | None:
        usuario = self.repository.buscar_por_email(email.strip().lower())
        return (
            UsuarioCredenciais.model_validate(usuario) if usuario is not None else None
        )

    def buscar_por_id(self, usuario_id: int) -> UsuarioCredenciais | None:
        usuario = self.repository.buscar_por_id(usuario_id)
        return (
            UsuarioCredenciais.model_validate(usuario) if usuario is not None else None
        )


class OrganizacaoService:
    def __init__(self, repository: UsuarioRepository):
        self.repository = repository

    def cadastrar(self, dados: CadastroOrganizacaoRequest) -> OrganizacaoPublica:
        self._verificar_duplicidade(str(dados.email), dados.cnpj)
        organizacao = Organizacao(
            **dados.model_dump(exclude={"senha"}),
            senha_hash=hash_password(dados.senha.get_secret_value()),
            perfil=Perfil.ORGANIZACAO,
            tipo=TipoOrganizacao.ONG,
            ativo=True,
            homologada=True,
        )
        return self._salvar(organizacao)

    def consultar(self, usuario_id: int) -> OrganizacaoPublica:
        organizacao = self._obter(usuario_id)
        return OrganizacaoPublica.model_validate(organizacao)

    def atualizar(
        self,
        usuario_id: int,
        dados: AtualizarOrganizacaoRequest,
    ) -> OrganizacaoPublica:
        organizacao = self._obter(usuario_id)

        if organizacao.tipo == TipoOrganizacao.ONG and (
            dados.cnpj is None or dados.razao_social is None
        ):
            raise HTTPException(
                status_code=422,
                detail="ONG precisa informar razão social e CNPJ.",
            )

        self._verificar_duplicidade(str(dados.email), dados.cnpj, usuario_id)

        for campo, valor in dados.model_dump().items():
            setattr(organizacao, campo, valor)

        organizacao.atualizado_em = func.now()
        return self._salvar(organizacao)

    def _obter(self, usuario_id: int) -> Organizacao:
        organizacao = self.repository.buscar_organizacao_por_id(usuario_id)
        if organizacao is None:
            raise HTTPException(
                status_code=404,
                detail="Organização não encontrada.",
            )
        return organizacao

    def _verificar_duplicidade(
        self,
        email: str,
        cnpj: str | None,
        usuario_id: int | None = None,
    ) -> None:
        usuario = self.repository.buscar_por_email(email)
        if usuario is not None and usuario.id != usuario_id:
            raise HTTPException(
                status_code=409,
                detail="E-mail já cadastrado.",
            )

        if cnpj is not None:
            organizacao = self.repository.buscar_por_cnpj(cnpj)
            if organizacao is not None and organizacao.id != usuario_id:
                raise HTTPException(
                    status_code=409,
                    detail="CNPJ já cadastrado.",
                )

    def _salvar(self, organizacao: Organizacao) -> OrganizacaoPublica:
        email = organizacao.email
        cnpj = organizacao.cnpj
        usuario_id = organizacao.id
        try:
            salvo = self.repository.salvar(organizacao)
        except IntegrityError:
            self._verificar_duplicidade(email, cnpj, usuario_id)
            raise
        return OrganizacaoPublica.model_validate(salvo)
