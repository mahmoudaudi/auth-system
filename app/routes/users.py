import math
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.user import (
    AdminCreateUserIn,
    AdminUpdateUserIn,
    PaginatedUsers,
    UserOut,
    UserUpdateMeIn,
)
from app.services import users as user_service
from app.services.users import build_active_users_query

router = APIRouter(tags=["Users"])

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: create a user (client or admin)",
)
def create_user(
    data: AdminCreateUserIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if user_service.email_in_use(db, data.email.lower()):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    try:
        user = user_service.create_user_with_role(db, data, user_type=data.type)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    return user


@router.get(
    "/users/me",
    response_model=UserOut,
    summary="Get my own profile",
)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put(
    "/users/me",
    response_model=UserOut,
    summary="Update my own profile",
)
def update_my_profile(
    data: UserUpdateMeIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    changes = data.model_dump(exclude_unset=True)
    if "email" in changes and user_service.email_in_use(
        db, str(changes["email"]).lower(), exclude_user_id=current_user.id
    ):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    try:
        return user_service.apply_update(db, current_user, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None


@router.get(
    "/users",
    response_model=PaginatedUsers,
    summary="Admin: list active users (pagination + filtering + search)",
)
def list_users(
    page: int = Query(default=1, ge=1, description="Page number, starts at 1"),
    limit: int = Query(
        default=10, ge=1, le=100, description="Items per page (max 100)"
    ),
    city: str | None = None,
    type: str | None = Query(default=None, pattern="^(admin|client)$"),
    age: int | None = Query(default=None, ge=13, le=120),
    first_name: str | None = Query(default=None, min_length=1),
    last_name: str | None = Query(default=None, min_length=1),
    email: str | None = Query(default=None, min_length=3),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    filters = {
        k: v
        for k, v in {
            "city": city,
            "type": type,
            "age": age,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
        }.items()
        if v is not None
    }

    stmt = build_active_users_query(filters)

    # 1. filters applied -> 2. count -> 3. paginate -> 4. fetch page
    total = db.scalar(select(sa_func.count()).select_from(stmt.subquery())) or 0
    total_pages = max(1, math.ceil(total / limit))
    page = min(page, total_pages) if total else 1

    rows = db.scalars(
        stmt.order_by(User.id).offset((page - 1) * limit).limit(limit)
    ).all()

    return PaginatedUsers(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        users=[UserOut.model_validate(u) for u in rows],
    )


@router.put(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Admin: update any active user (may change role)",
)
def update_user(
    user_id: int,
    data: AdminUpdateUserIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = user_service.get_by_id(db, user_id)
    if user is None or user.is_deleted:
        raise HTTPException(status_code=404, detail="User not found")

    changes = data.model_dump(exclude_unset=True)
    if "email" in changes and user_service.email_in_use(
        db, str(changes["email"]).lower(), exclude_user_id=user.id
    ):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    try:
        return user_service.apply_update(db, user, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Admin: soft-delete a user",
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = user_service.get_by_id(db, user_id)
    if user is None or user.is_deleted:
        raise HTTPException(status_code=404, detail="User not found")

    user_service.soft_delete(db, user)
    return {"detail": f"User {user.email} has been deleted"}


@router.post(
    "/users/me/avatar",
    response_model=UserOut,
    summary="Upload a profile avatar (JPEG/PNG/WebP/GIF, max 2 MB)",
)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {file.content_type}. "
            "Allowed: JPEG, PNG, WebP, GIF.",
        )

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"File too large ({len(data) // 1024} KB). Max 2 MB.",
        )

    # Delete old avatar file if it exists
    if current_user.avatar_url:
        old_path = os.path.join(UPLOAD_DIR, current_user.avatar_url.lstrip("/"))
        if os.path.isfile(old_path):
            os.remove(old_path)

    # Save new file
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(AVATAR_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete(
    "/users/me/avatar",
    response_model=UserOut,
    summary="Remove profile avatar",
)
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.avatar_url:
        path = os.path.join(UPLOAD_DIR, current_user.avatar_url.lstrip("/"))
        if os.path.isfile(path):
            os.remove(path)
        current_user.avatar_url = None
        db.commit()
        db.refresh(current_user)
    return current_user
