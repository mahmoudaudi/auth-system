from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/count", summary="Number of active users")
def users_count(db: Session = Depends(get_db)):
    return {"total_users": stats_service.count_active(db)}


@router.get("/average-age", summary="Average age of active users")
def average_age(db: Session = Depends(get_db)):
    avg = stats_service.average_age(db)
    return {"average_age": round(avg, 2) if avg is not None else None}


@router.get("/top-cities", summary="Top 3 cities of active users")
def top_cities(db: Session = Depends(get_db)):
    return {"cities": stats_service.top_cities(db, limit=3)}
