from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.favoritos.models import VagaSalva
from app.usuarios.models import Organizacao
from app.vagas.enums import StatusVaga
from app.vagas.models import Vaga


class FavoritosRepository:
    def __init__(self, session: Session):
        self.session = session

    def listar_ids_visiveis(self, voluntario_id: int) -> list[int]:
        return list(
            self.session.scalars(
                select(VagaSalva.vaga_id)
                .join(Vaga, Vaga.id == VagaSalva.vaga_id)
                .join(Organizacao, Organizacao.id == Vaga.organizacao_id)
                .where(
                    VagaSalva.voluntario_id == voluntario_id,
                    Vaga.status == StatusVaga.ABERTA,
                    Organizacao.ativo.is_(True),
                    Organizacao.homologada.is_(True),
                )
                .order_by(VagaSalva.vaga_id)
            )
        )

    def salvar(self, voluntario_id: int, vaga_id: int) -> None:
        try:
            try:
                with self.session.begin_nested():
                    self.session.add(
                        VagaSalva(
                            voluntario_id=voluntario_id,
                            vaga_id=vaga_id,
                        )
                    )
                    self.session.flush()
            except IntegrityError:
                # Leitura atual: inclui uma gravação concorrente já confirmada.
                existente = self.session.scalar(
                    select(VagaSalva)
                    .where(
                        VagaSalva.voluntario_id == voluntario_id,
                        VagaSalva.vaga_id == vaga_id,
                    )
                    .with_for_update()
                )
                if existente is None:
                    raise
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

    def remover(self, voluntario_id: int, vaga_id: int) -> None:
        try:
            self.session.execute(
                delete(VagaSalva).where(
                    VagaSalva.voluntario_id == voluntario_id,
                    VagaSalva.vaga_id == vaga_id,
                )
            )
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise
