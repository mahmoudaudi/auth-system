from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import create_access_token
from app.schemas.auth import LoginIn, TokenOut
from app.schemas.user import RegisterIn, UserOut
from app.services import users as user_service
from app.services.auth import authenticate

router = APIRouter(tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Public registration (always creates a client)",
)
async def register(data: RegisterIn):
    if await user_service.email_in_use(data.email.lower()):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    user = await user_service.register_client(data)
    return user


@router.post("/login", response_model=TokenOut, summary="Login with email + password")
async def login(data: LoginIn):
    user = await authenticate(data.email, data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenOut(access_token=create_access_token(str(user["_id"])))
