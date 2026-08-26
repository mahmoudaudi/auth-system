from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    database_name: str = "auth_system"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    admin_first_name: str = "Admin"
    admin_last_name: str = "User"
    admin_email: str = "admin@example.com"
    admin_phone_number: str = "+9613000000"
    admin_city: str = "Tripoli"
    admin_age: int = 30
    admin_password: str = "ChangeMe123!"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
