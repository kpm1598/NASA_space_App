"""BLACKCAT backend entry point.

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
import os
import threading

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .models.database import get_conn, init_db  # noqa: E402
from .routes.api import SAMPLES_DIR, _ingest_records, router  # noqa: E402
from .services import ingestion  # noqa: E402

app = FastAPI(title="BLACKCAT - Multi-Satellite Fire Intelligence",
              version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Hackathon demo build: the frontend may be opened from localhost, a
    # LAN address (phone on the same Wi-Fi) or a tunnel URL (phone on a
    # different network), so any origin is allowed. The API holds no
    # credentials, cookies or user accounts. For a production deployment,
    # restrict this list to the real frontend origin.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


def _autofill_samples():
    """Load the bundled FIRMS dataset into an empty database.

    Hosted deployments (e.g. a free-tier web service) start with an
    empty, ephemeral database file. When BLACKCAT_AUTOFILL_SAMPLES=1 is
    set, the bundled sample dataset is ingested once in the background
    so the public demo is populated without a manual ingest click.
    Local runs leave the variable unset and are unaffected.
    """
    try:
        files = sorted(p for p in SAMPLES_DIR.glob("*")
                       if p.suffix.lower() in (".csv", ".json", ".geojson"))
        if not files:
            print("[autofill] no sample files found; skipping")
            return
        records = []
        for f in files:
            records.extend(ingestion.load_path(f))
        prov_file = SAMPLES_DIR / "DATA_PROVENANCE.txt"
        provenance = (prov_file.read_text().strip() if prov_file.exists()
                      else "Sample data bundled with the application")
        conn = get_conn()
        result = _ingest_records(conn, records, provenance)
        conn.close()
        print(f"[autofill] ingested {result.get('ingested')} observations "
              f"from {len(files)} sample file(s)")
    except Exception as exc:  # never let autofill break startup
        print(f"[autofill] failed: {exc}")


@app.on_event("startup")
def _startup():
    conn = get_conn()
    init_db(conn)
    n = conn.execute("SELECT COUNT(*) c FROM observations").fetchone()["c"]
    conn.close()
    if n == 0 and os.environ.get("BLACKCAT_AUTOFILL_SAMPLES") == "1":
        threading.Thread(target=_autofill_samples, daemon=True).start()
