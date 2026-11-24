import sqlalchemy as sa
from alembic import op

revision = "0005_layout_voluntario_vaga"
down_revision = "0004_perfil_voluntario"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("voluntarios") as batch:
        batch.add_column(sa.Column("disponibilidade_semanal", sa.JSON(), nullable=True))
        batch.add_column(
            sa.Column("carga_horaria_semanal", sa.Integer(), nullable=True)
        )
        batch.add_column(sa.Column("foto_url", sa.String(500), nullable=True))
    with op.batch_alter_table("vagas") as batch:
        batch.add_column(sa.Column("fotos", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("documentos_exigidos", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("vagas") as batch:
        batch.drop_column("documentos_exigidos")
        batch.drop_column("fotos")
    with op.batch_alter_table("voluntarios") as batch:
        batch.drop_column("foto_url")
        batch.drop_column("carga_horaria_semanal")
        batch.drop_column("disponibilidade_semanal")
