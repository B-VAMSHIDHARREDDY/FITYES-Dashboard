from app.db.session import SessionLocal
from app.models import User
from tests.conftest import TEST_USER

API = "/api/v1"


def test_health_is_public(anon_client):
    assert anon_client.get(f"{API}/health").status_code == 200


def test_data_endpoints_require_sign_in(anon_client):
    for path in ("/meta/counts", "/properties", "/deals", "/clients", "/dashboard/summary"):
        res = anon_client.get(f"{API}{path}")
        assert res.status_code == 401, path
        assert res.json()["code"] == "unauthorized"
        assert res.headers["www-authenticate"] == "Bearer"


def test_login_returns_token_and_user(anon_client):
    res = anon_client.post(f"{API}/auth/login", json={"user_id": "  TESTER ", "password": TEST_USER["password"]})
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["user"]["user_id"] == "tester"
    assert "password_hash" not in body["user"]

    me = anon_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["name"] == "Test User"


def test_login_rejects_bad_credentials(anon_client):
    for creds in ({"user_id": "tester", "password": "wrong"}, {"user_id": "nobody", "password": "x"}):
        res = anon_client.post(f"{API}/auth/login", json=creds)
        assert res.status_code == 401
        assert res.json()["code"] == "invalid_credentials"


def test_garbage_token_is_rejected(anon_client):
    res = anon_client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401


def test_deactivated_user_loses_access(client):
    assert client.get(f"{API}/auth/me").status_code == 200
    with SessionLocal() as db:
        db.query(User).filter_by(user_id="tester").update({"is_active": False})
        db.commit()
    assert client.get(f"{API}/auth/me").status_code == 401
