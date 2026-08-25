"""Authentication (JWT handling) tests: missing / invalid / expired tokens."""

import time

import jwt as pyjwt

from app.core.config import settings


def _expired_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "iat": int(time.time()) - 7200,
        "exp": int(time.time()) - 3600,  # expired one hour ago
    }
    return pyjwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def test_no_token_is_unauthorized(client):
    assert client.get("/users/me").status_code == 401


def test_garbage_token_is_unauthorized(client):
    response = client.get(
        "/users/me", headers={"Authorization": "Bearer not-a-real-jwt"}
    )
    assert response.status_code == 401


def test_expired_token_is_unauthorized(client, client_user):
    user, _ = client_user
    response = client.get(
        "/users/me", headers={"Authorization": f"Bearer {_expired_token(user.id)}"}
    )
    assert response.status_code == 401


def test_token_signed_with_wrong_secret_is_unauthorized(client, client_user):
    user, _ = client_user
    forged = pyjwt.encode(
        {"sub": str(user.id), "exp": int(time.time()) + 3600},
        "attacker-secret",
        algorithm=settings.jwt_algorithm,
    )
    response = client.get("/users/me", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_malformed_authorization_header(client):
    response = client.get("/users/me", headers={"Authorization": "Basic abc"})
    assert response.status_code in (401, 403)
