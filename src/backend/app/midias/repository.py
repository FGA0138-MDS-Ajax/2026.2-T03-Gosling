from sqlalchemy import select
from sqlalchemy.orm import Session

from app.midias.models import ArquivoMidia, MidiaVaga, UsoMidia
from app.usuarios.models import Organizacao, Voluntario
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga


def arquivo_publicado(db: Session, midia: ArquivoMidia) -> bool:
    if midia.uso == UsoMidia.AVATAR:
        return (
            db.scalar(
                select(Voluntario.id).where(
                    Voluntario.id == midia.titular_id,
                    Voluntario.ativo.is_(True),
                    Voluntario.foto_url == midia.url,
                )
            )
            is not None
        )

    return (
        db.scalar(
            select(MidiaVaga.vaga_id)
            .join(Vaga, Vaga.id == MidiaVaga.vaga_id)
            .join(Vaga.organizacao)
            .where(
                MidiaVaga.arquivo == midia.arquivo,
                Vaga.status == StatusVaga.ABERTA,
                Organizacao.ativo.is_(True),
                Organizacao.homologada.is_(True),
            )
            .limit(1)
        )
        is not None
    )


def urls_referenciadas(db: Session) -> set[str]:
    referenciadas = set(db.scalars(select(Voluntario.foto_url)))
    for fotos in db.scalars(select(Vaga.fotos)):
        referenciadas.update(fotos or [])
    for documentos in db.scalars(select(Vaga.documentos_exigidos)):
        referenciadas.update(doc.get("modelo_url") for doc in documentos or [])
    for dados in db.scalars(select(Vaga.rascunho).where(Vaga.rascunho.is_not(None))):
        referenciadas.update(dados.get("fotos", []))
        referenciadas.update(
            doc.get("modelo_url") for doc in dados.get("documentos_exigidos", [])
        )
    referenciadas.discard(None)
    return referenciadas
