import math
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.dependencies.auth import get_current_user, require_admin
from app.schemas.user import (
    AdminCreateUserIn,
    AdminUpdateUserIn,
    PaginatedUsers,
    UserOut,
    UserUpdateMeIn,
)
from app.services import users as user_service

router = APIRouter(tags=["Users"])

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 2 * 1024 * 1024


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: create a user (client or admin)",
)
async def create_user(
    data: AdminCreateUserIn,
    _admin: dict = Depends(require_admin),
):
    if await user_service.email_in_use(data.email.lower()):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    user = await user_service.create_user_with_role(data, user_type=data.type)
    return user


@router.get(
    "/users/me",
    response_model=UserOut,
    summary="Get my own profile",
)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put(
    "/users/me",
    response_model=UserOut,
    summary="Update my own profile",
)
async def update_my_profile(
    data: UserUpdateMeIn,
    current_user: dict = Depends(get_current_user),
):
    changes = data.model_dump(exclude_unset=True)
    if "email" in changes and await user_service.email_in_use(
        str(changes["email"]).lower(), exclude_user_id=str(current_user["id"])
    ):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    return await user_service.apply_update(str(current_user["id"]), data)


@router.get(
    "/users",
    response_model=PaginatedUsers,
    summary="Admin: list active users (pagination + filtering + search)",
)
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    city: str | None = None,
    type: str | None = Query(default=None, pattern="^(admin|client)$"),
    age: int | None = Query(default=None, ge=13, le=120),
    first_name: str | None = Query(default=None, min_length=1),
    last_name: str | None = Query(default=None, min_length=1),
    email: str | None = Query(default=None, min_length=3),
    _admin: dict = Depends(require_admin),
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

    users, total = await user_service.build_active_users_list(filters, page, limit)
    total_pages = max(1, math.ceil(total / limit))
    page = min(page, total_pages) if total else 1

    if (page - 1) * limit >= total and total > 0:
        users, total = await user_service.build_active_users_list(filters, total_pages, limit)
        page = total_pages

    return PaginatedUsers(
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
        users=users,
    )


@router.put(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Admin: update any active user",
)
async def update_user(
    user_id: str,
    data: AdminUpdateUserIn,
    _admin: dict = Depends(require_admin),
):
    user = await user_service.get_by_id(user_id)
    if user is None or user.get("is_deleted"):
        raise HTTPException(status_code=404, detail="User not found")

    changes = data.model_dump(exclude_unset=True)
    if "email" in changes and await user_service.email_in_use(
        str(changes["email"]).lower(), exclude_user_id=user_id
    ):
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from None
    return await user_service.apply_update(user_id, data)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Admin: soft-delete a user",
)
async def delete_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    user = await user_service.get_by_id(user_id)
    if user is None or user.get("is_deleted"):
        raise HTTPException(status_code=404, detail="User not found")

    await user_service.soft_delete(user_id)
    return {"detail": f"User {user['email']} has been deleted"}


@router.post(
    "/users/me/avatar",
    response_model=UserOut,
    summary="Upload a profile avatar (JPEG/PNG/WebP/GIF, max 2 MB)",
)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
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

    if current_user.get("avatar_url"):
        old_path = os.path.join(UPLOAD_DIR, current_user["avatar_url"].lstrip("/"))
        if os.path.isfile(old_path):
            os.remove(old_path)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(AVATAR_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)

    await user_service.apply_update(
        str(current_user["id"]),
        UserUpdateMeIn.model_validate({"avatar_url": f"/uploads/avatars/{filename}"}),
    )
    updated = await user_service.get_by_id(str(current_user["id"]))
    return updated


@router.delete(
    "/users/me/avatar",
    response_model=UserOut,
    summary="Remove profile avatar",
)
async def remove_avatar(
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("avatar_url"):
        path = os.path.join(UPLOAD_DIR, current_user["avatar_url"].lstrip("/"))
        if os.path.isfile(path):
            os.remove(path)
        await user_service.apply_update(
            str(current_user["id"]),
            UserUpdateMeIn.model_validate({"avatar_url": None}),
        )
        updated = await user_service.get_by_id(str(current_user["id"]))
        return updated
    return current_user
