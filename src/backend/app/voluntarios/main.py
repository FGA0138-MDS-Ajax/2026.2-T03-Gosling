from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from app.voluntarios.router import router as voluntarios_router

app = FastAPI(title="VolunJá API")

app.include_router(voluntarios_router)