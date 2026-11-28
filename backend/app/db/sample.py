"""Sample (demo) dataset, kept in a JSON file instead of the database.

When a request carries `X-Sample-Data: 1`, it is served from a private in-memory SQLite database that is
filled from `app/sample/sample_data.json` the first time it is needed. Nothing about the demo data ever
touches the real database: edits made in sample mode live only in memory and vanish on restart.

Dates in the file are shifted forward by the time elapsed since it was generated, so "listed 3 days ago"
stays 3 days ago. Monthly market figures move by whole months to stay aligned to the 1st.

Regenerate the file with `python -m scripts.sample_data`.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import Date, DateTime, Engine, Enum, Numeric, Table, create_engine, insert, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.models import Base

SAMPLE_FILE = Path(__file__).resolve().parents[1] / "sample" / "sample_data.json"
FORMAT_VERSION = 1
# Tables that never belong in the demo dataset.
EXCLUDED_TABLES = {"users"}
# Date columns holding the first day of a month; shifted by whole months, not days.
MONTH_COLUMNS = {("market_snapshots", "month")}


def sample_tables() -> list[Table]:
    return [t for t in Base.metadata.sorted_tables if t.name not in EXCLUDED_TABLES]


def new_memory_engine() -> Engine:
    """In-memory SQLite that accepts the app's models (their Postgres schema is mapped away)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # one connection, so every session sees the same in-memory database
    )
    if settings.effective_schema:
        engine = engine.execution_options(schema_translate_map={settings.effective_schema: None})
    for table in sample_tables():
        table.create(engine)
    return engine


# ------------------------------------------------------------------ JSON <-> rows
def _to_json(value: Any) -> Any:
    if isinstance(value, datetime):
        return (value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "value") and not isinstance(value, (str, int, float, bool)):  # enum member
        return value.value
    return value


def dump(engine: Engine) -> dict:
    """Serialize every demo table to a JSON-ready dict."""
    tables: dict[str, list[dict]] = {}
    with engine.connect() as conn:
        for table in sample_tables():
            rows = conn.execute(select(table).order_by(*table.primary_key.columns)).mappings()
            tables[table.name] = [{k: _to_json(v) for k, v in row.items()} for row in rows]
    return {
        "version": FORMAT_VERSION,
        "generated_at": datetime.now(UTC).replace(tzinfo=None).isoformat(),
        "tables": tables,
    }


def _add_months(d: date, months: int) -> date:
    y, m = divmod(d.year * 12 + d.month - 1 + months, 12)
    return date(y, m + 1, 1)


def load(engine: Engine, data: dict, *, now: datetime | None = None) -> None:
    """Insert the JSON rows, moving every date forward by the time since the file was generated."""
    if data.get("version") != FORMAT_VERSION:
        raise ValueError(f"Unsupported sample data version: {data.get('version')}")
    now = (now or datetime.now(UTC)).replace(tzinfo=None)
    generated = datetime.fromisoformat(data["generated_at"])
    delta = now - generated
    day_shift = timedelta(days=(now.date() - generated.date()).days)
    month_shift = (now.year * 12 + now.month) - (generated.year * 12 + generated.month)

    with engine.begin() as conn:
        for table in sample_tables():
            rows = data["tables"].get(table.name, [])
            if not rows:
                continue
            converters = {}
            for col in table.columns:
                t = col.type
                if isinstance(t, DateTime):
                    converters[col.name] = lambda v: datetime.fromisoformat(v) + delta
                elif isinstance(t, Date):
                    if (table.name, col.name) in MONTH_COLUMNS:
                        converters[col.name] = lambda v: _add_months(date.fromisoformat(v), month_shift)
                    else:
                        converters[col.name] = lambda v: date.fromisoformat(v) + day_shift
                elif isinstance(t, Enum) and t.enum_class is not None:
                    converters[col.name] = t.enum_class
                elif isinstance(t, Numeric) and t.asdecimal:
                    converters[col.name] = Decimal
            conn.execute(insert(table), [
                {k: (converters[k](v) if v is not None and k in converters else v) for k, v in row.items()}
                for row in rows
            ])


# ------------------------------------------------------------------ request sessions
_lock = threading.Lock()  # serializes sample requests: they all share one SQLite connection
_factory: sessionmaker[Session] | None = None


def _session_factory() -> sessionmaker[Session]:
    global _factory
    if _factory is None:
        engine = new_memory_engine()
        load(engine, json.loads(SAMPLE_FILE.read_text(encoding="utf-8")))
        _factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    return _factory


def sample_session() -> Iterator[Session]:
    with _lock:
        db = _session_factory()()
        try:
            yield db
        finally:
            db.close()
