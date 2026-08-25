"""Soft-delete flow tests: hidden, un-loginable, excluded from stats, still stored."""

from app.models.user import User
from tests.conftest import PASSWORD, auth_header, make_user, refresh_db


def test_soft_delete_hides_from_listing_and_keeps_record(
    client, admin_user, db_session
):
    target = make_user(db_session, email="soft@test.com")
    _, admin_headers = admin_user

    response = client.delete(f"/users/{target.id}", headers=admin_headers)
    assert response.status_code == 200

    listing = client.get("/users", headers=admin_headers).json()
    assert all(u["id"] != target.id for u in listing["users"])

    refresh_db(db_session)  # re-read what the API session committed
    row = db_session.get(User, target.id)
    assert row is not None  # record STILL EXISTS in database
    assert row.is_deleted is True  # flagged
    assert row.deleted_at is not None  # timestamped


def test_soft_delete_twice_returns_404(client, admin_user, db_session):
    target = make_user(db_session)
    _, admin_headers = admin_user
    assert (
        client.delete(f"/users/{target.id}", headers=admin_headers).status_code == 200
    )
    assert (
        client.delete(f"/users/{target.id}", headers=admin_headers).status_code == 404
    )


def test_soft_delete_nonexistent_404(client, admin_user):
    _, admin_headers = admin_user
    assert client.delete("/users/424242", headers=admin_headers).status_code == 404


def test_soft_delete_excludes_from_all_stats(client, db_session):
    make_user(db_session, email="stat1@test.com", city="Nabatieh", age=20)
    victim = make_user(db_session, email="stat2@test.com", city="Zahle", age=80)

    admin = make_user(db_session, user_type="admin", email="sd-admin@test.com")
    headers = auth_header(client, admin.email)
    assert client.delete(f"/users/{victim.id}", headers=headers).status_code == 200

    # active users: stat1 (20) + the admin itself (default age 25); victim gone
    assert client.get("/stats/count").json()["total_users"] == 2
    avg = client.get("/stats/average-age").json()["average_age"]
    assert avg == 22.5  # (20 + 25) / 2 - the deleted 80-year-old is excluded
    cities = [c["city"] for c in client.get("/stats/top-cities").json()["cities"]]
    assert "Zahle" not in cities


def test_deleted_user_cannot_login(client, db_session):
    user = make_user(db_session, email="nologin@test.com")
    admin = make_user(db_session, user_type="admin", email="nl-admin@test.com")
    headers = auth_header(client, admin.email)
    client.delete(f"/users/{user.id}", headers=headers)

    response = client.post(
        "/login", json={"email": "nologin@test.com", "password": PASSWORD}
    )
    assert response.status_code == 401
