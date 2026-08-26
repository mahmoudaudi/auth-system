"""One-time helper to create the first admin.

Usage (from the project root):
    python -m app.create_admin
"""

import asyncio

from app.core.config import settings
from app.core.security import hash_password
from app.database.db import connect_db, get_db


async def create_first_admin() -> None:
    await connect_db()
    db = get_db()
    existing = await db.users.find_one({"email": settings.admin_email.lower(), "is_deleted": False})
    if existing:
        print(f"Admin with email {settings.admin_email} already exists - nothing to do.")
        return

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    doc = {
        "first_name": settings.admin_first_name,
        "last_name": settings.admin_last_name,
        "email": settings.admin_email.lower(),
        "phone_number": settings.admin_phone_number,
        "city": settings.admin_city,
        "age": settings.admin_age,
        "type": "admin",
        "password_hash": hash_password(settings.admin_password),
        "is_deleted": False,
        "deleted_at": None,
        "avatar_url": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    print(f"Admin created: {doc['email']} (id={result.inserted_id})")


if __name__ == "__main__":
    asyncio.run(create_first_admin())
