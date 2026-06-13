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
    """Fetches the telemetry frame for current_time_ms with linear interpolation.

    Looks up the two bounding frames (prev ≤ t < next) and interpolates
    each driver's x/y position.  Falls back to the nearest frame if only
    one bound exists (start / end of race).
    """
    index_key = f"race:{race_id}:index"

    # -- Frame at or before t --
    prev_results = await redis_client.zrevrangebyscore(
        index_key, max=current_time_ms, min=0, start=0, num=1,
    )
    # -- Frame strictly after t --
    next_results = await redis_client.zrangebyscore(
        index_key, min=f"({current_time_ms}", max="+inf", start=0, num=1,
    )

    if not prev_results and not next_results:
        return []

    # Only one bound available → no interpolation possible
    if not prev_results:
        raw = await redis_client.get(f"race:{race_id}:frame={next_results[0]}")
        return [DriverPosition(**p) for p in json.loads(raw)] if raw else []
    if not next_results:
        raw = await redis_client.get(f"race:{race_id}:frame={prev_results[0]}")
        return [DriverPosition(**p) for p in json.loads(raw)] if raw else []

    t_prev = int(prev_results[0])
    t_next = int(next_results[0])

    # Exact match — skip interpolation entirely
    if t_prev == current_time_ms:
        raw = await redis_client.get(f"race:{race_id}:frame={t_prev}")
        return [DriverPosition(**p) for p in json.loads(raw)] if raw else []

    raw_prev, raw_next = await asyncio.gather(
        redis_client.get(f"race:{race_id}:frame={t_prev}"),
        redis_client.get(f"race:{race_id}:frame={t_next}"),
    )
    if not raw_prev:
        return [DriverPosition(**p) for p in json.loads(raw_next)] if raw_next else []
    if not raw_next:
        return [DriverPosition(**p) for p in json.loads(raw_prev)]

    frame_prev: dict[str, dict] = {p["driver_id"]: p for p in json.loads(raw_prev)}
    frame_next: dict[str, dict] = {p["driver_id"]: p for p in json.loads(raw_next)}

    span = t_next - t_prev
    alpha = (current_time_ms - t_prev) / span  # 0.0 → 1.0

    interpolated: list[DriverPosition] = []
    for driver_id, prev_pos in frame_prev.items():
        if driver_id in frame_next:
            next_pos = frame_next[driver_id]
            interpolated.append(DriverPosition(
                driver_id=driver_id,
                x=prev_pos["x"] + (next_pos["x"] - prev_pos["x"]) * alpha,
                y=prev_pos["y"] + (next_pos["y"] - prev_pos["y"]) * alpha,
            ))
        else:
            # Driver has disappeared (DNF etc.) — keep last known position
            interpolated.append(DriverPosition(**prev_pos))

    return interpolated


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
