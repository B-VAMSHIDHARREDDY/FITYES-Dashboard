"""Application settings, loaded from environment variables / `.env`."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "FITYES API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = Field(..., description="Postgres (or SQLite for local dev/tests) URL")
    db_schema: str = "realestate"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_echo: bool = False

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Auth. Set JWT_SECRET in production; when empty a random per-process secret is used (dev only),
    # which signs everyone out whenever the API restarts.
    jwt_secret: str = ""
    jwt_expire_minutes: int = 720
    # First admin, created on startup when the users table is empty. Leave the password empty to
    # have one generated and printed once to the console.
    initial_admin_user_id: str = "admin"
    initial_admin_name: str = "Administrator"
    initial_admin_password: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        """Normalise provider URLs (`postgres://`) to the psycopg3 driver."""
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")

    @property
    def effective_schema(self) -> str | None:
        """SQLite has no schemas; Postgres tables live in an isolated schema."""
        return None if self.is_sqlite else self.db_schema

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
