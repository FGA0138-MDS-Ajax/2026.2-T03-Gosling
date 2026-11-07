from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.core.errors import register_error_handlers
from app.usuarios.router import router as usuarios_router
from app.jwt_geraçao.router import router as jwt_router  # Sem cedilha

# Criamos a aplicação apenas uma vez com todas as configurações
app = FastAPI(title="VolunJá")

# Registamos os manipuladores de erro
register_error_handlers(app)

# Incluímos todos os routers na mesma aplicação principal
app.include_router(jwt_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
