"""Password hashing (bcrypt), JWT access tokens and the `current_user` dependency."""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import UnauthorizedError
from app.db.session import SessionLocal
from app.models import User

log = logging.getLogger("fityes.auth")

JWT_ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)

if settings.jwt_secret:
    _SECRET = settings.jwt_secret
else:
    if settings.environment == "production":
        raise RuntimeError("JWT_SECRET must be set in production")
    _SECRET = secrets.token_urlsafe(48)
    log.warning("JWT_SECRET not set - using a random secret; sessions end when the API restarts")


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    # bcrypt only reads the first 72 bytes (and bcrypt>=4.1 raises beyond that), so truncate explicitly.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# Compared against when the user doesn't exist, so a wrong user ID takes as long as a wrong password.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ---------------------------------------------------------------- tokens
def create_access_token(user: User) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "uid": user.user_id,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, _SECRET, algorithm=JWT_ALGORITHM)


# ---------------------------------------------------------------- users
def find_user(db: Session, user_id: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.user_id) == user_id.strip().lower()))


def authenticate(db: Session, user_id: str, password: str) -> User | None:
    user = find_user(db, user_id)
    if user is None or not user.is_active:
        verify_password(password, _DUMMY_HASH)
        return None
    return user if verify_password(password, user.password_hash) else None


def auth_db():
    """Users always live in the real schema, even when a request asks for the sample dataset."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(auth_db)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Not signed in")
    try:
        payload = jwt.decode(credentials.credentials, _SECRET, algorithms=[JWT_ALGORITHM])
        user_pk = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Your session has expired. Please sign in again.", code="session_expired")
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise UnauthorizedError("Invalid session. Please sign in again.")
    user = db.get(User, user_pk)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid session. Please sign in again.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def ensure_initial_admin() -> None:
    """Create the first admin when nobody can sign in yet. Safe to call on every startup."""
    with SessionLocal() as db:
        if db.scalar(select(func.count(User.id))):
            return
        password = settings.initial_admin_password
        generated = not password
        if generated:
            password = secrets.token_urlsafe(12)
        uid = settings.initial_admin_user_id.strip().lower()
        db.add(User(user_id=uid, name=settings.initial_admin_name.strip(), role="admin",
                    password_hash=hash_password(password)))
        db.commit()
    if generated:
        banner = "=" * 64
        print(f"{banner}\n  Initial admin created\n  User ID : {uid}\n  Password: {password}\n"
              f"  Shown only once - set INITIAL_ADMIN_PASSWORD or use scripts.create_user.\n{banner}", flush=True)
    else:
        log.info("Created initial admin user '%s'", uid)
