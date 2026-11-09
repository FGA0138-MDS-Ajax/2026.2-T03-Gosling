from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.core.errors import register_error_handlers
from app.usuarios.router import router as usuarios_router
from app.vagas.router import router as vagas_router

app = FastAPI(title="VolunJá")
register_error_handlers(app)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(vagas_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
