import datetime
from sqlalchemy import Column, String, DateTime
from app.database import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True) # e.g. REP-042
    sector = Column(String, nullable=False)
    risk = Column(String, nullable=False) # e.g. Alto, Medio, Bajo
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
