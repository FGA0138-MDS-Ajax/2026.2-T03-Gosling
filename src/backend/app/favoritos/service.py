from fastapi import HTTPException

from app.favoritos.repository import FavoritosRepository
from app.vagas.repository import VagaRepository


class FavoritosService:
    def __init__(self, repository: FavoritosRepository, vagas: VagaRepository):
        self.repository = repository
        self.vagas = vagas

    def listar_ids(self, voluntario_id: int) -> list[int]:
        return self.repository.listar_ids_visiveis(voluntario_id)

    def salvar(self, voluntario_id: int, vaga_id: int) -> None:
        if self.vagas.buscar_publica(vaga_id) is None:
            raise HTTPException(404, "Vaga não encontrada ou indisponível.")
        self.repository.salvar(voluntario_id, vaga_id)

    def remover(self, voluntario_id: int, vaga_id: int) -> None:
        self.repository.remover(voluntario_id, vaga_id)
