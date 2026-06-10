import asyncio
from app.connection import manager
from app.schemas import TelemetryFrame, DriverPosition

async def fetch_interpolated_positions(race_id:str, current_time_ms:int)-> list[DriverPosition]:
    # Mock implementation - replace with actual data fetching logic
    return [
        DriverPosition(driver_id="driver1", x=current_time_ms, y=0),
        DriverPosition(driver_id="driver2", x=current_time_ms, y=1),
    ]

async def run_simulation_loop(client_id:str):
    try:
        while True:
            state = manager.get_state(client_id)
            if state['playing'] and state['race_id']:
                positions= await fetch_interpolated_positions(
                    race_id = state['race_id'],
                    current_time_ms = state['current_time_ms']
                )
                frame = TelemetryFrame(                    
                    time_ms = state['current_time_ms'],
                    positions = positions
                )

                await manager.send_frame(frame.model_dump(),client_id)
                state['current_time_ms'] += int(100 * state['speed'])
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        pass
