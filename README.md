# Auth & User Management API

A production-style REST API built with **FastAPI + PostgreSQL**, featuring JWT authentication,
role-based authorization (admin/client), soft delete, pagination, filtering and public statistics.

---

## 1. Final project structure

```
auth-system/
├── app/
│   ├── main.py                  # App creation, router mounting, table bootstrap
│   ├── create_admin.py          # One-time CLI: creates the first admin (python -m app.create_admin)
│   ├── core/
│   │   ├── config.py            # Settings loaded from .env
│   │   └── security.py          # Password hashing + JWT create/decode
│   ├── database/
│   │   └── db.py                # Engine, SessionLocal, get_db dependency
│   ├── models/
│   │   └── user.py              # User ORM model (unique email, indexes)
│   ├── schemas/
│   │   ├── auth.py              # LoginIn, TokenOut
│   │   └── user.py              # RegisterIn, AdminCreateUserIn, updates, UserOut, PaginatedUsers
│   ├── routes/
│   │   ├── auth.py              # POST /register, POST /login
│   │   ├── users.py             # POST/GET /users, GET/PUT /users/me, PUT/DELETE /users/{id}
│   │   └── stats.py             # Public statistics endpoints
│   ├── services/
│   │   ├── auth.py              # authenticate() business rule
│   │   ├── users.py             # registration, updates, soft delete, list query builder
│   │   └── stats.py             # aggregate queries
│   └── dependencies/
│       └── auth.py              # get_current_user(), require_admin()
├── tests/
│   ├── conftest.py              # Test DB override, fixtures, factories
│   ├── test_register.py         ├── test_login.py        ├── test_auth_dependencies.py
│   ├── test_authorization.py    ├── test_profile.py      ├── test_admin_users.py
│   ├── test_soft_delete.py      └── test_stats.py
├── setup_db.sql                 # One-time DB + DB-user bootstrap
├── .env.example                 # Template - copy to .env
├── requirements.txt · pytest.ini · ruff.toml · README.md
```

**Layer responsibilities:** `routes` = HTTP only → `services` = business rules →
`models/database` = persistence; `schemas` validate every payload; `dependencies` hold
reusable auth logic shared by all protected endpoints.

## 2. Setup instructions

```bash
cd ~/Desktop/auth-system
psql -U postgres -f setup_db.sql
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.create_admin
```

