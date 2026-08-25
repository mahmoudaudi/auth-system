from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.database.db import get_db
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
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if user_service.email_in_use(db, data.email.lower()):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    try:
        user = user_service.register_client(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    return user


@router.post("/login", response_model=TokenOut, summary="Login with email + password")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = authenticate(db, data.email, data.password)
    if user is None:
        # One generic message for wrong password / unknown email / deleted account.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenOut(access_token=create_access_token(user.id))
