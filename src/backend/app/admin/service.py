from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.admin.repository import AdminRepository
from app.admin.schemas import (
    ContaAdminPublica,
    CriarContaRequest,
    ListaContasResponse,
)
from app.core.errors import NaoAutenticadoError
from app.core.security import hash_password
from app.usuarios.enums import Perfil, TipoOrganizacao
from app.usuarios.models import Organizacao, Usuario, Voluntario


class AdminService:
    def __init__(self, repository: AdminRepository):
        self.repository = repository

    def listar(self, pagina, por_pagina, busca, perfil, ativo):
        itens, total = self.repository.listar(
            pagina, por_pagina, busca, perfil, ativo
        )
        return ListaContasResponse(
            itens=[
                ContaAdminPublica.model_validate(usuario).model_copy(
                    update={"quantidade_vagas": int(vagas)}
                )
                for usuario, vagas in itens
            ],
            total=total, pagina=pagina, por_pagina=por_pagina,
        )

    def consultar(self, usuario_id):
        usuario = self.repository.buscar_por_id(usuario_id)
        if usuario is None:
            raise HTTPException(status_code=404, detail="Cadastro não encontrado.")
        return ContaAdminPublica.model_validate(usuario).model_copy(
            update={"quantidade_vagas": self.repository.contar_vagas(usuario_id)}
        )

    def criar(self, dados: CriarContaRequest):
        cnpj = getattr(dados, "cnpj", None)
        self._verificar_duplicidade(str(dados.email), cnpj)
        campos = dados.model_dump(exclude={"senha", "perfil"})
        campos["senha_hash"] = hash_password(dados.senha.get_secret_value())
        if dados.perfil == Perfil.ORGANIZACAO:
            usuario = Organizacao(
                **campos, perfil=Perfil.ORGANIZACAO,
                tipo=TipoOrganizacao.ONG, consentimento_termos=False,
            )
        elif dados.perfil == Perfil.VOLUNTARIO:
            usuario = Voluntario(**campos, perfil=Perfil.VOLUNTARIO)
        else:
            usuario = Usuario(**campos, perfil=Perfil.ADMINISTRADOR)
        try:
            self.repository.adicionar(usuario)
            self.repository.flush()
            resposta = ContaAdminPublica.model_validate(usuario)
            self.repository.confirmar()
            return resposta
        except IntegrityError:
            self.repository.desfazer()
            self._verificar_duplicidade(str(dados.email), cnpj)
            raise
        except Exception:
            self.repository.desfazer()
            raise

    def excluir(self, administrador_id, usuario_id, excluir_vagas=False):
        if administrador_id == usuario_id:
            raise HTTPException(
                status_code=409, detail="Você não pode excluir a conta em uso."
            )
        try:
            administradores = self.repository.bloquear_administradores()
            if not any(
                item.id == administrador_id and item.ativo
                for item in administradores
            ):
                raise NaoAutenticadoError()
            usuario = self.repository.buscar_para_excluir(usuario_id)
            if usuario is None:
                raise HTTPException(
                    status_code=404, detail="Cadastro não encontrado."
                )
            vagas = self.repository.bloquear_vagas(usuario_id)
            if vagas and not excluir_vagas:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"A ONG possui {len(vagas)} vaga(s). "
                        "Confirme a exclusão das vagas vinculadas."
                    ),
                )
            self.repository.excluir(usuario)
            self.repository.confirmar()
        except IntegrityError as error:
            self.repository.desfazer()
            raise HTTPException(
                status_code=409,
                detail="O cadastro possui vínculos que impedem a exclusão.",
            ) from error
        except Exception:
            self.repository.desfazer()
            raise

    def _verificar_duplicidade(self, email, cnpj):
        if self.repository.buscar_por_email(email) is not None:
            raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
        if cnpj and self.repository.buscar_por_cnpj(cnpj) is not None:
            raise HTTPException(status_code=409, detail="CNPJ já cadastrado.")
