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
        pattern = f"race:{race_id}:frame=*"
        keys = [key async for key in redis_client.scan_iter(pattern)]
        if not keys:
            return []

        timestamps = []
        for key in keys:
            try:
                ts = int(key.split("frame=")[-1])
                timestamps.append(ts)
            except ValueError:
                continue

        valid = [ts for ts in timestamps if ts <= current_time_ms]
        if not valid:
            return []

        nearest_ts = max(valid)
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
