from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Annotated
from app.database import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.security import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("", response_model=List[ReportResponse])
def get_reports(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    # Retorna los reportes ordenados por su ID descendentemente
    return db.query(Report).all()

@router.post("", response_model=ReportResponse)
def create_report(
    request: ReportCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    # Obtener el número correlativo para el ID
    report_count = db.query(Report).count()
    report_id = f"REP-{42 + report_count:03d}"
    
    db_report = Report(
        id=report_id,
        sector=request.sector,
        risk=request.risk
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report
