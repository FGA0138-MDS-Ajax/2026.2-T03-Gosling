from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.core.errors import register_error_handlers
from app.usuarios.router import router as usuarios_router
from fastapi import FastAPI
from app.jwt_geraçao.router import router as jwt_router

app = FastAPI()

# É aqui que o router é ativado na aplicação principal!
app.include_router(jwt_router, prefix="/jwt")
app = FastAPI(title="VolunJá")
register_error_handlers(app)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
