import asyncio
import json
import os
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.connection import manager
from app.simulation import run_simulation_loop, get_race_meta, get_race_bounds
from app.schemas import ClientCommand
from pydantic import ValidationError

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
_redis = aioredis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

app = FastAPI(title="F1 Visualizer - Streaming service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/races")
async def list_races():
    """Returns all race IDs that have been loaded into Redis."""
    keys = [key async for key in _redis.scan_iter("race:*:meta")]
    races = []
    for key in keys:
        race_id = key.split(":")[1]
        raw = await _redis.get(key)
        if raw:
            meta = json.loads(raw)
            races.append({
                "race_id": race_id,
                "total_laps": meta.get("total_laps"),
                "race_start_ms": meta.get("race_start_ms"),
            })
    return {"races": races}


@app.websocket("/websocket/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            raw_payload = await websocket.receive_json()

            try:
                command = ClientCommand(**raw_payload)
            except ValidationError as e:
                await websocket.send_json({"error": "Invalid command", "details": e.errors()})
                continue

            action = command.action
            state = manager.get_state(client_id)

            if action == "load_race":
                race_id = command.race_id
                state["race_id"] = race_id
                state["playing"] = False

                # Load meta (circuit path, race start, total laps)
                meta = await get_race_meta(race_id)
                bounds = await get_race_bounds(race_id)

                race_start_ms = meta.get("race_start_ms", bounds["min_ms"])
                state["current_time_ms"] = race_start_ms
                state["last_time_ms"] = race_start_ms

                # Send meta to client so it can draw the circuit
                await websocket.send_json({
                    "type": "meta",
                    "race_id": race_id,
                    "race_start_ms": race_start_ms,
                    "total_laps": meta.get("total_laps", 57),
                    "circuit_path": meta.get("circuit_path", []),
                    "min_ms": bounds["min_ms"],
                    "max_ms": bounds["max_ms"],
                })

            if manager.active_connections[client_id]["task"] is None:
                task = asyncio.create_task(run_simulation_loop(client_id))
                manager.active_connections[client_id]["task"] = task

            if action == "play":
                state["playing"] = True

            if action == "pause":
                state["playing"] = False

            if action == "speed":
                state["speed"] = float(command.value or 1.0)

            if action == "seek":
                new_t = int(command.time_ms or 0)
                state["current_time_ms"] = new_t
                state["last_time_ms"] = new_t

    except WebSocketDisconnect:
        manager.disconnect(client_id)
