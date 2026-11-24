"""Unifica as migrações de anexos de candidatura e vagas salvas."""

revision = "0007_merge_anexos_salvos"
down_revision = ("0006_documentos_candidatura", "0007_vagas_salvas")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
