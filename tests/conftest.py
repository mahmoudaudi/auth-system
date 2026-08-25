"""Shared test fixtures.

Strategy:
- The whole suite runs against the REAL MySQL server but on the dedicated
  ``auth_system_test`` database (URL derived from .env, never hardcoded here).
- Tables are dropped/recreated once per session; rows are wiped after EVERY
  test so tests stay independent.
- The first admin cannot be created through POST /users (chicken-and-egg),
  so tests bootstrap admins directly in the database.
"""

import os
from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

load_dotenv()

_test_url = os.environ["DATABASE_URL"].rsplit("/", 1)[0] + "/auth_system_test"
os.environ["DATABASE_URL"] = _test_url

from app.core.security import hash_password  # noqa: E402
from app.database.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import Base, User  # noqa: E402

PASSWORD = "Secret123"
_HASHED = hash_password(PASSWORD)


@pytest.fixture(scope="session", autouse=True)
def setup_database() -> Generator[None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def clean_tables(setup_database) -> Generator[None]:
    """Wipe every table after each test -> full isolation between tests."""
    yield
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())


@pytest.fixture
def db_session() -> Generator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def make_user(
    db: Session, *, user_type: str = "client", email: str | None = None, **overrides
) -> User:
    """Fast direct-insert factory (bypasses HTTP + re-hashing cost)."""
    data = {
        "first_name": "Test",
        "last_name": "User",
        "email": email
        or f"user{int(datetime.now(timezone.utc).timestamp() * 1e6)}@test.com",
        "phone_number": "+96170000000",
        "city": "Tripoli",
        "age": 25,
        "type": user_type,
        "password_hash": _HASHED,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    data.update(overrides)
    user = User(**data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_header(client: TestClient, email: str, password: str = PASSWORD) -> dict:
    response = client.post("/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def refresh_db(db: Session) -> None:
    """Make rows committed by ANOTHER session visible in this session.

    MySQL runs REPEATABLE READ by default: a session keeps its snapshot until
    its transaction ends. Committing here closes it so the next read is fresh.
    """
    db.commit()
    db.expire_all()


def register(client: TestClient, _email=None, **overrides) -> object:
    payload = {
        "first_name": "John",
        "last_name": "Doe",
        "email": _email,
        "phone_number": "+96170123456",
        "city": "Tripoli",
        "age": 25,
        "password": PASSWORD,
    }
    payload.update(overrides)
    return client.post("/register", json=payload)


@pytest.fixture
def client_user(client: TestClient, db_session: Session):
    """A regular client account + its Authorization header."""
    user = make_user(db_session, email="client@test.com")
    return user, auth_header(client, user.email)


@pytest.fixture
def admin_user(client: TestClient, db_session: Session):
    """An admin account + its Authorization header."""
    user = make_user(db_session, user_type="admin", email="admin@test.com")
    return user, auth_header(client, user.email)
