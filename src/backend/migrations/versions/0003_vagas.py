import sqlalchemy as sa
from alembic import op

revision = "0003_vagas"
down_revision = "0002_organizacoes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "causas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(100), nullable=False),
        sa.Column("nome_normalizado", sa.String(300), nullable=False),
        sa.UniqueConstraint("nome_normalizado"),
    )
    op.create_table(
        "vagas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organizacao_id", sa.Integer(),
            sa.ForeignKey("organizacoes.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "causa_id", sa.Integer(), sa.ForeignKey("causas.id"), nullable=False,
        ),
        sa.Column("titulo", sa.String(150), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("atividades", sa.Text(), nullable=False),
        sa.Column(
            "modalidade",
            sa.Enum("PRESENCIAL", "REMOTO", "HIBRIDO", name="modalidade_vaga"),
            nullable=False,
        ),
        sa.Column("local", sa.String(500), nullable=False),
        sa.Column(
            "periodo",
            sa.Enum("MANHA", "TARDE", "NOITE", "MADRUGADA", name="periodo_vaga"),
            nullable=False,
        ),
        sa.Column("carga_horaria", sa.Numeric(7, 2), nullable=False),
        sa.Column("numero_vagas", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("ABERTA", "ENCERRADA", "SUSPENSA", name="status_vaga"),
            nullable=False,
        ),
    )
    op.create_index("ix_vagas_organizacao_id", "vagas", ["organizacao_id"])
    op.create_index("ix_vagas_causa_id", "vagas", ["causa_id"])
    op.create_index("ix_vagas_status_id", "vagas", ["status", "id"])
    op.create_table(
        "ocorrencias_vaga",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "vaga_id", sa.Integer(),
            sa.ForeignKey("vagas.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("inicio", sa.DateTime(), nullable=False),
        sa.Column("fim", sa.DateTime(), nullable=False),
        sa.CheckConstraint("inicio < fim", name="ck_ocorrencias_vaga_intervalo"),
    )
    op.create_index(
        "ix_ocorrencias_vaga_intervalo", "ocorrencias_vaga",
        ["vaga_id", "inicio", "fim"],
    )


def downgrade() -> None:
    op.drop_table("ocorrencias_vaga")
    op.drop_table("vagas")
    op.drop_table("causas")
