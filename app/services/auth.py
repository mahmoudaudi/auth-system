from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User
from app.services.users import get_active_by_email


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Return the user only when credentials are valid AND account is active.

    Soft-deleted users and unknown emails both return None, so the caller
    answers with one generic 401 (no user enumeration).
    """
    user = get_active_by_email(db, email.lower())
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user
