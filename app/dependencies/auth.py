import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token
from app.services.users import get_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = payload["sub"]
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise unauthorized from None

    user = await get_by_id(user_id)
    if user is None or user.get("is_deleted"):
        raise unauthorized
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
