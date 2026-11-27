"""Engine + session factory. One engine per process, sessions per request."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _build_engine() -> Engine:
    if settings.is_sqlite:
        engine = create_engine(
            settings.sqlalchemy_url,
            echo=settings.db_echo,
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(engine, "connect")
        def _enable_fk(dbapi_conn, _):  # pragma: no cover - sqlite only
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine

    return create_engine(
        settings.sqlalchemy_url,
        echo=settings.db_echo,
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=1800,
        connect_args={"connect_timeout": 10, "application_name": "fityes-api"},
    )


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Same pool, but every table in the app schema is transparently redirected to the sample schema.
SAMPLE_HEADER = "x-sample-data"
sample_engine = (
    engine.execution_options(schema_translate_map={settings.db_schema: settings.sample_schema})
    if settings.sample_supported
    else None
)
SampleSessionLocal = (
    sessionmaker(bind=sample_engine, autoflush=False, expire_on_commit=False) if sample_engine is not None else None
)


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: yields a session and guarantees cleanup.

    `X-Sample-Data: 1` switches the request to the demo dataset (separate schema, never the real data).
    """
    use_sample = request.headers.get(SAMPLE_HEADER) == "1" and SampleSessionLocal is not None
    db = (SampleSessionLocal if use_sample else SessionLocal)()  # type: ignore[misc]
    try:
        yield db
    finally:
        db.close()
