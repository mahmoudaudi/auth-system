"""Role-based authorization tests (admin vs client)."""

from tests.conftest import make_user


def test_admin_can_access_admin_routes(client, admin_user):
    _, admin_headers = admin_user
    assert client.get("/users", headers=admin_headers).status_code == 200
    assert (
        client.post(
            "/users",
            headers=admin_headers,
            json={
                "first_name": "N",
                "last_name": "U",
                "email": "created-by-admin@test.com",
                "phone_number": "+96170111111",
                "city": "Beirut",
                "age": 30,
                "type": "client",
                "password": "Secret123",
            },
        ).status_code
        == 201
    )


def test_client_cannot_list_users(client, client_user):
    _, client_headers = client_user
    response = client.get("/users", headers=client_headers)
    assert response.status_code == 403


def test_client_cannot_create_users(client, client_user):
    _, client_headers = client_user
    response = client.post(
        "/users",
        headers=client_headers,
        json={
            "first_name": "Nope",
            "last_name": "Nope",
            "email": "nope@test.com",
            "phone_number": "+96170222222",
            "city": "Beirut",
            "age": 30,
            "type": "admin",
            "password": "Secret123",
        },
    )
    assert response.status_code == 403


def test_client_cannot_update_another_user(client, client_user, db_session):
    _, client_headers = client_user
    other = make_user(db_session)
    response = client.put(
        f"/users/{other.id}", headers=client_headers, json={"age": 40}
    )
    assert response.status_code == 403


def test_client_cannot_delete_another_user(client, client_user, db_session):
    _, client_headers = client_user
    other = make_user(db_session)
    response = client.delete(f"/users/{other.id}", headers=client_headers)
    assert response.status_code == 403


def test_client_cannot_escalate_role_via_profile(client, client_user):
    user, client_headers = client_user
    response = client.put("/users/me", headers=client_headers, json={"type": "admin"})
    # The update schema has no 'type' field: extra key is ignored.
    assert response.status_code == 200
    assert response.json()["type"] == "client"
