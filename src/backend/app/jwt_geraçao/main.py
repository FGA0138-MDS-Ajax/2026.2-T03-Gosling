from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.core.errors import register_error_handlers
from app.jwt_geraçao.router import router as jwt_router
from app.organizacoes.router import router as organizacoes_router
from app.usuarios.router import router as usuarios_router

app = FastAPI(title="VolunJá")

register_error_handlers(app)

app.include_router(jwt_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(organizacoes_router, prefix="/api/v1")
# Registamos os manipuladores de erro
register_error_handlers(app)

# Incluímos todos os routers na mesma aplicação principal
app.include_router(jwt_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
