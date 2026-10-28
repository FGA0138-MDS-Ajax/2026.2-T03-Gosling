from fastapi import FastAPI

app = FastAPI(title="VolunJá")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
