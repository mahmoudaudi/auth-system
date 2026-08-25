from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def count_active(db: Session) -> int:
    return (
        db.scalar(
            select(sa_func.count()).select_from(User).where(User.is_deleted.is_(False))
        )
        or 0
    )


def average_age(db: Session) -> float | None:
    """Average age of ACTIVE users; None when there are none."""
    return db.scalar(select(sa_func.avg(User.age)).where(User.is_deleted.is_(False)))


def top_cities(db: Session, limit: int = 3) -> list[dict]:
    total = sa_func.count()
    rows = db.execute(
        select(User.city, total.label("count"))
        .where(User.is_deleted.is_(False))
        .group_by(User.city)
        .order_by(total.desc(), User.city)
        .limit(limit)
    ).all()
    return [{"city": city, "count": count} for city, count in rows]
