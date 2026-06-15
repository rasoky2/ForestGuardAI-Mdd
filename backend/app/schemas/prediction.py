from pydantic import BaseModel
from datetime import datetime

class PredictionRequest(BaseModel):
    sector: str

class PredictionResponse(BaseModel):
    id: int
    sector: str
    risk: int
    level: str
    evidence_deforestation: int
    evidence_roads: int
    created_at: datetime

    class Config:
        from_attributes = True
