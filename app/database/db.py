from pymongo import ASCENDING, DESCENDING, IndexModel
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.database_url)
    db = client[settings.database_name]
    await db.users.create_indexes([
        IndexModel([("email", ASCENDING)], unique=True),
        IndexModel([("city", ASCENDING)]),
        IndexModel([("type", ASCENDING)]),
        IndexModel([("is_deleted", ASCENDING)]),
    ])


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return db
