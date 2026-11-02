import sqlalchemy as sa
from alembic import op

revision = "0001_auth"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column(
            "perfil",
            sa.Enum(
                "VOLUNTARIO",
                "ORGANIZACAO",
                "ADMINISTRADOR",
                name="perfil_usuario",
            ),
            nullable=False,
        ),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="1"),
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
        sa.UniqueConstraint("email", name="uq_usuarios_email"),
    )
    op.create_table(
        "voluntarios",
        sa.Column(
            "id",
            sa.Integer(),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "organizacoes",
        sa.Column(
            "id",
            sa.Integer(),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tipo",
            sa.Enum("ONG", "PROJETO_SOCIAL", name="tipo_organizacao"),
            nullable=False,
            server_default="ONG",
        ),
    )


def downgrade() -> None:
    op.drop_table("organizacoes")
    op.drop_table("voluntarios")
    op.drop_table("usuarios")
