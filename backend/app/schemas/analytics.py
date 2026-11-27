from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.core.time import UtcDatetime
from app.models.enums import ActivityKind, DealStage
from app.schemas.common import Schema
from app.schemas.property import AgentRef


class Kpi(BaseModel):
    key: str
    label: str
    value: float
    format: Literal["number", "currency", "days", "percent"]
    delta_pct: float | None
    hint: str
    meta: dict[str, float] = {}
    trend: list[float]


class DashboardSummary(BaseModel):
    generated_at: UtcDatetime
    kpis: list[Kpi]


class PipelineStage(BaseModel):
    stage: DealStage
    count: int
    value: float


class NavCounts(BaseModel):
    listings: int
    deals: int
    attention: int


class TrendPoint(BaseModel):
    month: date
    median_price: float
    price_per_sqm: float
    inventory: int
    new_listings: int
    closed_sales: int
    avg_days_on_market: float


class NeighborhoodStat(BaseModel):
    neighborhood: str
    city: str
    median_price: float
    yoy_pct: float
    price_per_sqm: float
    inventory: int
    avg_days_on_market: int
    months_of_supply: float
    sparkline: list[float]


class AgentStats(BaseModel):
    agent: AgentRef
    region: str
    active_listings: int
    open_deals: int
    closed_deals: int
    closed_volume: float
    pipeline_value: float
    commission_earned: float


class ActivityOut(Schema):
    id: int
    kind: ActivityKind
    message: str
    payload: dict | None
    deal_id: int | None
    property_id: int | None
    agent: AgentRef | None
    created_at: UtcDatetime
