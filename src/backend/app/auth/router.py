from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.auth.schemas import LoginRequest, LoginResponse, SessaoResponse
from app.auth.service import AuthService
from app.jwt_geraçao.dependencies import get_auth_service, get_sessao

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> LoginResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return auth.login(str(payload.email), payload.senha.get_secret_value())


@router.get("/me", response_model=SessaoResponse)
def me(
    response: Response,
    sessao: Annotated[SessaoResponse, Depends(get_sessao)],
) -> SessaoResponse:
    response.headers["Cache-Control"] = "no-store"
    return sessao
