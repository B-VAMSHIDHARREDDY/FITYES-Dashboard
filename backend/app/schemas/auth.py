from pydantic import BaseModel, Field

from app.schemas.common import Schema


class LoginIn(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class UserOut(Schema):
    id: int
    user_id: str
    name: str
    email: str | None
    role: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
