"""Admin-only user management tests: create, list, pagination, filtering, update."""

import math

from tests.conftest import PASSWORD, auth_header, make_user


def _create_payload(email: str, **overrides) -> dict:
    payload = {
        "first_name": "Admin",
        "last_name": "Made",
        "email": email,
        "phone_number": "+96170333333",
        "city": "Beirut",
        "age": 30,
        "type": "client",
        "password": PASSWORD,
    }
    payload.update(overrides)
    return payload


def test_admin_creates_client(client, admin_user):
    _, admin_headers = admin_user
    response = client.post(
        "/users", headers=admin_headers, json=_create_payload("made-client@test.com")
    )
    assert response.status_code == 201
    assert response.json()["type"] == "client"
    assert "password" not in response.json()


def test_admin_creates_admin(client, admin_user):
    _, admin_headers = admin_user
    response = client.post(
        "/users",
        headers=admin_headers,
        json=_create_payload("made-admin@test.com", type="admin"),
    )
    assert response.status_code == 201
    assert response.json()["type"] == "admin"


def test_admin_create_duplicate_email(client, admin_user):
    _, admin_headers = admin_user
    client.post("/users", headers=admin_headers, json=_create_payload("dup-a@test.com"))
    response = client.post(
        "/users", headers=admin_headers, json=_create_payload("dup-a@test.com")
    )
    assert response.status_code == 409


def test_pagination_shape_and_math(client, admin_user, db_session):
    for i in range(12):
        make_user(db_session, email=f"page{i}@test.com")
    _, admin_headers = admin_user

    response = client.get("/users?page=1&limit=10", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["limit"] == 10
    assert body["total"] == 13  # 12 seeded + 1 admin
    assert body["total_pages"] == math.ceil(13 / 10)
    assert len(body["users"]) == 10


def test_pagination_second_page(client, admin_user, db_session):
    for i in range(7):
        make_user(db_session, email=f"p2-{i}@test.com")
    _, admin_headers = admin_user

    body = client.get("/users?page=2&limit=5", headers=admin_headers).json()
    assert body["total"] == 8  # 7 + admin
    assert len(body["users"]) == 3  # remainder on page 2


def test_page_beyond_range_clamped_to_last(client, admin_user):
    _, admin_headers = admin_user
    body = client.get("/users?page=99&limit=5", headers=admin_headers).json()
    assert body["page"] == 1  # only one page exists


def test_invalid_pagination_rejected(client, admin_user):
    _, admin_headers = admin_user
    assert client.get("/users?page=0", headers=admin_headers).status_code == 422
    assert client.get("/users?limit=0", headers=admin_headers).status_code == 422
    assert client.get("/users?limit=101", headers=admin_headers).status_code == 422


def test_filter_by_city_and_type_and_age(client, db_session):
    # dedicated admin whose city/age cannot collide with the seeded filters
    admin = make_user(
        db_session,
        user_type="admin",
        email="filter-admin@test.com",
        city="AdminCity",
        age=99,
    )
    headers = auth_header(client, admin.email)

    make_user(db_session, email="f1@test.com", city="Tripoli", age=25)
    make_user(db_session, email="f2@test.com", city="Tripoli", age=40)
    make_user(db_session, email="f3@test.com", city="Beirut", age=25)
    make_user(db_session, email="f4@test.com", city="Saida", age=25)

    tripoli = client.get("/users?city=Tripoli", headers=headers).json()
    assert tripoli["total"] == 2

    aged25 = client.get("/users?age=25", headers=headers).json()
    assert aged25["total"] == 3

    both = client.get("/users?city=Tripoli&age=25", headers=headers).json()
    assert both["total"] == 1
    assert both["users"][0]["email"] == "f1@test.com"


def test_filter_by_type_admin_only(client, admin_user, db_session):
    make_user(db_session, email="plain@test.com")
    _, admin_headers = admin_user

    admins = client.get("/users?type=admin", headers=admin_headers).json()
    assert admins["total"] == 1
    assert admins["users"][0]["type"] == "admin"

    clients = client.get("/users?type=client", headers=admin_headers).json()
    assert clients["total"] == 1
    assert clients["users"][0]["type"] == "client"


def test_search_by_names_and_email(client, admin_user, db_session):
    make_user(
        db_session,
        email="searchable@test.com",
        first_name="Alexander",
        last_name="Hamilton",
    )
    make_user(
        db_session, email="alex.smith@test.com", first_name="Alex", last_name="Smith"
    )
    _, admin_headers = admin_user

    by_first = client.get("/users?first_name=alex", headers=admin_headers).json()
    assert by_first["total"] == 2  # contains-match, case-insensitive

    by_last = client.get("/users?last_name=ham", headers=admin_headers).json()
    assert by_last["total"] == 1
    assert by_last["users"][0]["email"] == "searchable@test.com"

    by_email = client.get("/users?email=smith", headers=admin_headers).json()
    assert by_email["total"] == 1


def test_filter_plus_pagination_together(client, db_session):
    admin = make_user(
        db_session,
        user_type="admin",
        email="pp-admin@test.com",
        city="AdminCity",
    )
    headers = auth_header(client, admin.email)

    for i in range(9):
        make_user(db_session, email=f"beiruti{i}@test.com", city="Beirut")
    make_user(db_session, email="other@test.com", city="Saida")

    body = client.get("/users?city=Beirut&page=2&limit=5", headers=headers).json()
    assert body["total"] == 9  # filters applied BEFORE counting
    assert body["total_pages"] == 2
    assert len(body["users"]) == 4  # 9 items -> 4 on page 2
    assert all(u["city"] == "Beirut" for u in body["users"])


def test_admin_updates_any_user(client, admin_user, db_session):
    target = make_user(db_session, email="target@test.com")
    _, admin_headers = admin_user
    response = client.put(
        f"/users/{target.id}",
        headers=admin_headers,
        json={"first_name": "Renamed", "age": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["first_name"] == "Renamed"
    assert body["age"] == 50


def test_admin_promotes_client_to_admin_and_back(client, admin_user, db_session):
    target = make_user(db_session, email="promote@test.com")
    _, admin_headers = admin_user

    up = client.put(
        f"/users/{target.id}", headers=admin_headers, json={"type": "admin"}
    )
    assert up.json()["type"] == "admin"

    down = client.put(
        f"/users/{target.id}", headers=admin_headers, json={"type": "client"}
    )
    assert down.json()["type"] == "client"


def test_admin_update_nonexistent_404(client, admin_user):
    _, admin_headers = admin_user
    response = client.put("/users/99999", headers=admin_headers, json={"age": 30})
    assert response.status_code == 404


def test_admin_update_duplicate_email_conflict(client, admin_user, db_session):
    a = make_user(db_session, email="ua@test.com")
    b = make_user(db_session, email="ub@test.com")
    _, admin_headers = admin_user
    response = client.put(
        f"/users/{a.id}", headers=admin_headers, json={"email": b.email}
    )
    assert response.status_code == 409


def test_admin_update_deleted_user_404(client, admin_user, db_session):
    target = make_user(db_session, email="goner@test.com")
    _, admin_headers = admin_user
    client.delete(f"/users/{target.id}", headers=admin_headers)
    response = client.put(
        f"/users/{target.id}", headers=admin_headers, json={"age": 60}
    )
    assert response.status_code == 404
