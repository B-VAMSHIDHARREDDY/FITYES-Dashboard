"""Read-side aggregates for the dashboard, market and agent views."""

from collections import defaultdict
from datetime import date, timedelta
from statistics import median

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.time import utcnow
from app.models import Activity, Agent, Deal, DealChecklistItem, MarketSnapshot, Property
from app.models.enums import OPEN_STAGES, DealStage, ListingStatus
from app.schemas.analytics import (
    AgentStats,
    DashboardSummary,
    Kpi,
    NavCounts,
    NeighborhoodStat,
    PipelineStage,
    TrendPoint,
)
from app.schemas.property import AgentRef


def _pct(cur: float, prev: float) -> float | None:
    return round((cur - prev) / prev * 100, 1) if prev else None


def _month_start(d: date, back: int = 0) -> date:
    y, m = divmod(d.year * 12 + d.month - 1 - back, 12)
    return date(y, m + 1, 1)


def dashboard_summary(db: Session) -> DashboardSummary:
    today = utcnow().date()
    d30, d60, d90, d180 = (today - timedelta(days=n) for n in (30, 60, 90, 180))
    first_month = _month_start(today, 11)

    active = db.scalar(select(func.count()).where(Property.status == ListingStatus.ACTIVE)) or 0
    new_30 = db.scalar(select(func.count()).where(Property.listed_at >= d30)) or 0
    new_prev = db.scalar(select(func.count()).where(Property.listed_at >= d60, Property.listed_at < d30)) or 0

    sold = db.execute(
        select(Property.sold_at, Property.sold_price, Property.listed_at)
        .where(Property.status == ListingStatus.SOLD, Property.sold_at >= min(first_month, d180))
    ).all()

    def window(rows, start, end):
        return [r for r in rows if start <= r.sold_at < end]

    cur90, prev90 = window(sold, d90, today + timedelta(days=1)), window(sold, d180, d90)
    vol_cur = sum(float(r.sold_price) for r in window(sold, d30, today + timedelta(days=1)))
    vol_prev = sum(float(r.sold_price) for r in window(sold, d60, d30))
    med_cur = median([float(r.sold_price) for r in cur90]) if cur90 else 0.0
    med_prev = median([float(r.sold_price) for r in prev90]) if prev90 else 0.0
    dom_cur = sum((r.sold_at - r.listed_at).days for r in cur90) / len(cur90) if cur90 else 0.0
    dom_prev = sum((r.sold_at - r.listed_at).days for r in prev90) / len(prev90) if prev90 else 0.0

    monthly_vol: dict[date, float] = defaultdict(float)
    monthly_count: dict[date, int] = defaultdict(int)
    for r in sold:
        if r.sold_at >= first_month:
            key = _month_start(r.sold_at)
            monthly_vol[key] += float(r.sold_price)
            monthly_count[key] += 1
    months = [_month_start(today, back) for back in range(11, -1, -1)]

    pipeline_value, commission = db.execute(
        select(func.coalesce(func.sum(Deal.offer_price), 0),
               func.coalesce(func.sum(Deal.offer_price * Deal.commission_rate), 0))
        .where(Deal.stage.in_(OPEN_STAGES))
    ).one()

    market = db.execute(
        select(MarketSnapshot.month, func.avg(MarketSnapshot.median_price), func.sum(MarketSnapshot.inventory))
        .where(MarketSnapshot.month >= first_month)
        .group_by(MarketSnapshot.month).order_by(MarketSnapshot.month)
    ).all()

    kpis = [
        Kpi(key="active_listings", label="Active listings", value=active, format="number",
            delta_pct=_pct(new_30, new_prev), hint=f"{new_30} new in the last 30 days", meta={"n": new_30},
            trend=[float(m[2]) for m in market]),
        Kpi(key="sales_volume", label="Sales volume · 30d", value=vol_cur, format="currency",
            delta_pct=_pct(vol_cur, vol_prev), hint="Closed sales vs. prior 30 days",
            trend=[monthly_vol.get(m, 0.0) for m in months]),
        Kpi(key="median_sale", label="Median sale price", value=med_cur, format="currency",
            delta_pct=_pct(med_cur, med_prev), hint="Trailing 90 days",
            trend=[float(m[1]) for m in market]),
        Kpi(key="days_on_market", label="Avg. days on market", value=round(dom_cur, 1), format="days",
            delta_pct=_pct(dom_cur, dom_prev), hint="Listing to close, trailing 90 days",
            trend=[float(monthly_count.get(m, 0)) for m in months]),
        Kpi(key="pipeline_value", label="Open pipeline", value=float(pipeline_value), format="currency",
            delta_pct=None, hint=f"EUR {float(commission):,.0f} projected commission", meta={"v": float(commission)},
            trend=[]),
    ]
    return DashboardSummary(generated_at=utcnow(), kpis=kpis)


def pipeline(db: Session) -> list[PipelineStage]:
    rows = dict(
        (stage, (count, value))
        for stage, count, value in db.execute(
            select(Deal.stage, func.count(Deal.id), func.coalesce(func.sum(Deal.offer_price), 0))
            .group_by(Deal.stage)
        ).all()
    )
    return [
        PipelineStage(stage=s, count=rows.get(s, (0, 0))[0], value=float(rows.get(s, (0, 0))[1]))
        for s in (*OPEN_STAGES, DealStage.CLOSED, DealStage.LOST)
    ]


def nav_counts(db: Session) -> NavCounts:
    listings = db.scalar(select(func.count()).where(Property.status == ListingStatus.ACTIVE)) or 0
    deals = db.scalar(select(func.count()).where(Deal.stage.in_(OPEN_STAGES))) or 0
    attention = db.scalar(
        select(func.count(func.distinct(Deal.id)))
        .join(DealChecklistItem, DealChecklistItem.deal_id == Deal.id)
        .where(Deal.stage.in_(OPEN_STAGES), DealChecklistItem.stage == Deal.stage,
               DealChecklistItem.done.is_(False))
    ) or 0
    return NavCounts(listings=listings, deals=deals, attention=attention)


def market_trends(db: Session, *, neighborhood: str | None, months: int) -> list[TrendPoint]:
    start = _month_start(utcnow().date(), months - 1)
    stmt = (
        select(
            MarketSnapshot.month,
            func.avg(MarketSnapshot.median_price),
            func.avg(MarketSnapshot.price_per_sqm),
            func.sum(MarketSnapshot.inventory),
            func.sum(MarketSnapshot.new_listings),
            func.sum(MarketSnapshot.closed_sales),
            func.avg(MarketSnapshot.avg_days_on_market),
        )
        .where(MarketSnapshot.month >= start)
        .group_by(MarketSnapshot.month)
        .order_by(MarketSnapshot.month)
    )
    if neighborhood:
        stmt = stmt.where(MarketSnapshot.neighborhood == neighborhood)
    return [
        TrendPoint(month=r[0], median_price=round(float(r[1]), 0), price_per_sqm=round(float(r[2]), 2),
                   inventory=int(r[3]), new_listings=int(r[4]), closed_sales=int(r[5]),
                   avg_days_on_market=round(float(r[6]), 1))
        for r in db.execute(stmt).all()
    ]


def neighborhood_stats(db: Session) -> list[NeighborhoodStat]:
    start = _month_start(utcnow().date(), 12)
    snaps = db.scalars(
        select(MarketSnapshot).where(MarketSnapshot.month >= start).order_by(MarketSnapshot.month)
    ).all()
    by_hood: dict[str, list[MarketSnapshot]] = defaultdict(list)
    for s in snaps:
        by_hood[s.neighborhood].append(s)

    out: list[NeighborhoodStat] = []
    for hood, series in by_hood.items():
        latest, first = series[-1], series[0]
        sales = max(latest.closed_sales, 1)
        out.append(NeighborhoodStat(
            neighborhood=hood, city=latest.city, median_price=float(latest.median_price),
            yoy_pct=_pct(float(latest.median_price), float(first.median_price)) or 0.0,
            price_per_sqm=float(latest.price_per_sqm), inventory=latest.inventory,
            avg_days_on_market=latest.avg_days_on_market,
            months_of_supply=round(latest.inventory / sales, 1),
            sparkline=[float(s.median_price) for s in series[-12:]],
        ))
    return sorted(out, key=lambda n: n.median_price, reverse=True)


def agent_leaderboard(db: Session) -> list[AgentStats]:
    deal_agg = (
        select(
            Deal.agent_id.label("agent_id"),
            func.sum(case((Deal.stage.in_(OPEN_STAGES), 1), else_=0)).label("open_deals"),
            func.sum(case((Deal.stage == DealStage.CLOSED, 1), else_=0)).label("closed_deals"),
            func.sum(case((Deal.stage == DealStage.CLOSED, Deal.offer_price), else_=0)).label("closed_volume"),
            func.sum(case((Deal.stage.in_(OPEN_STAGES), Deal.offer_price), else_=0)).label("pipeline_value"),
            func.sum(case((Deal.stage == DealStage.CLOSED, Deal.offer_price * Deal.commission_rate),
                          else_=0)).label("commission"),
        ).group_by(Deal.agent_id).subquery()
    )
    listing_agg = (
        select(Property.agent_id.label("agent_id"), func.count(Property.id).label("active"))
        .where(Property.status == ListingStatus.ACTIVE)
        .group_by(Property.agent_id).subquery()
    )
    rows = db.execute(
        select(Agent, deal_agg, listing_agg.c.active)
        .outerjoin(deal_agg, deal_agg.c.agent_id == Agent.id)
        .outerjoin(listing_agg, listing_agg.c.agent_id == Agent.id)
    ).all()
    stats = [
        AgentStats(
            agent=AgentRef.model_validate(r.Agent), region=r.Agent.region,
            active_listings=r.active or 0, open_deals=r.open_deals or 0, closed_deals=r.closed_deals or 0,
            closed_volume=float(r.closed_volume or 0), pipeline_value=float(r.pipeline_value or 0),
            commission_earned=float(r.commission or 0),
        )
        for r in rows
    ]
    return sorted(stats, key=lambda s: s.closed_volume, reverse=True)


def recent_activity(db: Session, *, limit: int, deal_id: int | None) -> list[Activity]:
    stmt = select(Activity).options(joinedload(Activity.agent)).order_by(Activity.created_at.desc(), Activity.id.desc())
    if deal_id:
        stmt = stmt.where(Activity.deal_id == deal_id)
    return list(db.scalars(stmt.limit(limit)))
