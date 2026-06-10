import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from app.connection import ConnectionManager

app = FastAPI(title="F1 Visualzer - Streaming service")
manager = ConnectionManager()

async def simulation_loop(client_id:str):
    try:
        while True:
            state = manager.get_state(client_id)
            if state["playing"]:
                frame_data = {
                "type": "telemetry",
                "time_ms": state["current_time_ms"],
                "positions": []
                }
                await manager.send_frame(frame_data,client_id)

                state["current_time_ms"] += int(100 * state["speed"])
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        pass

@app.websocket("/websocket/{client_id}")
async def websocket_endpoint(websocket:WebSocket,client_id:str):
    await manager.connect(websocket,client_id)
    try:
        while True:
            payload = await websocket.receive_json()
            action = payload.get("action")
            state = manager.get_state(client_id)

            if action == "load_race":
                state["race_id"] = payload.get("race_id")
                state["current_time_ms"] = 0.0
                state["playing"] = False
            
            if manager.active_connections[client_id]["task"] is None:
                task = asyncio.create_task(simulation_loop(client_id))
                manager.active_connections[client_id]["task"] = task

            if action == "play":
                state["playing"] = True
            
            if action == "pause":
                state["playing"] = False

            if action == "speed":
                state["speed"] = float(payload.get("value",1.0))

            if action == "seek":
                state["current_time_ms"] = float(payload.get("value",0.0))
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        
                
                
                

            
            