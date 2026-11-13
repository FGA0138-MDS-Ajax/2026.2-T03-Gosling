from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class NaoAutenticadoError(Exception):
    def __init__(self, detail: str = "Sessão inválida ou expirada. Entre novamente."):
        self.detail = detail


class AcessoNegadoError(Exception):
    pass


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def invalid_request(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"detail": [
                {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
                for item in error.errors()
            ]},
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(NaoAutenticadoError)
    async def unauthorized(
        request: Request, error: NaoAutenticadoError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"detail": error.detail},
            headers={"WWW-Authenticate": "Bearer", "Cache-Control": "no-store"},
        )

    @app.exception_handler(AcessoNegadoError)
    async def forbidden(request: Request, error: AcessoNegadoError) -> JSONResponse:
        return JSONResponse(
            status_code=403,
            content={"detail": "Seu perfil não permite acessar este recurso."},
        )
