from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

app = FastAPI(title="PJDSC Dengue Forecast and Simulation API", version="0.1.0")

class SimulationInput(BaseModel):
    area: Literal["NCR", "QUEZON_CITY"]
    forecast_run_id: str
    surge_multiplier: float = Field(default=1, ge=1, le=3)
    hospitalization_rate: float = Field(default=.15, ge=0, le=1)
    length_of_stay_days: int = Field(default=4, ge=1, le=30)
    baseline_occupancy: float = Field(default=.75, ge=0, le=1)

@app.get("/health")
def health():
    return {"status": "ok", "stage": "foundation"}

@app.post("/simulate")
def simulate(params: SimulationInput):
    raise HTTPException(status_code=503, detail="Requires verified dated case forecasts and facility capacities. No synthetic predictions will be substituted.")
