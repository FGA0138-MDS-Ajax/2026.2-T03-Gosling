"""Catálogo padronizado; nomes privados sem correspondência ficam no perfil."""

import json
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "0008_catalogo_causas"
down_revision = "0007_vagas_salvas"
branch_labels = None
depends_on = None

# Dados congelados desta migração. Aliases são equivalências explícitas;
# assistência social, direitos humanos e infância não são unidos a outra causa.
CATALOGO = (
    ("meio-ambiente", "Meio ambiente", ["Meio Ambiente"]),
    ("educacao", "Educação", []),
    ("alimentacao", "Alimentação", []),
    ("protecao-animal", "Proteção animal", ["Animais"]),
    ("pessoas-idosas", "Pessoas idosas", ["Idosos"]),
    ("cultura", "Cultura", []),
    ("saude", "Saúde", []),
    ("esporte", "Esporte", ["Esportes"]),
)


def normalizar(nome):
    return unicodedata.normalize("NFKC", nome).casefold()


def preencher_catalogo(connection):
    causas = sa.table(
        "causas",
        sa.column("id", sa.Integer),
        sa.column("nome", sa.String),
        sa.column("nome_normalizado", sa.String),
        sa.column("codigo", sa.String),
        sa.column("ativo", sa.Boolean),
        sa.column("ordem", sa.Integer),
        sa.column("aliases", sa.JSON),
    )
    anteriores = connection.execute(sa.select(causas)).mappings().all()
    por_nome = {c["nome_normalizado"]: c["id"] for c in anteriores}
    for causa in anteriores:
        if causa["codigo"] is None:
            connection.execute(
                causas.update()
                .where(causas.c.id == causa["id"])
                .values(
                    codigo=f"legado-{causa['id']}",
                    ativo=False,
                    ordem=1000,
                    aliases=[],
                )
            )
    referencias = dict(por_nome)
    for ordem, (codigo, nome, aliases) in enumerate(CATALOGO):
        normalizado = normalizar(nome)
        if normalizado not in por_nome:
            connection.execute(
                causas.insert().values(
                    nome=nome,
                    nome_normalizado=normalizado,
                    codigo=codigo,
                    ativo=True,
                    ordem=ordem,
                    aliases=aliases,
                )
            )
            por_nome[normalizado] = connection.scalar(
                sa.select(causas.c.id).where(causas.c.codigo == codigo)
            )
        else:
            connection.execute(
                causas.update()
                .where(causas.c.id == por_nome[normalizado])
                .values(
                    nome=nome, codigo=codigo, ativo=True, ordem=ordem, aliases=aliases
                )
            )
        identificador = por_nome[normalizado]
        referencias[normalizado] = identificador
        vagas = sa.table("vagas", sa.column("causa_id", sa.Integer))
        for alias in aliases:
            chave = normalizar(alias)
            referencias[chave] = identificador
            anterior = por_nome.get(chave)
            if anterior is not None and anterior != identificador:
                connection.execute(
                    vagas.update()
                    .where(vagas.c.causa_id == anterior)
                    .values(causa_id=identificador)
                )

    voluntarios = sa.table(
        "voluntarios",
        sa.column("id", sa.Integer),
        sa.column("causas", sa.JSON),
        sa.column("causa_ids", sa.JSON),
    )
    for conta in connection.execute(sa.select(voluntarios)).mappings():
        nomes = conta["causas"]
        if isinstance(nomes, str):
            try:
                nomes = json.loads(nomes)
            except (ValueError, TypeError):
                nomes = [nomes]
        ids = []
        for nome in nomes if isinstance(nomes, list) else []:
            if not isinstance(nome, str):
                continue
            identificador = referencias.get(normalizar(nome))
            if identificador is not None and identificador not in ids:
                ids.append(identificador)
        # Preserva integralmente o JSON anterior, inclusive interesses privados
        # sem correspondência; eles não viram categorias do catálogo público.
        connection.execute(
            voluntarios.update()
            .where(voluntarios.c.id == conta["id"])
            .values(causa_ids=ids)
        )


def upgrade() -> None:
    with op.batch_alter_table("causas") as batch:
        batch.add_column(sa.Column("codigo", sa.String(100), nullable=True))
        batch.add_column(
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default="0")
        )
        batch.add_column(
            sa.Column("ordem", sa.Integer(), nullable=False, server_default="1000")
        )
        batch.add_column(sa.Column("aliases", sa.JSON(), nullable=True))
        batch.create_unique_constraint("uq_causas_codigo", ["codigo"])
    with op.batch_alter_table("voluntarios") as batch:
        batch.add_column(sa.Column("causa_ids", sa.JSON(), nullable=True))
    preencher_catalogo(op.get_bind())


def downgrade() -> None:
    with op.batch_alter_table("voluntarios") as batch:
        batch.drop_column("causa_ids")
    with op.batch_alter_table("causas") as batch:
        batch.drop_constraint("uq_causas_codigo", type_="unique")
        for campo in ("aliases", "ordem", "ativo", "codigo"):
            batch.drop_column(campo)
