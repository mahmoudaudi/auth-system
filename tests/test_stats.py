"""Public statistics tests (active users only)."""

from tests.conftest import make_user


def test_stats_on_empty_database(client):
    assert client.get("/stats/count").json() == {"total_users": 0}
    assert client.get("/stats/average-age").json() == {"average_age": None}
    assert client.get("/stats/top-cities").json() == {"cities": []}


def test_count_active_only(client, db_session):
    make_user(db_session, email="c1@test.com")
    make_user(db_session, email="c2@test.com")
    deleted = make_user(db_session, email="c3@test.com")
    deleted.is_deleted = True
    db_session.commit()

    assert client.get("/stats/count").json()["total_users"] == 2


def test_average_age_of_active_users(client, db_session):
    make_user(db_session, email="a1@test.com", age=20)
    make_user(db_session, email="a2@test.com", age=30)
    make_user(db_session, email="a3@test.com", age=25)

    body = client.get("/stats/average-age").json()
    assert body["average_age"] == 25.0


def test_top_cities_ordered_and_limited_to_three(client, db_session):
    for i in range(5):
        make_user(db_session, email=f"t1-{i}@test.com", city="Tripoli")
    for i in range(4):
        make_user(db_session, email=f"b1-{i}@test.com", city="Beirut")
    for i in range(3):
        make_user(db_session, email=f"s1-{i}@test.com", city="Saida")
    for i in range(2):
        make_user(db_session, email=f"j2-{i}@test.com", city="Jounieh")

    body = client.get("/stats/top-cities").json()
    top = [(c["city"], c["count"]) for c in body["cities"]]
    assert top == [("Tripoli", 5), ("Beirut", 4), ("Saida", 3)]


def test_top_cities_ignores_deleted(client, db_session):
    for i in range(3):
        make_user(db_session, email=f"ac-{i}@test.com", city="Akkar")
    ghost_city_user = make_user(db_session, email="gone@test.com", city="Baalbek")
    ghost_city_user.is_deleted = True
    db_session.commit()

    cities = [c["city"] for c in client.get("/stats/top-cities").json()["cities"]]
    assert cities == ["Akkar"]
