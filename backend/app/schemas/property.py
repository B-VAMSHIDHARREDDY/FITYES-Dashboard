from datetime import date

from pydantic import Field, computed_field

from app.core.time import days_since
from app.models.enums import ListingStatus, PropertyType
from app.schemas.common import Schema


class AgentRef(Schema):
    id: int
    name: str
    title: str
    avatar_color: str


class PropertyOut(Schema):
    id: int
    code: str
    title: str
    address: str
    city: str
    neighborhood: str
    state: str
    zip_code: str
    property_type: PropertyType
    status: ListingStatus
    list_price: float
    sold_price: float | None
    bedrooms: int
    bathrooms: float
    area_sqm: int
    plot_sqm: int | None
    year_built: int | None
    hoa_monthly: float
    tax_annual: float
    listed_at: date
    sold_at: date | None
    description: str | None
    agent: AgentRef | None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def days_on_market(self) -> int:
        return days_since(self.listed_at, self.sold_at)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def price_per_sqm(self) -> float:
        return round((self.sold_price or self.list_price) / self.area_sqm, 2) if self.area_sqm else 0.0


class PropertyCreate(Schema):
    title: str = Field(min_length=3, max_length=160)
    address: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    neighborhood: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=2)
    zip_code: str = Field(min_length=3, max_length=10)
    property_type: PropertyType
    list_price: float = Field(gt=0, le=1_000_000_000)
    bedrooms: int = Field(ge=0, le=50)
    bathrooms: float = Field(ge=0, le=50)
    area_sqm: int = Field(gt=0, le=1_000_000)
    plot_sqm: int | None = Field(default=None, ge=0)
    year_built: int | None = Field(default=None, ge=1700, le=2100)
    hoa_monthly: float = Field(default=0, ge=0)
    tax_annual: float = Field(default=0, ge=0)
    description: str | None = Field(default=None, max_length=4000)
    agent_id: int | None = None


class PropertyUpdate(Schema):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    status: ListingStatus | None = None
    list_price: float | None = Field(default=None, gt=0, le=1_000_000_000)
    description: str | None = Field(default=None, max_length=4000)
    agent_id: int | None = None
