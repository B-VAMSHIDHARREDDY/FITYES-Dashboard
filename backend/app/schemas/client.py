from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import Schema


class PartnerOut(Schema):
    """A client row as delivered in the partner list (Excel)."""

    id: int
    name: str
    email: str | None
    street: str | None
    postal_code: str | None
    city: str | None
    invoice_paid_at: date | None


class PartnerUpdate(BaseModel):
    """Fill in missing partner data. Only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(None, min_length=1, max_length=120)
    email: str | None = Field(None, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
    street: str | None = Field(None, min_length=1, max_length=200)
    postal_code: str | None = Field(None, pattern=r"^\d{4,5}$")
    city: str | None = Field(None, min_length=1, max_length=80)
    invoice_paid_at: date | None = None

    @field_validator("invoice_paid_at")
    @classmethod
    def _not_future(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("payment date cannot be in the future")
        return v
