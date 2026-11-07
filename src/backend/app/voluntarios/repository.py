from dataclasses import dataclass
from typing import Optional

import pymysql


@dataclass
class VoluntarioEntity:
    id: str
    nome_completo: str
    email: str
    identificacao: str
    password_hash: str
    consentimento_termos: bool
    perfil: str = "Voluntario"
    ativo: bool = True


class VoluntarioRepository:
    def __init__(self, db_connection=None):
        # 1. Atributo unificado para self.conn
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

        return VoluntarioEntity(
            id=str(row["id"]),
            nome_completo=row["nome_completo"],
            email=row["email"],
            identificacao=row["identificacao"],
            password_hash=row["password_hash"],
            consentimento_termos=bool(row["consentimento_termos"]),
            perfil=row["perfil"],
            ativo=bool(row["ativo"]),
        )

    def buscar_por_identificador(self, identificador: str) -> Optional[VoluntarioEntity]:
        if not self.conn:
            return None

        # 2. Corrigido WHERE para a coluna identificacao
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

        return VoluntarioEntity(
            id=str(row["id"]),
            nome_completo=row["nome_completo"],
            email=row["email"],
            identificacao=row["identificacao"],
            password_hash=row["password_hash"],
            consentimento_termos=bool(row["consentimento_termos"]),
            perfil=row["perfil"],
            ativo=bool(row["ativo"]),
        )

    def salvar(self, voluntario: VoluntarioEntity) -> VoluntarioEntity:
        if not self.conn:
            return voluntario

        # 3. Corrigido nome_completo no INSERT
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

        # 4. Retorna a própria instância salva
        return voluntario