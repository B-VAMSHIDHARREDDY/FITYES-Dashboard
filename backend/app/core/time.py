from datetime import UTC, date, datetime
from typing import Annotated

from pydantic import AfterValidator


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(dt: datetime) -> datetime:
    """SQLite drops tz info; treat naive timestamps as UTC."""
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


def days_since(value: datetime | date, until: date | None = None) -> int:
    end = until or utcnow().date()
    start = as_utc(value).date() if isinstance(value, datetime) else value
    return max((end - start).days, 0)


# Pydantic type: every datetime leaving the API is timezone-aware UTC.
UtcDatetime = Annotated[datetime, AfterValidator(as_utc)]
