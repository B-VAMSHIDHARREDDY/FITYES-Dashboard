from datetime import date

from pydantic import BaseModel, Field

from app.core.time import UtcDatetime
from app.models.enums import ChecklistKind, ClientKind, DealStage
from app.schemas.common import Schema
from app.schemas.property import AgentRef, PropertyOut


class ClientOut(Schema):
    id: int
    name: str
    email: str | None
    phone: str | None
    kind: ClientKind
    pre_approved_amount: float | None


class StageEventOut(Schema):
    stage: DealStage
    entered_at: UtcDatetime


class ChecklistItemOut(Schema):
    id: int
    stage: DealStage
    kind: ChecklistKind
    code: str | None
    title: str
    done: bool
    done_at: UtcDatetime | None


class OfferTerms(Schema):
    offer_price: float
    down_payment_pct: float
    interest_rate: float
    loan_term_years: int
    commission_rate: float
    offer_version: int


class OfferBreakdownOut(BaseModel):
    offer_price: float
    list_price: float
    delta_vs_list: float
    delta_vs_list_pct: float
    down_payment: float
    loan_amount: float
    monthly_principal_interest: float
    monthly_tax: float
    monthly_hoa: float
    monthly_total: float
    commission: float


class DealListItem(BaseModel):
    id: int
    code: str
    stage: DealStage
    stage_entered_at: UtcDatetime
    days_in_stage: int
    target_close_date: date | None
    offer_price: float
    list_price: float
    property_id: int
    property_title: str
    property_address: str
    neighborhood: str
    city: str
    client_name: str
    agent: AgentRef | None
    open_items: int


class DealDetail(BaseModel):
    id: int
    code: str
    stage: DealStage
    stage_entered_at: UtcDatetime
    days_in_stage: int
    target_close_date: date | None
    closed_at: date | None
    lost_reason: str | None
    channel: str
    financing: str
    created_at: UtcDatetime
    property: PropertyOut
    client: ClientOut
    agent: AgentRef | None
    offer: OfferTerms
    breakdown: OfferBreakdownOut
    stage_events: list[StageEventOut]
    checklist: list[ChecklistItemOut]


class OfferUpdate(BaseModel):
    offer_price: float = Field(gt=0, le=1_000_000_000)
    down_payment_pct: float = Field(ge=0, le=100)
    interest_rate: float = Field(ge=0, le=25)
    loan_term_years: int = Field(ge=5, le=40)
    commission_rate: float = Field(ge=0, le=0.1)


class ChecklistToggle(BaseModel):
    done: bool


class MarkLost(BaseModel):
    reason: str = Field(min_length=3, max_length=200)
