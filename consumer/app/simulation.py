import asyncio
import json
import os
import redis.asyncio as aioredis
from app.connection import manager
from app.schemas import TelemetryFrame, DriverPosition

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
redis_client = aioredis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

async def fetch_frame_from_redis(race_id: str, current_time_ms: int) -> list[DriverPosition]:
    exact_key = f"race:{race_id}:frame={current_time_ms}"
    raw = await redis_client.get(exact_key)

    if raw is None:
        # Use sorted set index for O(log n) nearest-frame lookup instead of scan
        index_key = f"race:{race_id}:index"
        results = await redis_client.zrevrangebyscore(
            index_key,
            max=current_time_ms,
            min=0,
            start=0,
            num=1,
        )
        if not results:
            return []
        nearest_ts = results[0]
        raw = await redis_client.get(f"race:{race_id}:frame={nearest_ts}")

    if raw is None:
        return []

    positions_data = json.loads(raw)
    return [
        DriverPosition(
            driver_id=p["driver_id"],
            x=p["x"],
            y=p["y"],
        )
        for p in positions_data
    ]


async def get_race_bounds(race_id: str) -> dict:
    """Returns the first and last available timestamps for a race."""
    index_key = f"race:{race_id}:index"
    first = await redis_client.zrange(index_key, 0, 0)
    last = await redis_client.zrange(index_key, -1, -1)
    return {
        "min_ms": int(first[0]) if first else 0,
        "max_ms": int(last[0]) if last else 0,
    }


async def run_simulation_loop(client_id: str):
    try:
        while True:
            state = manager.get_state(client_id)
            if state["playing"] and state["race_id"]:
                positions = await fetch_frame_from_redis(
                    race_id=state["race_id"],
                    current_time_ms=state["current_time_ms"],
                )
                frame = TelemetryFrame(
                    time_ms=state["current_time_ms"],
                    positions=positions,
                )
                await manager.send_frame(frame.model_dump(), client_id)
                state["current_time_ms"] += int(100 * state["speed"])
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        pass
