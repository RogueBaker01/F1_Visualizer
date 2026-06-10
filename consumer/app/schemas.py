from pydantic import BaseModel, Field
from typing import Literal, List, Optional

class ClientCommand(BaseModel):
    action: Literal["load_race","play","pause","speed","seek"]
    race_id: Optional[str] =  Field(None)
    value: Optional[float] = Field(None)
    time_ms: Optional[int] = Field(None)

class DriverPosition(BaseModel):
    driver_id: str
    x: float
    y: float

class TelemetryFrame(BaseModel):
    type: Literal["telemetry"] = "telemetry"
    time_ms: int
    positions: List[DriverPosition]