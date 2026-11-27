"""Test harness: a throw-away SQLite DB seeded with the demo dataset.

DATABASE_URL must be set before any `app.*` import, since settings bind at import time.
"""

import os
from pathlib import Path

DB_FILE = Path(__file__).parent / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE.as_posix()}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, User  # noqa: E402

TEST_USER = {"user_id": "tester", "password": "correct-horse-battery"}
_TEST_HASH = hash_password(TEST_USER["password"])  # bcrypt is slow; hash once per session


@pytest.fixture(autouse=True)
def fresh_db():
    from scripts.seed import seed

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
        db.add(User(user_id=TEST_USER["user_id"], name="Test User", role="admin", password_hash=_TEST_HASH))
        db.commit()
    yield
    engine.dispose()


@pytest.fixture
def anon_client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def client(anon_client: TestClient) -> TestClient:
    """A client signed in as the test user."""
    res = anon_client.post("/api/v1/auth/login", json=TEST_USER)
    assert res.status_code == 200, res.text
    anon_client.headers["Authorization"] = f"Bearer {res.json()['access_token']}"
    return anon_client


@pytest.fixture
def hero_deal_id(client: TestClient) -> int:
    page = client.get("/api/v1/deals", params={"q": "DL-0915-7731"}).json()
    return page["items"][0]["id"]
