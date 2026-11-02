import uvicorn
from fastapi import FastAPI

from router import router as auth_router
app = FastAPI(
    title="API - Módulo de Autenticação",
    version = "1.0.0",
    description="Imprementação da Iusse Must para emissão de JWT de 60min"
)

app.include_router(auth_router)

if __name__ == "__main__":
    print("[*] Inicializando o servidor FastAPI local na porta 800")
    uvicorn.run("main:app", host="127.0.0.1", port=8000)