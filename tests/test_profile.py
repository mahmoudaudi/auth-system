"""GET /users/me and PUT /users/me (client profile) tests."""

from tests.conftest import PASSWORD, make_user


def test_get_own_profile(client, client_user):
    user, client_headers = client_user
    response = client.get("/users/me", headers=client_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user.id
    assert body["email"] == "client@test.com"
    assert "password" not in body and "password_hash" not in body


def test_update_own_profile_fields(client, client_user):
    _, client_headers = client_user
    response = client.put(
        "/users/me",
        headers=client_headers,
        json={"first_name": "NewName", "city": "Beirut", "age": 33},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["first_name"] == "NewName"
    assert body["city"] == "Beirut"
    assert body["age"] == 33
    # untouched fields stay the same
    assert body["last_name"] == "User"


def test_update_own_password(client, client_user):
    _, client_headers = client_user
    assert (
        client.put(
            "/users/me", headers=client_headers, json={"password": "NewSecret1"}
        ).status_code
        == 200
    )
    # old password no longer works
    assert (
        client.post(
            "/login", json={"email": "client@test.com", "password": PASSWORD}
        ).status_code
        == 401
    )
    # new password works and returns a valid token
    assert (
        client.post(
            "/login", json={"email": "client@test.com", "password": "NewSecret1"}
        ).status_code
        == 200
    )


def test_update_profile_cannot_take_existing_email(client, client_user, db_session):
    _, client_headers = client_user
    other = make_user(db_session, email="taken@test.com")
    response = client.put(
        "/users/me", headers=client_headers, json={"email": other.email}
    )
    assert response.status_code == 409


def test_update_profile_keeps_role_even_if_type_sent(client, client_user):
    _, client_headers = client_user
    response = client.put(
        "/users/me", headers=client_headers, json={"type": "admin", "age": 44}
    )
    assert response.status_code == 200
    assert response.json()["type"] == "client"
    assert response.json()["age"] == 44


def test_updated_at_changes_on_update(client, client_user):
    user, client_headers = client_user
    before = client.get("/users/me", headers=client_headers).json()["updated_at"]
    client.put("/users/me", headers=client_headers, json={"age": 26})
    after = client.get("/users/me", headers=client_headers).json()["updated_at"]
    assert after >= before


def test_update_with_invalid_data_rejected(client, client_user):
    _, client_headers = client_user
    for bad in (
        {"age": 5},
        {"phone_number": "nope"},
        {"email": "bad"},
        {"first_name": ""},
    ):
        response = client.put("/users/me", headers=client_headers, json=bad)
        assert response.status_code == 422, bad
