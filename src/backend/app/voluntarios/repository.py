import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import pymysql


@dataclass
class VoluntarioEntity:
    id: str
    nome_completo: str
    email: str
    identificacao: str
    perfil: str
    ativo: bool
    password_hash: str
    consentimento_termos: bool = False
    telefone: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    biografia: Optional[str] = None
    causas: Optional[Any] = None
    disponibilidades: Optional[Any] = None


class VoluntarioRepository:
    def __init__(self, db_connection=None):
        self.conn = db_connection

    def buscar_por_email(self, email: str) -> Optional[VoluntarioEntity]:
        if not self.conn:
            return None

        sql = """
            SELECT id, nome_completo, email, identificacao, password_hash,
                   consentimento_termos, perfil, ativo
            FROM usuarios
            WHERE email = %s
            LIMIT 1;
        """

        with self.conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(sql, (email.lower(),))
            row = cursor.fetchone()

        if not row:
            return None

        return self._converter_para_entidade(row)

    def buscar_por_identificador(
        self, identificador: str
        )-> Optional[VoluntarioEntity]:
        if not self.conn:
            return None

        sql = """
            SELECT id, nome_completo, email, identificacao, password_hash,
                   consentimento_termos, perfil, ativo
            FROM usuarios
            WHERE identificacao = %s
            LIMIT 1;
        """

        with self.conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(sql, (identificador.strip(),))
            row = cursor.fetchone()

        if not row:
            return None

        return self._converter_para_entidade(row)

    def salvar(self, voluntario: VoluntarioEntity) -> VoluntarioEntity:
        if not self.conn:
            return voluntario

        sql = """
            INSERT INTO usuarios (
                id, nome_completo, email, identificacao, password_hash,
                consentimento_termos, perfil, ativo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """

        with self.conn.cursor() as cursor:
            cursor.execute(
                sql,
                (
                    voluntario.id,
                    voluntario.nome_completo,
                    voluntario.email.lower(),
                    voluntario.identificacao,
                    voluntario.password_hash,
                    voluntario.consentimento_termos,
                    voluntario.perfil,
                    voluntario.ativo,
                ),
            )

        self.conn.commit()
        return voluntario

    # ---------- Parte da Issue #20 ----------

    def buscar_perfil_por_id(self, voluntario_id: str) -> Optional[VoluntarioEntity]:
        if not self.conn:
            return None

        sql = """
            SELECT id, nome_completo, email, identificacao, perfil, ativo,
                   password_hash, consentimento_termos, telefone, cidade,
                   estado, biografia, causas, disponibilidades
            FROM usuarios
            WHERE id = %s AND ativo = TRUE
            LIMIT 1;
        """

        with self.conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(sql, (voluntario_id,))
            linha = cursor.fetchone()

        if not linha:
            return None

        return self._converter_para_entidade(linha)

    def atualizar_perfil(
        self, voluntario_id: str, dados_atualizacao: Dict[str, Any]
    ) -> Optional[VoluntarioEntity]:
        if not self.conn:
            return None

        campos_sql: List[str] = []
        valores_sql: List[Any] = []

        campos_permitidos = [
            "nome_completo",
            "telefone",
            "cidade",
            "estado",
            "biografia",
        ]

        for campo in campos_permitidos:
            if campo in dados_atualizacao and dados_atualizacao[campo] is not None:
                campos_sql.append(f"{campo} = %s")
                valores_sql.append(dados_atualizacao[campo])

        for campo_json in ("causas", "disponibilidades"):
            valor = dados_atualizacao.get(campo_json)
            if valor is not None:
                campos_sql.append(f"{campo_json} = %s")
                valores_sql.append(json.dumps(valor))
        if not campos_sql:
            return self.buscar_perfil_por_id(voluntario_id)

        valores_sql.append(voluntario_id)
        sql = (
            "UPDATE usuarios "
            f"SET {', '.join(campos_sql)} "
            "WHERE id = %s AND ativo = TRUE"
        )

        with self.conn.cursor() as cursor:
            cursor.execute(sql, tuple(valores_sql))
        self.conn.commit()

        return self.buscar_perfil_por_id(voluntario_id)

    # ---------- Auxiliares ----------

    @staticmethod
    def _carregar_json(valor: Any) -> Any:
        """Converte JSON vindo do banco em lista; outros valores passam direto."""
        if isinstance(valor, str):
            try:
                return json.loads(valor)
            except json.JSONDecodeError:
                return valor
        return valor

    def _converter_para_entidade(self, linha: Dict[str, Any]) -> VoluntarioEntity:
        return VoluntarioEntity(
            id=str(linha["id"]),
            nome_completo=linha["nome_completo"],
            email=linha["email"],
            identificacao=linha["identificacao"],
            perfil=linha["perfil"],
            ativo=bool(linha["ativo"]),
            password_hash=linha["password_hash"],
            consentimento_termos=bool(linha.get("consentimento_termos", False)),
            telefone=linha.get("telefone"),
            cidade=linha.get("cidade"),
            estado=linha.get("estado"),
            biografia=linha.get("biografia"),
            causas=self._carregar_json(linha.get("causas")),
            disponibilidades=self._carregar_json(linha.get("disponibilidades")),
        )