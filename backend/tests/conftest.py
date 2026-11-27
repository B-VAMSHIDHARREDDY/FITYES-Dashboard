"""Test harness: a throw-away SQLite DB seeded with the demo dataset.

DATABASE_URL must be set before any `app.*` import, since settings bind at import time.
"""

import os
from pathlib import Path

DB_FILE = Path(__file__).parent / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE.as_posix()}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    from scripts.seed import seed

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield
    engine.dispose()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def hero_deal_id(client: TestClient) -> int:
    page = client.get("/api/v1/deals", params={"q": "DL-0915-7731"}).json()
    return page["items"][0]["id"]
