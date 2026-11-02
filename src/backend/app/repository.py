from typing import Optional

import pymysql
from pydantic import BaseModel


class UsuarioEntity(BaseModel):
    id: str
    email: str
    password_hash: str
    perfil: str
    ativo: bool



class UsuarioRepository:
    def __init__(self, db_connection):
        self.conn = db_connection

    def buscar_por_email(self, email: str) -> Optional[UsuarioEntity]:
        query = """
            SELECT id, email, password_hash, perfil, ativo
            FROM usuarios
            WHERE email = %s
            LIMIT 1
        """

        with self.conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(query, (email.lower(),))
            row = cursor.fetchone()

        if not row:
            return None

        return UsuarioEntity(
            id=str(row["id"]),
            email=row["email"],
            password_hash=row["password_hash"],
            perfil=row["perfil"],
            ativo=bool(row["ativo"]),
        )