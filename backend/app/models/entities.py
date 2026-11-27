"""Domain tables. Enums are stored as constrained VARCHARs (portable, migration-friendly)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, fk
from app.models.enums import (
    ActivityKind,
    ChecklistKind,
    ClientKind,
    DealStage,
    ListingStatus,
    PropertyType,
)


def _enum(e: type, name: str) -> Enum:
    return Enum(e, name=name, native_enum=False, length=32, values_callable=lambda x: [m.value for m in x])


Money = Numeric(14, 2)


class User(Base, TimestampMixin):
    """Someone who can sign in to the dashboard. Lives only in the real schema, never the sample one."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), unique=True)  # login name, stored lower-case
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="member")
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Agent(Base, TimestampMixin):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(80), default="Agent")
    region: Mapped[str] = mapped_column(String(80))
    avatar_color: Mapped[str] = mapped_column(String(9), default="#0f766e")

    properties: Mapped[list[Property]] = relationship(back_populates="agent")
    deals: Mapped[list[Deal]] = relationship(back_populates="agent")


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    kind: Mapped[ClientKind] = mapped_column(_enum(ClientKind, "client_kind"))
    pre_approved_amount: Mapped[Decimal | None] = mapped_column(Money)
    # Postal address + payment date, as delivered in the partner list (scripts/import_partners.py).
    street: Mapped[str | None] = mapped_column(String(200))
    postal_code: Mapped[str | None] = mapped_column(String(10))
    city: Mapped[str | None] = mapped_column(String(80))
    invoice_paid_at: Mapped[date | None] = mapped_column(Date)


class Property(Base, TimestampMixin):
    __tablename__ = "properties"
    __table_args__ = (
        Index("ix_properties_status_city", "status", "city"),
        Index("ix_properties_list_price", "list_price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    title: Mapped[str] = mapped_column(String(160))
    address: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(80))
    neighborhood: Mapped[str] = mapped_column(String(80), index=True)
    state: Mapped[str] = mapped_column(String(2))
    zip_code: Mapped[str] = mapped_column(String(10))
    property_type: Mapped[PropertyType] = mapped_column(_enum(PropertyType, "property_type"))
    status: Mapped[ListingStatus] = mapped_column(_enum(ListingStatus, "listing_status"))
    list_price: Mapped[Decimal] = mapped_column(Money)
    sold_price: Mapped[Decimal | None] = mapped_column(Money)
    bedrooms: Mapped[int] = mapped_column(Integer, default=0)
    bathrooms: Mapped[Decimal] = mapped_column(Numeric(3, 1), default=0)
    area_sqm: Mapped[int] = mapped_column(Integer)
    plot_sqm: Mapped[int | None] = mapped_column(Integer)
    year_built: Mapped[int | None] = mapped_column(Integer)
    hoa_monthly: Mapped[Decimal] = mapped_column(Money, default=0)
    tax_annual: Mapped[Decimal] = mapped_column(Money, default=0)
    listed_at: Mapped[date] = mapped_column(Date)
    sold_at: Mapped[date | None] = mapped_column(Date)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False))
    description: Mapped[str | None] = mapped_column(Text)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey(fk("agents.id"), ondelete="SET NULL"))

    agent: Mapped[Agent | None] = relationship(back_populates="properties")
    deals: Mapped[list[Deal]] = relationship(back_populates="property")


class Deal(Base, TimestampMixin):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    property_id: Mapped[int] = mapped_column(ForeignKey(fk("properties.id"), ondelete="CASCADE"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey(fk("clients.id"), ondelete="RESTRICT"))
    agent_id: Mapped[int | None] = mapped_column(ForeignKey(fk("agents.id"), ondelete="SET NULL"), index=True)
    stage: Mapped[DealStage] = mapped_column(_enum(DealStage, "deal_stage"), index=True)
    stage_entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    target_close_date: Mapped[date | None] = mapped_column(Date)
    closed_at: Mapped[date | None] = mapped_column(Date)
    lost_reason: Mapped[str | None] = mapped_column(String(200))
    # Stored as stable keys (e.g. "immoscout24", "annuity_loan"); the UI translates them.
    channel: Mapped[str] = mapped_column(String(40), default="referral")
    financing: Mapped[str] = mapped_column(String(40), default="annuity_loan")

    # Offer terms (versioned: every saved change bumps `offer_version`)
    offer_price: Mapped[Decimal] = mapped_column(Money)
    down_payment_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=20)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 3), default=3.8)
    loan_term_years: Mapped[int] = mapped_column(Integer, default=30)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.0357"))
    offer_version: Mapped[int] = mapped_column(Integer, default=1)

    property: Mapped[Property] = relationship(back_populates="deals")
    client: Mapped[Client] = relationship()
    agent: Mapped[Agent | None] = relationship(back_populates="deals")
    stage_events: Mapped[list[DealStageEvent]] = relationship(
        back_populates="deal", order_by="DealStageEvent.entered_at", cascade="all, delete-orphan"
    )
    checklist: Mapped[list[DealChecklistItem]] = relationship(
        back_populates="deal", order_by="DealChecklistItem.id", cascade="all, delete-orphan"
    )


class DealStageEvent(Base):
    __tablename__ = "deal_stage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey(fk("deals.id"), ondelete="CASCADE"), index=True)
    stage: Mapped[DealStage] = mapped_column(_enum(DealStage, "deal_stage"))
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    deal: Mapped[Deal] = relationship(back_populates="stage_events")


class DealChecklistItem(Base):
    __tablename__ = "deal_checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey(fk("deals.id"), ondelete="CASCADE"), index=True)
    stage: Mapped[DealStage] = mapped_column(_enum(DealStage, "deal_stage"))
    kind: Mapped[ChecklistKind] = mapped_column(_enum(ChecklistKind, "checklist_kind"))
    code: Mapped[str | None] = mapped_column(String(64))  # translation key for template items
    title: Mapped[str] = mapped_column(String(200))
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    deal: Mapped[Deal] = relationship(back_populates="checklist")


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (Index("ix_activities_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[ActivityKind] = mapped_column(_enum(ActivityKind, "activity_kind"))
    message: Mapped[str] = mapped_column(String(300))  # English fallback / audit text
    payload: Mapped[dict | None] = mapped_column(JSON)  # structured params for localized rendering
    deal_id: Mapped[int | None] = mapped_column(ForeignKey(fk("deals.id"), ondelete="CASCADE"), index=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey(fk("properties.id"), ondelete="CASCADE"))
    agent_id: Mapped[int | None] = mapped_column(ForeignKey(fk("agents.id"), ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    agent: Mapped[Agent | None] = relationship()


class MarketSnapshot(Base):
    """Monthly market statistics per neighborhood (fed by an MLS/ETL job in production)."""

    __tablename__ = "market_snapshots"
    __table_args__ = (UniqueConstraint("neighborhood", "month", name="uq_market_snapshots_hood_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    city: Mapped[str] = mapped_column(String(80))
    neighborhood: Mapped[str] = mapped_column(String(80))
    month: Mapped[date] = mapped_column(Date, index=True)
    median_price: Mapped[Decimal] = mapped_column(Money)
    price_per_sqm: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    inventory: Mapped[int] = mapped_column(Integer)
    new_listings: Mapped[int] = mapped_column(Integer)
    closed_sales: Mapped[int] = mapped_column(Integer)
    avg_days_on_market: Mapped[int] = mapped_column(Integer)
