from io import BytesIO
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.candidaturas.models import Candidatura


def codigo_comprovante(candidatura: Candidatura) -> str:
    return f"VJ-{candidatura.id:08d}"


def gerar_comprovante(candidatura: Candidatura, nome_voluntario: str) -> bytes:
    saida = BytesIO()
    estilos = getSampleStyleSheet()
    documento = SimpleDocTemplate(saida, title="Comprovante de candidatura | VolunJá")
    data = candidatura.criado_em.astimezone(ZoneInfo("America/Sao_Paulo"))
    campos = [
        ("Código", codigo_comprovante(candidatura)),
        ("Voluntário", nome_voluntario),
        ("Vaga", candidatura.vaga.titulo),
        ("Organização", candidatura.vaga.organizacao.nome),
        ("Data do registro", data.strftime("%d/%m/%Y às %H:%M (Brasília)")),
    ]
    conteudo = [
        Paragraph("Comprovante de candidatura", estilos["Title"]),
        Spacer(1, 18),
        *[
            Paragraph(f"<b>{rotulo}:</b> {escape(valor)}", estilos["BodyText"])
            for rotulo, valor in campos
        ],
        Spacer(1, 12),
        Paragraph(
            "Este comprovante confirma o registro da candidatura.",
            estilos["BodyText"],
        ),
    ]
    documento.build(conteudo)
    return saida.getvalue()
