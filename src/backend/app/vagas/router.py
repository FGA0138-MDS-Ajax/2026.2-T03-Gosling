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
from app.core.midia import MidiaResponse, confirmar_upload, salvar_imagem, salvar_modelo
from app.dependencies import require_perfil
from app.midias.models import UsoMidia
from app.usuarios.enums import Perfil
from app.usuarios.schemas import UsuarioPublico
from app.vagas.enums import Modalidade, Periodo
from app.vagas.rascunhos import (
    AtualizarRascunhoRequest,
    DadosRascunho,
    PublicarRascunhoRequest,
    RascunhoResponse,
)
from app.vagas.repository import VagaRepository
from app.vagas.schemas import (
    AtualizarVagaRequest,
    CadastroVagaRequest,
    ListaVagasResponse,
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
    causa_id: Annotated[int | None, Query(gt=0)] = None,
    modalidade: Modalidade | None = None,
    periodo: Periodo | None = None,
) -> ListaVagasResponse:
    return service.listar(
        pagina,
        por_pagina,
        causa=causa,
        causa_id=causa_id,
        modalidade=modalidade,
        periodo=periodo,
    )


@router.post("", response_model=VagaPublica, status_code=status.HTTP_201_CREATED)
def publicar_vaga(
    dados: CadastroVagaRequest,
    usuario: Annotated[UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))],
    service: Annotated[VagaService, Depends(get_vaga_service)],
) -> VagaPublica:
    return service.publicar(usuario.id, dados)


TitularOrganizacao = Annotated[
    UsuarioPublico, Depends(require_perfil(Perfil.ORGANIZACAO))
]
ServicoVagas = Annotated[VagaService, Depends(get_vaga_service)]
IdVaga = Annotated[int, Path(gt=0)]


@router.post("/rascunhos", response_model=RascunhoResponse, status_code=201)
def criar_rascunho(
    dados: DadosRascunho,
    response: Response,
    usuario: TitularOrganizacao,
    service: ServicoVagas,
) -> RascunhoResponse:
    response.headers["Cache-Control"] = "no-store"
    return service.criar_rascunho(usuario.id, dados)


@router.get("/rascunhos/{vaga_id}", response_model=RascunhoResponse)
def consultar_rascunho(
    vaga_id: IdVaga,
    response: Response,
    usuario: TitularOrganizacao,
    service: ServicoVagas,
) -> RascunhoResponse:
    response.headers["Cache-Control"] = "no-store"
    return service.consultar_rascunho(usuario.id, vaga_id)


@router.patch("/rascunhos/{vaga_id}", response_model=RascunhoResponse)
def atualizar_rascunho(
    vaga_id: IdVaga,
    dados: AtualizarRascunhoRequest,
    response: Response,
    usuario: TitularOrganizacao,
    service: ServicoVagas,
) -> RascunhoResponse:
    response.headers["Cache-Control"] = "no-store"
    return service.atualizar_rascunho(usuario.id, vaga_id, dados)


@router.post("/rascunhos/{vaga_id}/publicar", response_model=VagaPublica)
def publicar_rascunho(
    vaga_id: IdVaga,
    dados: PublicarRascunhoRequest,
    usuario: TitularOrganizacao,
    service: ServicoVagas,
) -> VagaPublica:
    return service.publicar_rascunho(usuario.id, vaga_id, dados)


@router.get("/{vaga_id}", response_model=VagaPublica)
def detalhar_vaga(
    vaga_id: Annotated[int, Path(gt=0)],
    service: Annotated[VagaService, Depends(get_vaga_service)],
) -> VagaPublica:
    return service.detalhar(vaga_id)


@router.post("/fotos", status_code=201, response_model=MidiaResponse)
async def enviar_foto(
    request: Request,
    usuario: TitularOrganizacao,
    service: ServicoVagas,
) -> MidiaResponse:
    service.validar_autor_rascunho(usuario.id)
    db = service.repository.session
    arquivo = await salvar_imagem(request, db, usuario.id, UsoMidia.FOTO_VAGA)
    return confirmar_upload(db, arquivo)


@router.post("/modelos-termo", status_code=201, response_model=MidiaResponse)
async def enviar_modelo_termo(
    request: Request,
    usuario: TitularOrganizacao,
    service: ServicoVagas,
    nome: Annotated[str, Query(min_length=1, max_length=255)],
) -> MidiaResponse:
    service.validar_autor_rascunho(usuario.id)
    db = service.repository.session
    arquivo = await salvar_modelo(request, db, usuario.id, nome)
    return confirmar_upload(db, arquivo)


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
