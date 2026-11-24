"""Permite vagas incompletas somente no estado de rascunho."""

import sqlalchemy as sa
from alembic import op

revision = "0010_rascunhos_vagas"
down_revision = "0009_localizacao"
branch_labels = None
depends_on = None

STATUS_ANTERIOR = sa.Enum("ABERTA", "ENCERRADA", "SUSPENSA", name="status_vaga")
STATUS_NOVO = sa.Enum(*STATUS_ANTERIOR.enums, "RASCUNHO", name="status_vaga")
COLUNAS_PUBLICACAO = {
    "causa_id": sa.Integer(),
    "titulo": sa.String(150),
    "descricao": sa.Text(),
    "atividades": sa.Text(),
    "modalidade": sa.Enum("PRESENCIAL", "REMOTO", "HIBRIDO", name="modalidade_vaga"),
    "local": sa.String(500),
    "periodo": sa.Enum("MANHA", "TARDE", "NOITE", "MADRUGADA", name="periodo_vaga"),
    "carga_horaria": sa.Numeric(7, 2),
    "numero_vagas": sa.Integer(),
}


def upgrade() -> None:
    with op.batch_alter_table("vagas") as batch:
        batch.alter_column(
            "status",
            existing_type=STATUS_ANTERIOR,
            type_=STATUS_NOVO,
            existing_nullable=False,
        )
        for nome, tipo in COLUNAS_PUBLICACAO.items():
            batch.alter_column(nome, existing_type=tipo, nullable=True)
        batch.add_column(sa.Column("rascunho", sa.JSON(), nullable=True))
        batch.add_column(
            sa.Column("versao", sa.Integer(), nullable=False, server_default="1")
        )
        batch.add_column(sa.Column("criado_em", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("atualizado_em", sa.DateTime(), nullable=True))
        campos_presentes = " AND ".join(
            f"{nome} IS NOT NULL" for nome in COLUNAS_PUBLICACAO
        )
        batch.create_check_constraint(
            "ck_vagas_dados_publicados", f"status = 'RASCUNHO' OR ({campos_presentes})"
        )
        batch.create_index(
            "ix_vagas_organizacao_status_id", ["organizacao_id", "status", "id"]
        )


def downgrade() -> None:
    if op.get_bind().scalar(
        sa.text("SELECT id FROM vagas WHERE status='RASCUNHO' LIMIT 1")
    ):
        raise RuntimeError("A versão anterior não suporta os rascunhos existentes.")

    with op.batch_alter_table("vagas") as batch:
        batch.drop_constraint("ck_vagas_dados_publicados", type_="check")
        batch.drop_index("ix_vagas_organizacao_status_id")
        for nome, tipo in COLUNAS_PUBLICACAO.items():
            batch.alter_column(nome, existing_type=tipo, nullable=False)
        batch.alter_column(
            "status",
            existing_type=STATUS_NOVO,
            type_=STATUS_ANTERIOR,
            existing_nullable=False,
        )
        for nome in ("atualizado_em", "criado_em", "versao", "rascunho"):
            batch.drop_column(nome)
