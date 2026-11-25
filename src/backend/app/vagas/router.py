from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.midia import salvar_imagem
from app.dependencies import require_perfil
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico
from app.vagas.enums import Modalidade, Periodo
from app.vagas.repository import VagaRepository
from app.vagas.schemas import (
    AtualizarVagaRequest,
    CadastroVagaRequest,
    ListaVagasResponse,
    VagaInstitucional,
    VagaPublica,
)
from app.vagas.service import (
    AcessoNegadoVagaException,
    AlteracaoHorarioNaoPermitidaException,
    VagaNaoEncontradaException,
    VagaService,
)

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


@router.post("", response_model=VagaPublica, status_code=status.HTTP_201_CREATED)
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


@router.get("/{vaga_id}/gestao", response_model=VagaInstitucional)
def detalhar_para_edicao(
    vaga_id: str,
    response: Response,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[VagaService, Depends(get_vaga_service)],
):
    try:
        resultado = service.detalhar_para_edicao(vaga_id, str(usuario.id))
    except VagaNaoEncontradaException as e:
        raise HTTPException(404, detail=str(e)) from e
    except AcessoNegadoVagaException as e:
        raise HTTPException(403, detail=str(e)) from e
    response.headers["Cache-Control"] = "no-store"
    return resultado


@router.put(
    "/{vaga_id}",
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados ou estado da vaga (Issue #32)",
)
def atualizar_vaga(
    vaga_id: str,
    dados: AtualizarVagaRequest,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[VagaService, Depends(get_vaga_service)],
):
    try:
        return service.atualizar_vaga(
            vaga_id=vaga_id,
            organizacao_id=str(usuario.id),
            dados=dados,
        )
    except VagaNaoEncontradaException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AcessoNegadoVagaException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except AlteracaoHorarioNaoPermitidaException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
