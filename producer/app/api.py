import threading
import redis as sync_redis
import os
import json
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from app.main import run_pipeline

app = FastAPI(title="F1 Producer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
_redis = sync_redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

# In-memory job status: {race_id: {status, message, progress}}
_jobs: dict = {}


def _run_pipeline_thread(year: int, round_num: int, race_id: str):
    """Runs the full pipeline in a background thread and updates _jobs."""
    try:
        _jobs[race_id] = {"status": "loading", "message": "Descargando datos de FastF1…"}
        run_pipeline(year, round_num, race_id)
        _jobs[race_id] = {"status": "done", "message": "✓ Cargado correctamente"}
    except Exception as e:
        _jobs[race_id] = {"status": "error", "message": str(e)}


@app.post("/load-race")
def load_race(year: int, round: int, race_id: str):
    """Triggers an async pipeline load for the given race."""
    # Idempotency: don't reload if already loading
    current = _jobs.get(race_id, {})
    if current.get("status") == "loading":
        return {"status": "loading", "message": "Ya está cargando…"}

    # Check if already in Redis
    if _redis.exists(f"race:{race_id}:meta"):
        return {"status": "done", "message": "Ya disponible en Redis"}

    _jobs[race_id] = {"status": "loading", "message": "Iniciando pipeline…"}
    t = threading.Thread(target=_run_pipeline_thread, args=(year, round, race_id), daemon=True)
    t.start()
    return {"status": "loading", "message": "Pipeline iniciado"}


@app.get("/status/{race_id}")
def get_status(race_id: str):
    """Returns current load status for a race_id."""
    # If job tracking has it, return that
    if race_id in _jobs:
        return _jobs[race_id]
    # Otherwise check Redis directly
    if _redis.exists(f"race:{race_id}:meta"):
        return {"status": "done", "message": "Disponible en Redis"}
    return {"status": "unknown", "message": "No cargado"}


@app.get("/health")
def health():
    return {"status": "ok"}
