# Auth & User Management API

A production-style REST API built with **FastAPI + MySQL**, featuring JWT authentication,
role-based authorization (admin/client), soft delete, pagination, filtering and public statistics.

---

## 1. Final project structure

```
auth-system/
├── app/
│   ├── main.py                  # App creation, router mounting, table bootstrap
│   ├── create_admin.py          # One-time CLI: creates the first admin (python -m app.create_admin)
│   ├── core/
│   │   ├── config.py            # Settings loaded from .env (secrets never hardcoded)
│   │   └── security.py          # Argon2 hash/verify + JWT create/decode
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
├── setup_db.sql                 # One-time DB + DB-user bootstrap (run with sudo mysql)
├── .env.example                 # Template - copy to .env
├── requirements.txt · pytest.ini · ruff.toml · README.md
```

**Layer responsibilities:** `routes` = HTTP only → `services` = business rules →
`models/database` = persistence; `schemas` validate every payload; `dependencies` hold
reusable auth logic shared by all protected endpoints.

## 2. Setup instructions

```bash
cd ~/Desktop/auth-system
sudo mysql < setup_db.sql                       # one-time (section 4)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                            # then edit secrets (section 3)
python -m app.create_admin                      # one-time first admin
```

## 3. Environment variables (.env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mysql+pymysql://auth_app:<password>@localhost:3306/auth_system?charset=utf8mb4` |
| `JWT_SECRET_KEY` | Long random string — `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 60) |
| `ADMIN_*` | Used only by `python -m app.create_admin` |

`.env` is git-ignored; `.env.example` documents it.

## 4. Database setup

```bash
sudo mysql < setup_db.sql
```
Creates `auth_system` and `auth_system_test`, plus MySQL user `auth_app` granted access
to only those two databases. Tables are auto-created on first app start.
Indexes: unique on `email`; normal indexes on `is_deleted`, `city`, `type`.

## 5. Run the API

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8001     # 8000 is used by another local app
```

## 6. Swagger UI

- Interactive docs: **http://127.0.0.1:8001/docs**
- OpenAPI schema: http://127.0.0.1:8001/openapi.json

Click **Authorize**, paste the token from `POST /login` as `Bearer <token>`.

## 7. Run tests

```bash
pytest -v            # runs against auth_system_test, wiped clean between tests
ruff check app tests # lint
```

## 8. Endpoint summary

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register (always creates `client`) → 201 |
| POST | `/login` | Public | Email+password → `{access_token}` |
| GET | `/stats/count` | Public | Active user count |
| GET | `/stats/average-age` | Public | Average age of active users |
| GET | `/stats/top-cities` | Public | Top 3 cities of active users |
| GET | `/users/me` | Any authenticated | Own profile |
| PUT | `/users/me` | Any authenticated | Update own profile (no role field!) |
| POST | `/users` | Admin | Create client or admin |
| GET | `/users` | Admin | List active users (`page`,`limit`,`city`,`type`,`age`,`first_name`,`last_name`,`email`) |
| PUT | `/users/{id}` | Admin | Update any user incl. role |
| DELETE | `/users/{id}` | Admin | Soft delete |
| GET | `/health` | Public | Health check |

Errors: `400` bad logic · `401` missing/invalid/expired token, bad credentials, deleted user ·
`403` non-admin on admin routes · `404` unknown id/deleted target · `409` duplicate email · `422` validation.

## 9. Authentication flow

1. Client posts credentials to `/login`.
2. Service looks up an **active** user by email and verifies the Argon2 hash.
   Unknown email / wrong password / soft-deleted account all return the same generic
   `401 Invalid email or password` (prevents user enumeration).
3. On success the server signs a JWT containing `sub=<user_id>`, `iat`, `exp` with
   `JWT_SECRET_KEY` — no server-side session storage needed (stateless).
4. Clients send `Authorization: Bearer <token>`.
5. `get_current_user()` decodes + validates signature/expiry, loads the user from DB,
   rejects soft-deleted accounts, and injects the `User` into the route.

## 10. Authorization flow

`require_admin()` is a dependency chained on `get_current_user()`:

```
request → get_current_user() → require_admin() → route body
                    │                    │
                401 invalid          403 if type != admin
```

Admin-only routes simply declare `_admin: User = Depends(require_admin)`.
A valid client token reaching them gets `403 Forbidden`.

## 11. Soft-delete flow

`DELETE /users/{id}` sets `is_deleted=true` + `deleted_at=now()` — rows are never removed.
Every read path filters `is_deleted = false`: listings, login lookup, token validation,
and all three statistics queries. Consequences: deleted users vanish from `/users`,
cannot log in, existing tokens stop working immediately (the dependency re-checks the flag),
and they disappear from stats — while the record remains in the database.

## 12. Pagination & filtering

`GET /users?page=2&limit=10&city=Tripoli&type=client`:

1. Build query: always `WHERE is_deleted = false`, plus optional equality filters
   (`city`, `type`, `age`) and case-insensitive contains searches (`first_name`,
   `last_name`, `email` via `ILIKE %…%`).
2. `SELECT COUNT(*)` over the filtered set → `total`.
3. `total_pages = ceil(total / limit)`; page is clamped into range.
4. Fetch one slice with `ORDER BY id LIMIT/OFFSET`.

Validation: `page ≥ 1`, `1 ≤ limit ≤ 100` (else 422). Response shape:
`{page, limit, total, total_pages, users[]}`.

## 13. Statistics

All public, all restricted to active users:

- `/stats/count` → `COUNT(*)`
- `/stats/average-age` → `AVG(age)` rounded to 2 decimals (`null` when empty)
- `/stats/top-cities` → `GROUP BY city ORDER BY count DESC LIMIT 3`

## 14. Security checklist

- ✅ Argon2id password hashing (auto-salted, never plaintext/reversible)
- ✅ Hashes never appear in any response (`UserOut` has no password fields)
- ✅ JWT secret from environment, generated randomly per install
- ✅ Tokens expire (`exp` verified by PyJWT); expired ⇒ 401
- ✅ Role escalation impossible by design: public/self-update schemas contain no
  `type` field; extra JSON keys ignored; service hardcodes `client` on register;
  only admin schemas accept `type`
- ✅ Generic login errors (no user enumeration); deleted users indistinguishable
- ✅ Soft-deleted protection: cannot login, tokens invalidated, hidden everywhere
- ✅ Duplicate emails blocked twice: pre-check (409) + DB UNIQUE constraint safety net
- ✅ Pydantic validation on every input (names, email format, phone regex,
  age 13–120, password complexity, role whitelist)
- ✅ Parameterized SQL via SQLAlchemy ORM (no injection)
- ✅ Secrets/config exclusively via `.env` (git-ignored)
