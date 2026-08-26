from fastapi import APIRouter

from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/count", summary="Number of active users")
async def users_count():
    return {"total_users": await stats_service.count_active()}


@router.get("/average-age", summary="Average age of active users")
async def average_age():
    avg = await stats_service.average_age()
    return {"average_age": round(avg, 2) if avg is not None else None}


@router.get("/top-cities", summary="Top 3 cities of active users")
async def top_cities():
    return {"cities": await stats_service.top_cities(limit=3)}
