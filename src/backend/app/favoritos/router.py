from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import require_perfil
from app.favoritos.repository import FavoritosRepository
from app.favoritos.schemas import SemParametros, VagasSalvasResponse
from app.favoritos.service import FavoritosService
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico
from app.vagas.repository import VagaRepository

router = APIRouter(prefix="/voluntarios/me/vagas-salvas", tags=["Vagas salvas"])
Titular = Annotated[UsuarioPublico, Depends(require_perfil(Perfil.VOLUNTARIO))]
Identificador = Annotated[int, Path(gt=0)]


def get_favoritos_service(
    session: Annotated[Session, Depends(get_db)],
) -> FavoritosService:
    return FavoritosService(FavoritosRepository(session), VagaRepository(session))


Servico = Annotated[FavoritosService, Depends(get_favoritos_service)]


@router.get("", response_model=VagasSalvasResponse)
def listar_vagas_salvas(
    usuario: Titular,
    service: Servico,
    parametros: Annotated[SemParametros, Query()],
) -> VagasSalvasResponse:
    return VagasSalvasResponse(vaga_ids=service.listar_ids(usuario.id))


@router.put("/{vaga_id}", status_code=204)
def salvar_vaga(
    vaga_id: Identificador,
    usuario: Titular,
    service: Servico,
    parametros: Annotated[SemParametros, Query()],
    dados: SemParametros | None = None,
) -> Response:
    service.salvar(usuario.id, vaga_id)
    return Response(status_code=204, headers={"Cache-Control": "no-store"})


@router.delete("/{vaga_id}", status_code=204)
def remover_vaga_salva(
    vaga_id: Identificador,
    usuario: Titular,
    service: Servico,
    parametros: Annotated[SemParametros, Query()],
    dados: SemParametros | None = None,
) -> Response:
    service.remover(usuario.id, vaga_id)
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
