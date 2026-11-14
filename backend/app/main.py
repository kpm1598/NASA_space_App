"""BLACKCAT backend entry point.

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .models.database import get_conn, init_db  # noqa: E402
from .routes.api import router  # noqa: E402

app = FastAPI(title="BLACKCAT - Multi-Satellite Fire Intelligence",
              version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def _startup():
    conn = get_conn()
    init_db(conn)
    conn.close()
