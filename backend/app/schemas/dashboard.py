from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_zones: int
    high_risk_alerts: int
    total_hectares: str
