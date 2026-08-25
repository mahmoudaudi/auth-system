"""One-time helper to create the first admin.

Usage (from the project root):
    python -m app.create_admin
Reads ADMIN_* variables from .env. Refuses to run twice for the same email.
"""

from app.core.config import settings
from app.core.security import hash_password
from app.database.db import SessionLocal
from app.models.user import User
from app.services.users import email_in_use


def create_first_admin() -> None:
    db = SessionLocal()
    try:
        if email_in_use(db, settings.admin_email.lower()):
            print(
                f"Admin with email {settings.admin_email} "
                "already exists - nothing to do."
            )
            return

        admin = User(
            first_name=settings.admin_first_name,
            last_name=settings.admin_last_name,
            email=settings.admin_email.lower(),
            phone_number=settings.admin_phone_number,
            city=settings.admin_city,
            age=settings.admin_age,
            type="admin",
            password_hash=hash_password(settings.admin_password),
        )
        db.add(admin)
        db.commit()
        print(f"Admin created: {admin.email}")
    finally:
        db.close()


if __name__ == "__main__":
    create_first_admin()
