from datetime import datetime, timezone

from bson import ObjectId

from app.core.security import hash_password
from app.database.db import get_db


def _doc_to_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "first_name": doc["first_name"],
        "last_name": doc["last_name"],
        "email": doc["email"],
        "phone_number": doc["phone_number"],
        "city": doc["city"],
        "age": doc["age"],
        "type": doc["type"],
        "avatar_url": doc.get("avatar_url"),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


async def get_active_by_email(email: str) -> dict | None:
    db = get_db()
    doc = await db.users.find_one({"email": email.lower(), "is_deleted": False})
    return doc


async def get_by_id(user_id: str) -> dict | None:
    db = get_db()
    try:
        doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None
    return doc


async def email_in_use(email: str, *, exclude_user_id: str | None = None) -> bool:
    db = get_db()
    query = {"email": email.lower(), "is_deleted": False}
    if exclude_user_id:
        query["_id"] = {"$ne": ObjectId(exclude_user_id)}
    count = await db.users.count_documents(query)
    return count > 0


async def register_client(data) -> dict:
    return await _create(data, user_type="client")


async def create_user_with_role(data, user_type: str) -> dict:
    return await _create(data, user_type=user_type)


async def _create(data, *, user_type: str) -> dict:
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "email": data.email.lower(),
        "phone_number": data.phone_number,
        "city": data.city.strip(),
        "age": data.age,
        "type": user_type,
        "password_hash": hash_password(data.password),
        "is_deleted": False,
        "deleted_at": None,
        "avatar_url": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_user(doc)


async def apply_update(user_id: str, data) -> dict:
    db = get_db()
    changes = data.model_dump(exclude_unset=True)

    new_password = changes.pop("password", None)
    if new_password is not None:
        changes["password_hash"] = hash_password(new_password)

    if "email" in changes:
        changes["email"] = changes["email"].lower()

    changes["updated_at"] = datetime.now(timezone.utc)

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": changes})
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    return _doc_to_user(doc)


async def soft_delete(user_id: str) -> None:
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )


async def build_active_users_list(
    filters: dict, page: int, limit: int
) -> tuple[list[dict], int]:
    db = get_db()
    query = {"is_deleted": False}

    if filters.get("city"):
        query["city"] = filters["city"]
    if filters.get("type"):
        query["type"] = filters["type"]
    if filters.get("age") is not None:
        query["age"] = filters["age"]
    if filters.get("first_name"):
        query["first_name"] = {"$regex": filters["first_name"], "$options": "i"}
    if filters.get("last_name"):
        query["last_name"] = {"$regex": filters["last_name"], "$options": "i"}
    if filters.get("email"):
        query["email"] = {"$regex": filters["email"], "$options": "i"}

    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.users.find(query).sort("created_at", 1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_doc_to_user(d) for d in docs], total
