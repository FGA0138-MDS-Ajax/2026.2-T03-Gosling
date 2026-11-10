import sqlalchemy as sa
from alembic import op

revision = "0004_perfil_voluntario"
down_revision = "0003_vagas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("voluntarios") as batch:
        for nome, tamanho in (
            ("identificacao", 20),
            ("telefone", 20),
            ("cidade", 100),
            ("estado", 2),
            ("biografia", 500),
        ):
            batch.add_column(sa.Column(nome, sa.String(tamanho), nullable=True))
        batch.add_column(
            sa.Column(
                "consentimento_termos", sa.Boolean(), nullable=False, server_default="0"
            )
        )
        for nome in ("causas", "disponibilidades"):
            batch.add_column(sa.Column(nome, sa.JSON(), nullable=True))
        batch.create_unique_constraint(
            "uq_voluntarios_identificacao", ["identificacao"]
        )


def downgrade() -> None:
    with op.batch_alter_table("voluntarios") as batch:
        batch.drop_constraint("uq_voluntarios_identificacao", type_="unique")
        for nome in (
            "disponibilidades",
            "causas",
            "consentimento_termos",
            "biografia",
            "estado",
            "cidade",
            "telefone",
            "identificacao",
        ):
            batch.drop_column(nome)
