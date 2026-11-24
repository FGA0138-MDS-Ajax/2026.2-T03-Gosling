import sqlalchemy as sa
from alembic import op

revision = "0006_candidaturas"
down_revision = "0005_layout_voluntario_vaga"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidaturas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "voluntario_id",
            sa.Integer(),
            sa.ForeignKey("voluntarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "vaga_id",
            sa.Integer(),
            sa.ForeignKey("vagas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDENTE",
                "ACEITA",
                "RECUSADA",
                "CANCELADA",
                name="status_candidatura",
                create_constraint=True,
            ),
            nullable=False,
            server_default="PENDENTE",
        ),
        sa.Column(
            "criado_em",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "voluntario_id",
            "vaga_id",
            name="uq_candidatura_voluntario_vaga",
        ),
    )
    op.create_index(
        "ix_candidaturas_voluntario_status",
        "candidaturas",
        ["voluntario_id", "status"],
    )
    op.create_index("ix_candidaturas_vaga_id", "candidaturas", ["vaga_id"])


def downgrade() -> None:
    op.drop_table("candidaturas")
