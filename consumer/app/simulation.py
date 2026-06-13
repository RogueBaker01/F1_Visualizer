import asyncio
import json
import os
import redis.asyncio as aioredis
from app.connection import manager
from app.schemas import TelemetryFrame, DriverPosition

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
redis_client = aioredis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)


# ── Meta ──────────────────────────────────────────────────────────────────────

async def get_race_meta(race_id: str) -> dict:
    raw = await redis_client.get(f"race:{race_id}:meta")
    return json.loads(raw) if raw else {}


async def get_race_bounds(race_id: str) -> dict:
    index_key = f"race:{race_id}:index"
    first = await redis_client.zrange(index_key, 0, 0)
    last = await redis_client.zrange(index_key, -1, -1)
    return {
        "min_ms": int(first[0]) if first else 0,
        "max_ms": int(last[0]) if last else 0,
    }


# ── Telemetry frame ───────────────────────────────────────────────────────────

async def fetch_frame_from_redis(race_id: str, current_time_ms: int) -> list[DriverPosition]:
    exact_key = f"race:{race_id}:frame={current_time_ms}"
    raw = await redis_client.get(exact_key)

    if raw is None:
        index_key = f"race:{race_id}:index"
        results = await redis_client.zrevrangebyscore(
            index_key, max=current_time_ms, min=0, start=0, num=1,
        )
        if not results:
            return []
        raw = await redis_client.get(f"race:{race_id}:frame={results[0]}")

    if raw is None:
        return []

    return [DriverPosition(**p) for p in json.loads(raw)]


# ── Race positions ────────────────────────────────────────────────────────────

async def get_race_positions(race_id: str, current_time_ms: int) -> dict:
    """Returns {driver_num: {pos, lap}} from nearest position snapshot.
    Falls forward to the first snapshot if none exists before current_time.
    """
    index_key = f"race:{race_id}:snap:index"

    # Look backwards first (most common case)
    results = await redis_client.zrevrangebyscore(
        index_key, max=current_time_ms, min=0, start=0, num=1,
    )

    # If nothing behind us, grab the first snapshot available (fall-forward)
    if not results:
        results = await redis_client.zrange(index_key, 0, 0)

    if not results:
        return {}

    raw = await redis_client.get(f"race:{race_id}:snap:{results[0]}")
    return json.loads(raw) if raw else {}


# ── Events ────────────────────────────────────────────────────────────────────

async def get_events_in_range(race_id: str, from_ms: int, to_ms: int) -> list[dict]:
    """Returns events with time_ms in (from_ms, to_ms]."""
    if from_ms >= to_ms:
        return []
    results = await redis_client.zrangebyscore(
        f"race:{race_id}:events",
        min=f"({from_ms}",
        max=to_ms,
    )
    return [json.loads(r) for r in results]


# ── Simulation loop ───────────────────────────────────────────────────────────

async def run_simulation_loop(client_id: str):
    try:
        while True:
            state = manager.get_state(client_id)

            if state["playing"] and state["race_id"]:
                race_id = state["race_id"]
                t = state["current_time_ms"]
                last_t = state.get("last_time_ms", t - 100)

                positions = await fetch_frame_from_redis(race_id, t)
                race_positions = await get_race_positions(race_id, t)
                events = await get_events_in_range(race_id, last_t, t)

                frame = {
                    "type": "telemetry",
                    "time_ms": t,
                    "positions": [p.model_dump() for p in positions],
                    "race_positions": race_positions,
                    "events": events,
                }
                await manager.send_frame(frame, client_id)

                state["last_time_ms"] = t
                state["current_time_ms"] = t + int(100 * state["speed"])

            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        pass
