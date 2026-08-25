"""Public registration tests."""

from tests.conftest import register


def test_register_success(client):
    response = register(client, "newuser@test.com")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "newuser@test.com"
    assert body["type"] == "client"
    for field in ("id", "first_name", "last_name", "phone_number", "city", "age"):
        assert field in body


def test_register_never_returns_password_hash(client):
    body = register(client, "nohash@test.com").json()
    assert "password" not in body
    assert "password_hash" not in body


def test_register_invalid_email(client):
    response = register(client, "bad-email@test.com", email="not-an-email")
    assert response.status_code == 422


def test_register_invalid_phone(client):
    response = register(client, "badphone@test.com", phone_number="abc12")
    assert response.status_code == 422


def test_register_age_too_low(client):
    response = register(client, "young@test.com", age=12)
    assert response.status_code == 422


def test_register_age_too_high(client):
    response = register(client, "old@test.com", age=121)
    assert response.status_code == 422


def test_register_empty_first_name(client):
    response = register(client, "emptyfirst@test.com", first_name="   ")
    assert response.status_code == 422


def test_register_empty_last_name(client):
    response = register(client, "emptylast@test.com", last_name="")
    assert response.status_code == 422


def test_register_duplicate_email_conflict(client):
    assert register(client, "dup@test.com").status_code == 201
    response = register(client, "dup@test.com", first_name="Other")
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


def test_register_with_type_admin_is_ignored(client):
    """Privilege escalation attempt: extra 'type' key must be ignored."""
    response = register(client, "escalator@test.com", type="admin")
    assert response.status_code == 201
    assert response.json()["type"] == "client"


def test_register_weak_passwords_rejected(client):
    for bad in ("Sh1rt", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"):
        response = register(client, f"weak{bad[:3]}@test.com", password=bad)
        assert response.status_code == 422, bad
