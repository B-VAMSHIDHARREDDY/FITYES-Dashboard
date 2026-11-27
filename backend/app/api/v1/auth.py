from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import UnauthorizedError
from app.core.security import CurrentUser, auth_db, authenticate, create_access_token
from app.schemas.auth import LoginIn, LoginOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: Annotated[Session, Depends(auth_db)]):
    user = authenticate(db, body.user_id, body.password)
    if user is None:
        raise UnauthorizedError("Invalid User ID or password", code="invalid_credentials")
    return LoginOut(access_token=create_access_token(user), expires_in=settings.jwt_expire_minutes * 60,
                    user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
