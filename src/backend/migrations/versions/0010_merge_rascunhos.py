"""Unifica a migração de rascunhos com as migrações anteriores."""

revision = "0010_merge_rascunhos"
down_revision = ("0009_merge_localizacao", "0010_rascunhos_vagas")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
