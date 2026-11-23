from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.causas.repository import CausaRepository
from app.causas.schemas import CausaCatalogo
from app.causas.service import CatalogoService
from app.core.database import get_db

router = APIRouter(prefix="/causas", tags=["Catálogo de causas"])


@router.get("", response_model=list[CausaCatalogo])
def listar_causas(
    session: Annotated[Session, Depends(get_db)],
    incluir_inativas: bool = False,
):
    return CatalogoService(CausaRepository(session)).listar(incluir_inativas)
