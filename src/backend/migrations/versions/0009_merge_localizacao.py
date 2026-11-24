"""Unifica a migração de localização com as migrações anteriores."""

revision = "0009_merge_localizacao"
down_revision = ("0008_merge_catalogo", "0009_localizacao")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
