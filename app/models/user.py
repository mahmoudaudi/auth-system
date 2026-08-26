from datetime import datetime, timezone


def user_doc_to_dict(data: dict) -> dict:
    """Ensure a MongoDB user document has all required fields with defaults."""
    now = datetime.now(timezone.utc)
    data.setdefault("_id", None)
    data.setdefault("first_name", "")
    data.setdefault("last_name", "")
    data.setdefault("email", "")
    data.setdefault("phone_number", "")
    data.setdefault("city", "")
    data.setdefault("age", 0)
    data.setdefault("type", "client")
    data.setdefault("password_hash", "")
    data.setdefault("is_deleted", False)
    data.setdefault("deleted_at", None)
    data.setdefault("avatar_url", None)
    data.setdefault("created_at", now)
    data.setdefault("updated_at", now)
    return data
