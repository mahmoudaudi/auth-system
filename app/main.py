import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.db import connect_db, close_db
from app.routes import auth, stats, users

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect_db()
    await _seed_admin()
    yield
    await close_db()


async def _seed_admin():
    from datetime import datetime, timezone

    from app.core.config import settings
    from app.core.security import hash_password
    from app.database.db import get_db

    db = get_db()
    existing = await db.users.find_one({"email": settings.admin_email.lower()})
    if existing:
        return
    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "first_name": settings.admin_first_name,
        "last_name": settings.admin_last_name,
        "email": settings.admin_email.lower(),
        "phone_number": settings.admin_phone_number,
        "city": settings.admin_city,
        "age": settings.admin_age,
        "type": "admin",
        "password_hash": hash_password(settings.admin_password),
        "is_deleted": False,
        "deleted_at": None,
        "avatar_url": None,
        "created_at": now,
        "updated_at": now,
    })


app = FastAPI(
    title="Auth & User Management API",
    description=(
        "Full authentication and user management system.\n\n"
        "* **Public:** register, login, statistics\n"
        "* **Authenticated:** own profile (`/users/me`)\n"
        "* **Admin-only:** create / list / update / soft-delete users\n\n"
        "Authenticate with `Authorization: Bearer <token>` "
        '(get a token from `POST /login`, then click "Authorize" below).'
    ),
    version="1.0.0",
    lifespan=lifespan,
)

_EXTRA_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        *_EXTRA_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(stats.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health", tags=["Health"], summary="Health check")
def health():
    return {"status": "ok"}
