from app.core.security import verify_password
from app.services.users import get_active_by_email


async def authenticate(email: str, password: str) -> dict | None:
    user = await get_active_by_email(email.lower())
    if user is None or not verify_password(password, user["password_hash"]):
        return None
    return user
