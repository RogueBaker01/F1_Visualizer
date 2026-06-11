from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str,dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id:str):
        await websocket.accept()
        self.active_connections[client_id] = {
            "websocket":websocket,
            "task": None,
            "state": {
                "playing": False,
                "speed": 1.0,
                "current_time_ms": 0.0,
                "race_id": None
            }
        }
    def disconnect(self,client_id:str):
        if client_id in self.active_connections:
            task = self.active_connections[client_id]["task"]
            if task is not None:
                task.cancel()
            del self.active_connections[client_id]
    
    async def send_frame(self, data: dict, client_id: str):
        if client_id in self.active_connections:
            ws =  self.active_connections[client_id]["websocket"]
            await ws.send_json(data)
    
    def get_state(self, client_id: str) -> dict:
        return self.active_connections[client_id]["state"]
        
manager = ConnectionManager()