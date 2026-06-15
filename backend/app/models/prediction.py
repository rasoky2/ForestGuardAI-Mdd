import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    sector = Column(String, nullable=False)
    risk = Column(Integer, nullable=False)
    level = Column(String, nullable=False)
    evidence_deforestation = Column(Integer, nullable=False)
    evidence_roads = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
