import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List

import jwt
from argon2 import PasswordHasher

from app.voluntarios.me.repository import VoluntarioEntity, VoluntarioRepository
from app.voluntarios.me.schemas import (
    AtualizaPerfilUsuariosRequest,
    CadastroVoluntarioRequest,
    CadastroVoluntarioResponse,
    PerfilVoluntarioResponse,
    VoluntarioPublicoDTO,
)
SECRET_KEY = os.getenv(
    "SECRET_KEY", "chave_secreta_padrao_para_ambiente_dev_32_bytes_minimo"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
TOKEN_ISSUER = "volun-ja-api"


class EmailJaCadastradoException(Exception):
    pass


class IdentificacaoJaCadastradaException(Exception):
    pass


class ConsentimentoObrigatorioException(Exception):
    pass


# Issue #20
class VoluntarioNaoEncontradoException(Exception):
    pass

class VoluntarioService:
    def __init__(self, voluntario_repository: VoluntarioRepository):
        self.repository = voluntario_repository
        self.ph = PasswordHasher()

    # ---------- Issue #20 ----------

    def _desserializar_lista(self, valor: Any) -> List[str]:
        if not valor:
            return []

        if isinstance(valor, list):
            return valor

        if isinstance(valor, str):
            try:
                carregado = json.loads(valor)
                if isinstance(carregado, list):
                    return carregado
                return []
            except (json.JSONDecodeError, TypeError):
                return [item.strip() for item in valor.split(",") if item.strip()]

        return []

    def _montar_perfil_response(
        self, voluntario: VoluntarioEntity
    ) -> PerfilVoluntarioResponse:
        return PerfilVoluntarioResponse(
            id=voluntario.id,
            nome_completo=voluntario.nome_completo,
            email=voluntario.email,
            identificacao=voluntario.identificacao,
            perfil=voluntario.perfil,
            telefone=voluntario.telefone,
            cidade=voluntario.cidade,
            estado=voluntario.estado,
            biografia=voluntario.biografia,
            causas=self._desserializar_lista(voluntario.causas),
            disponibilidades=self._desserializar_lista(voluntario.disponibilidades),
        )

    def obter_perfil_por_id(self, voluntario_id: str) -> PerfilVoluntarioResponse:
        voluntario = self.repository.buscar_perfil_por_id(voluntario_id)

        if not voluntario:
            raise VoluntarioNaoEncontradoException(
                "Voluntário não encontrado ou cadastro inativo."
            )

        return self._montar_perfil_response(voluntario)

    def atualizar_perfil(
        self, voluntario_id: str, dados: AtualizaPerfilUsuariosRequest
    ) -> PerfilVoluntarioResponse:
        voluntario_existente = self.repository.buscar_perfil_por_id(voluntario_id)

        if not voluntario_existente:
            raise VoluntarioNaoEncontradoException(
                "Voluntário não encontrado ou cadastro inativo."
            )

        payload_atualizacao = dados.model_dump(exclude_unset=True)

        voluntario_atualizado = self.repository.atualizar_perfil(
            voluntario_id=voluntario_id, dados_atualizacao=payload_atualizacao
        )

        if not voluntario_atualizado:
            raise VoluntarioNaoEncontradoException(
                "Falha ao recuperar os dados atualizados do voluntário."
            )

        return self._montar_perfil_response(voluntario_atualizado)

    # ---------- Cadastro (Issue #8) ----------

    def cadastrar_voluntario(
        self, dados: CadastroVoluntarioRequest
    ) -> CadastroVoluntarioResponse:
        if not dados.consentimento_termos:
            raise ConsentimentoObrigatorioException(
                "É obrigatório aceitar os termos de consentimento para realizar o cadastro."
            )

        if self.repository.buscar_por_email(dados.email):
            raise EmailJaCadastradoException(
                "Já existe um cadastro com esse endereço de e-mail."
            )

        if self.repository.buscar_por_identificador(dados.identificacao):
            raise IdentificacaoJaCadastradaException(
                "Já existe um cadastro com esse documento de identificação."
            )

        hash_senha = self.ph.hash(dados.password)

        novo_id = str(uuid.uuid4())
        novo_voluntario = VoluntarioEntity(
            id=novo_id,
            nome_completo=dados.nome_completo.strip(),
            email=dados.email.lower(),
            identificacao=dados.identificacao.strip(),
            password_hash=hash_senha,
            consentimento_termos=dados.consentimento_termos,
            perfil="Voluntario",
            ativo=True,
        )

        voluntario_salvo = self.repository.salvar(novo_voluntario)

        agora = datetime.now(timezone.utc)
        expiracao = agora + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        payload = {
            "sub": voluntario_salvo.id,
            "email": voluntario_salvo.email,
            "perfil": voluntario_salvo.perfil,
            "iat": agora,
            "exp": expiracao,
            "iss": TOKEN_ISSUER,
        }

        token_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        voluntario_dto = VoluntarioPublicoDTO(
            id=voluntario_salvo.id,
            nome_completo=voluntario_salvo.nome_completo,
            email=voluntario_salvo.email,
            identificacao=voluntario_salvo.identificacao,
            perfil=voluntario_salvo.perfil,
        )

        return CadastroVoluntarioResponse(
            mensagem="Voluntário cadastrado com sucesso.",
            voluntario=voluntario_dto,
            access_token=token_jwt,
            token_type="Bearer",
            expires_in_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
        )