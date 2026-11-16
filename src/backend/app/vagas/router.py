from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.midia import salvar_imagem
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico
from app.vagas.enums import Modalidade, Periodo
from app.vagas.repository import VagaRepository
from app.vagas.schemas import CadastroVagaRequest, ListaVagasResponse, VagaPublica
from app.vagas.service import VagaService

router = APIRouter(prefix="/vagas", tags=["Vagas"])


def get_vaga_service(
    session: Annotated[Session, Depends(get_db)],
) -> VagaService:
    return VagaService(VagaRepository(session))


@router.get("", response_model=ListaVagasResponse)
def listar_vagas(
    service: Annotated[VagaService, Depends(get_vaga_service)],
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
    causa: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    modalidade: Modalidade | None = None,
    periodo: Periodo | None = None,
) -> ListaVagasResponse:
    return service.listar(
        pagina, por_pagina, causa=causa, modalidade=modalidade, periodo=periodo
    )


@router.post("", response_model=VagaPublica, status_code=201)
def publicar_vaga(
    dados: CadastroVagaRequest,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[VagaService, Depends(get_vaga_service)],
) -> VagaPublica:
    return service.publicar(usuario.id, dados)


@router.get("/{vaga_id}", response_model=VagaPublica)
def detalhar_vaga(
    vaga_id: Annotated[int, Path(gt=0)],
    service: Annotated[VagaService, Depends(get_vaga_service)],
) -> VagaPublica:
    return service.detalhar(vaga_id)


@router.post("/fotos", status_code=201)
async def enviar_foto(
    request: Request,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[VagaService, Depends(get_vaga_service)],
):
    service.validar_publicador(usuario.id)
    return {"url": await salvar_imagem(request)}
