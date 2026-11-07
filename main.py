from fastapi import FastAPI
from voluntarios.router import router as voluntarios_router
from dotenv import load_dotenv
app = FastAPI(title="VolunJá API")

load_dotenv()

app.include_router(voluntarios_router)