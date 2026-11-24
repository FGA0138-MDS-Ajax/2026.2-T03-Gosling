"""Registra titular, uso e vínculos de novos arquivos sem remover mídia anterior."""

import sqlalchemy as sa
from alembic import op

revision = "0011_arquivos_midia"
down_revision = "0010_rascunhos_vagas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "arquivos_midia",
        sa.Column("arquivo", sa.String(37), primary_key=True),
        sa.Column(
            "titular_id",
            sa.Integer(),
            sa.ForeignKey("usuarios.id", ondelete="SET NULL"),
        ),
        sa.Column("uso", sa.String(20), nullable=False),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("formato", sa.String(30), nullable=False),
        sa.Column("tamanho_bytes", sa.Integer(), nullable=False),
        sa.Column("largura", sa.Integer(), nullable=True),
        sa.Column("altura", sa.Integer(), nullable=True),
        sa.Column(
            "criado_em", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_arquivos_midia_titular_id", "arquivos_midia", ["titular_id"])
    op.create_table(
        "midia_vagas",
        sa.Column(
            "vaga_id",
            sa.Integer(),
            sa.ForeignKey("vagas.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "arquivo",
            sa.String(37),
            sa.ForeignKey("arquivos_midia.arquivo", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_midia_vagas_arquivo", "midia_vagas", ["arquivo"])
    op.add_column("vagas", sa.Column("enquadramento_fotos", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("vagas", "enquadramento_fotos")
    op.drop_table("midia_vagas")
    op.drop_table("arquivos_midia")
