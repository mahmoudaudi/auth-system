from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import RegisterIn, UserUpdateMeIn

ACTIVE_FILTER = User.is_deleted.is_(False)


def get_active_by_email(db: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email, ACTIVE_FILTER)
    return db.scalar(stmt)


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def email_in_use(
    db: Session, email: str, *, exclude_user_id: int | None = None
) -> bool:
    """True when some OTHER active user already uses this email."""
    stmt = (
        select(sa_func.count())
        .select_from(User)
        .where(
            User.email == email,
            ACTIVE_FILTER,
        )
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    return (db.scalar(stmt) or 0) > 0


def register_client(db: Session, data: RegisterIn) -> User:
    """Public registration ALWAYS creates a client - role is not taken from input."""
    return _create(db, data, user_type="client")


def create_user_with_role(db: Session, data, user_type: str) -> User:
    """Used by admins; role comes from validated admin input."""
    return _create(db, data, user_type=user_type)


def _create(db: Session, data: RegisterIn, *, user_type: str) -> User:
    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=data.email.lower(),
        phone_number=data.phone_number,
        city=data.city.strip(),
        age=data.age,
        type=user_type,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def apply_update(db: Session, user: User, data: UserUpdateMeIn) -> User:
    """Apply only the fields present in the request payload."""
    changes = data.model_dump(exclude_unset=True)

    new_password = changes.pop("password", None)
    if new_password is not None:
        user.password_hash = hash_password(new_password)

    changes["email"] = changes["email"].lower() if "email" in changes else user.email
    for field, value in changes.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def soft_delete(db: Session, user: User) -> User:
    from datetime import datetime, timezone

    user.is_deleted = True
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return user


def build_active_users_query(filters: dict):
    """Base query: active users + optional equality/contains filters."""
    stmt = select(User).where(ACTIVE_FILTER)
    if filters.get("city"):
        stmt = stmt.where(User.city == filters["city"])
    if filters.get("type"):
        stmt = stmt.where(User.type == filters["type"])
    if filters.get("age") is not None:
        stmt = stmt.where(User.age == filters["age"])
    if filters.get("first_name"):
        stmt = stmt.where(User.first_name.ilike(f"%{filters['first_name']}%"))
    if filters.get("last_name"):
        stmt = stmt.where(User.last_name.ilike(f"%{filters['last_name']}%"))
    if filters.get("email"):
        stmt = stmt.where(User.email.ilike(f"%{filters['email']}%"))
    return stmt
