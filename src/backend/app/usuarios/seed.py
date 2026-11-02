import os

from sqlalchemy.orm import Session

from app.core.database import get_engine
from app.core.security import hash_password
from app.usuarios.models import Organizacao, Usuario, Voluntario
from app.usuarios.repository import UsuarioRepository


def main() -> None:
    password = os.getenv("DEMO_PASSWORD", "")
    if len(password) < 8:
        raise RuntimeError("Defina DEMO_PASSWORD com pelo menos 8 caracteres.")
    contas = [
        Voluntario(nome="Voluntário de demonstração", email="voluntario@example.com"),
        Organizacao(nome="ONG de demonstração", email="ong@example.com"),
        Usuario(nome="Administrador de demonstração", email="admin@example.com"),
    ]
    criado = 0
    with Session(get_engine()) as session, session.begin():
        repository = UsuarioRepository(session)
        for conta in contas:
            if repository.buscar_por_email(conta.email) is None:
                conta.senha_hash = hash_password(password)
                repository.adicionar(conta)
                criado += 1
    print(f"{criado} contas fictícias criadas. Contas existentes foram preservadas.")


if __name__ == "__main__":
    main()
