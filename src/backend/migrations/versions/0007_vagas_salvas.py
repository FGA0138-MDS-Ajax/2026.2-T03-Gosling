import sqlalchemy as sa
from alembic import op

revision = "0007_vagas_salvas"
down_revision = "0006_candidaturas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vagas_salvas",
        sa.Column(
            "voluntario_id",
            sa.Integer(),
            sa.ForeignKey("voluntarios.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "vaga_id",
            sa.Integer(),
            sa.ForeignKey("vagas.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "salvo_em",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_vagas_salvas_vaga_id", "vagas_salvas", ["vaga_id"])


def downgrade() -> None:
    op.drop_table("vagas_salvas")
