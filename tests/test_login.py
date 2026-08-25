"""Login behaviour tests."""

from tests.conftest import PASSWORD, auth_header, make_user, refresh_db, register


def test_login_success_returns_token(client):
    register(client, "loginok@test.com")
    response = client.post(
        "/login",
        json={"email": "loginok@test.com", "password": PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 50


def test_login_incorrect_password(client):
    register(client, "wrongpw@test.com")
    response = client.post(
        "/login",
        json={"email": "wrongpw@test.com", "password": "WrongPass1"},
    )
    assert response.status_code == 401


def test_login_nonexistent_email(client):
    response = client.post(
        "/login",
        json={"email": "ghost@test.com", "password": PASSWORD},
    )
    assert response.status_code == 401


def test_login_soft_deleted_user_rejected(client, db_session):
    from app.models.user import User

    deleted = make_user(db_session, email="deleted@test.com")
    admin = make_user(db_session, user_type="admin", email="del-admin@test.com")
    headers = auth_header(client, admin.email)

    assert client.delete(f"/users/{deleted.id}", headers=headers).status_code == 200
    refresh_db(db_session)
    assert db_session.get(User, deleted.id).is_deleted is True

    response = client.post(
        "/login",
        json={"email": "deleted@test.com", "password": PASSWORD},
    )
    assert response.status_code == 401


def test_deleted_user_token_also_rejected(client, db_session):
    """A token issued BEFORE deletion must stop working afterwards."""

    user = make_user(db_session, email="tokdel@test.com")
    admin = make_user(db_session, user_type="admin", email="tokdel-admin@test.com")
    headers = auth_header(client, user.email)  # token while active
    admin_headers = auth_header(client, admin.email)

    assert client.get("/users/me", headers=headers).status_code == 200
    client.delete(f"/users/{user.id}", headers=admin_headers)
    assert client.get("/users/me", headers=headers).status_code == 401
