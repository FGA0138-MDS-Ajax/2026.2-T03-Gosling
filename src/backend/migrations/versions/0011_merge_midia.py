"""Unifica a migração de mídia com as migrações anteriores."""

revision = "0011_merge_midia"
down_revision = ("0010_merge_rascunhos", "0011_arquivos_midia")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
