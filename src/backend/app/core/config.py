import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError("Configure JWT_SECRET_KEY com pelo menos 32 bytes.")
    return secret


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("Configure DATABASE_URL.")
    return database_url
