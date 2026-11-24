"""Unifica o catálogo de causas com as migrações anteriores."""

revision = "0008_merge_catalogo"
down_revision = ("0007_merge_anexos_salvos", "0008_catalogo_causas")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
