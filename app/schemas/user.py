import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

PHONE_REGEX = re.compile(r"^\+?\d{7,15}$")

USER_TYPES = Literal["admin", "client"]


def _clean_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("must not be empty")
    return value


def _validate_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("password must be at least 8 characters long")
    if not re.search(r"[A-Z]", value):
        raise ValueError("password must contain an uppercase letter")
    if not re.search(r"[a-z]", value):
        raise ValueError("password must contain a lowercase letter")
    if not re.search(r"\d", value):
        raise ValueError("password must contain a digit")
    return value


class RegisterIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=255)
    phone_number: str = Field(max_length=32)
    city: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=13, le=120)
    password: str

    @field_validator("first_name", "last_name", "city")
    @classmethod
    def strip_and_require_non_empty(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        if not PHONE_REGEX.match(value):
            raise ValueError("invalid phone number (7-15 digits, optional + prefix)")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return _validate_password(value)


class AdminCreateUserIn(RegisterIn):
    type: USER_TYPES


class UserUpdateMeIn(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    age: int | None = Field(default=None, ge=13, le=120)
    password: str | None = None
    avatar_url: str | None = None

    @field_validator("first_name", "last_name", "city")
    @classmethod
    def strip_and_require_non_empty(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not PHONE_REGEX.match(value):
            raise ValueError("invalid phone number (7-15 digits, optional + prefix)")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str | None) -> str | None:
        return None if value is None else _validate_password(value)


class AdminUpdateUserIn(UserUpdateMeIn):
    type: USER_TYPES | None = None


class UserOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone_number: str
    city: str
    age: int
    type: USER_TYPES
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime


class PaginatedUsers(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    users: list[UserOut]
