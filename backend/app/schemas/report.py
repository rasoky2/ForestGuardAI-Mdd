from pydantic import BaseModel, field_serializer
from datetime import datetime

class ReportCreate(BaseModel):
    sector: str
    risk: str

class ReportResponse(BaseModel):
    id: str
    sector: str
    risk: str
    created_at: datetime
    date: str = ""

    class Config:
        from_attributes = True

    @field_serializer('date', check_fields=False)
    def serialize_date(self, v: str, info) -> str:
        # Formatear la fecha como "27 May 2026"
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        dt = self.created_at
        month_str = months[dt.month - 1]
        return f"{dt.day} {month_str} {dt.year}"
