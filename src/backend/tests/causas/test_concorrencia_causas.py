import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.main import app
from app.usuarios.catalogos import Causa
from app.usuarios.models import Organizacao
from app.vagas.models import Vaga

pytest_plugins = ["tests.vagas.test_publicacao"]


def test_publicacoes_simultaneas_referenciam_a_mesma_causa_no_mysql(
    senha_hash,
    jwt_secret,
    dados_vaga,
):
    database_url = os.getenv("TEST_DATABASE_URL", "")
    if not database_url.startswith("mysql"):
        pytest.skip("Concorrência validada com o MySQL de teste migrado.")
    engine = create_engine(database_url, pool_pre_ping=True)
    anterior = app.dependency_overrides.get(get_db)
    organizacao_id = None
    try:
        with Session(engine) as session:
            identificador = session.scalar(
                select(Causa.id).where(Causa.codigo == "educacao")
            )
            quantidade = session.scalar(select(func.count()).select_from(Causa))
            organizacao = Organizacao(
                nome="ONG concorrência de causas",
                email=f"causas-{uuid4()}@example.com",
                senha_hash=senha_hash,
            )
            session.add(organizacao)
            session.commit()
            organizacao_id = organizacao.id
        token = create_access_token(organizacao_id, "ORGANIZACAO")

        def sessao_independente():
            with Session(engine) as session:
                yield session

        app.dependency_overrides[get_db] = sessao_independente
        dados = {**dados_vaga, "causa_id": identificador}
        del dados["causa"]

        def publicar(indice):
            with TestClient(app) as client:
                return client.post(
                    "/api/v1/vagas",
                    headers={"Authorization": f"Bearer {token}"},
                    json={**dados, "titulo": f"Publicação concorrente {indice}"},
                )

        with ThreadPoolExecutor(max_workers=2) as executor:
            respostas = list(executor.map(publicar, (1, 2)))
        assert [r.status_code for r in respostas] == [201, 201]
        assert {r.json()["causa"]["id"] for r in respostas} == {identificador}
        with Session(engine) as session:
            assert session.scalar(select(func.count()).select_from(Causa)) == quantidade
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(Vaga)
                    .where(Vaga.organizacao_id == organizacao_id)
                )
                == 2
            )
    finally:
        if anterior is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior
        if organizacao_id is not None:
            with Session(engine) as session:
                organizacao = session.get(Organizacao, organizacao_id)
                if organizacao is not None:
                    session.delete(organizacao)
                    session.commit()
        engine.dispose()
