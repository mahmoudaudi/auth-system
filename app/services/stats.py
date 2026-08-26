from app.database.db import get_db


async def count_active() -> int:
    db = get_db()
    return await db.users.count_documents({"is_deleted": False})


async def average_age() -> float | None:
    db = get_db()
    pipeline = [
        {"$match": {"is_deleted": False}},
        {"$group": {"_id": None, "avg_age": {"$avg": "$age"}}},
    ]
    result = await db.users.aggregate(pipeline).to_list(1)
    if result:
        return result[0]["avg_age"]
    return None


async def top_cities(limit: int = 3) -> list[dict]:
    db = get_db()
    pipeline = [
        {"$match": {"is_deleted": False}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1, "_id": 1}},
        {"$limit": limit},
    ]
    results = await db.users.aggregate(pipeline).to_list(limit)
    return [{"city": r["_id"], "count": r["count"]} for r in results]
