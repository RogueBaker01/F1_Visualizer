import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from app.connection import manager
from app.simulation import run_simulation_loop, get_race_bounds
from app.schemas import ClientCommand
from pydantic import ValidationError

app = FastAPI(title="F1 Visualizer - Streaming service")

@app.websocket("/websocket/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            raw_payload = await websocket.receive_json()

            try:
                command = ClientCommand(**raw_payload)
            except ValidationError as e:
                await websocket.send_json({"error": "Invalid command payload", "details": e.errors()})
                continue

            action = command.action
            state = manager.get_state(client_id)

            if action == "load_race":
                race_id = command.race_id
                state["race_id"] = race_id
                state["playing"] = False

                # Start from the first real frame, not t=0
                bounds = await get_race_bounds(race_id)
                state["current_time_ms"] = bounds["min_ms"]

                # Inform the client of the race time range
                await websocket.send_json({
                    "type": "race_info",
                    "race_id": race_id,
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
                state["current_time_ms"] = int(command.time_ms or 0)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
