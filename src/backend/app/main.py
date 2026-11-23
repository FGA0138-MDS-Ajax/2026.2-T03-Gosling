import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from app.admin.router import router as admin_router

from app.auth.router import router as auth_router
from app.candidaturas.router import router as candidaturas_router
from app.core.errors import register_error_handlers
from app.core.limpeza_midia import limpar_midias_periodicamente
from app.core.midia import router as midia_router
from app.usuarios.router import router as usuarios_router
from app.usuarios.voluntarios import router as voluntarios_router
from app.vagas.router import router as vagas_router
from app.organizacoes.router import router as organizacoes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    limpeza = asyncio.create_task(limpar_midias_periodicamente())
    try:
        yield
    finally:
        limpeza.cancel()
        with suppress(asyncio.CancelledError):
            await limpeza


app = FastAPI(title="VolunJá", lifespan=lifespan)
register_error_handlers(app)
app.include_router(admin_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(candidaturas_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(voluntarios_router, prefix="/api/v1")
app.include_router(vagas_router, prefix="/api/v1")
app.include_router(midia_router, prefix="/api/v1")

app.include_router(organizacoes_router, prefix="/api/v1")

@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
