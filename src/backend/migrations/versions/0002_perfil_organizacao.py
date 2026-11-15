import sqlalchemy as sa
from alembic import op

revision = "0002_organizacoes"
down_revision = "0001_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("organizacoes") as batch:
        for nome, tipo in (
            ("razao_social", sa.String(200)),
            ("cnpj", sa.String(14)),
            ("area_atuacao", sa.String(150)),
            ("endereco", sa.String(500)),
            ("responsavel", sa.String(150)),
            ("descricao", sa.Text()),
            ("telefone", sa.String(15)),
        ):
            batch.add_column(sa.Column(nome, tipo, nullable=True))

        batch.add_column(
            sa.Column(
                "consentimento_termos",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            )
        )
        batch.add_column(
            sa.Column(
                "homologada",
                sa.Boolean(),
                nullable=False,
                server_default="1",
            )
        )
        batch.create_unique_constraint("uq_organizacoes_cnpj", ["cnpj"])


def downgrade() -> None:
    with op.batch_alter_table("organizacoes") as batch:
        batch.drop_constraint("uq_organizacoes_cnpj", type_="unique")

        for nome in (
            "homologada",
            "consentimento_termos",
            "telefone",
            "descricao",
            "responsavel",
            "endereco",
            "area_atuacao",
            "cnpj",
            "razao_social",
        ):
            batch.drop_column(nome)
