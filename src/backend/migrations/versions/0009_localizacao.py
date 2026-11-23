"""Estrutura endereços sem inferir coordenadas nem alterar textos anteriores."""

import sqlalchemy as sa
from alembic import op

revision = "0009_localizacao"
down_revision = "0008_catalogo_causas"
branch_labels = None
depends_on = None


def campos(tabela):
    tipos = {
        "cep": sa.String(8),
        "logradouro": sa.String(200),
        "numero": sa.String(30),
        "complemento": sa.String(100),
        "bairro": sa.String(100),
        "regiao_administrativa": sa.String(100),
        "latitude": sa.Numeric(10, 7),
        "longitude": sa.Numeric(10, 7),
        "origem_coordenadas": sa.String(20),
    }
    if tabela != "voluntarios":
        tipos.update(cidade=sa.String(100), estado=sa.String(2))
    return tipos


def upgrade():
    for tabela in ("voluntarios", "organizacoes", "vagas"):
        with op.batch_alter_table(tabela) as batch:
            for nome, tipo in campos(tabela).items():
                batch.add_column(sa.Column(nome, tipo, nullable=True))
            batch.create_check_constraint(
                f"ck_{tabela}_coordenadas",
                "(latitude IS NULL AND longitude IS NULL) OR "
                "(latitude IS NOT NULL AND longitude IS NOT NULL "
                "AND latitude BETWEEN -90 AND 90 "
                "AND longitude BETWEEN -180 AND 180)",
            )
    with op.batch_alter_table("vagas") as batch:
        batch.add_column(
            sa.Column(
                "origem_localizacao",
                sa.String(20),
                nullable=False,
                server_default="LEGADO",
            )
        )
    op.execute("UPDATE vagas SET origem_localizacao='REMOTA' WHERE modalidade='REMOTO'")


def downgrade():
    for tabela in ("vagas", "organizacoes", "voluntarios"):
        with op.batch_alter_table(tabela) as batch:
            batch.drop_constraint(f"ck_{tabela}_coordenadas", type_="check")
            if tabela == "vagas":
                batch.drop_column("origem_localizacao")
            for nome in reversed(campos(tabela)):
                batch.drop_column(nome)
