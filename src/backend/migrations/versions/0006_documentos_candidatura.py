import sqlalchemy as sa
from alembic import op

revision = "0006_documentos_candidatura"
down_revision = "0006_candidaturas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "documentos_candidatura",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "candidatura_id",
            sa.Integer(),
            sa.ForeignKey("candidaturas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("indice", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("arquivo", sa.String(36), nullable=False),
        sa.UniqueConstraint(
            "candidatura_id", "indice", name="uq_documento_candidatura"
        ),
    )


def downgrade() -> None:
    op.drop_table("documentos_candidatura")
