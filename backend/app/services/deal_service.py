from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.errors import ConflictError, NotFoundError
from app.core.time import as_utc, days_since, utcnow
from app.models import Activity, Client, Deal, DealChecklistItem, DealStageEvent, Property
from app.models.enums import ActivityKind, DealStage, ListingStatus
from app.schemas.deal import (
    DealDetail,
    DealListItem,
    OfferBreakdownOut,
    OfferTerms,
    OfferUpdate,
)
from app.schemas.property import AgentRef, PropertyOut
from app.services.deal_rules import OFFER_EDITABLE_STAGES, STAGE_CHECKLIST, next_stage, stage_label
from app.services.finance import offer_breakdown

_open_items_sq = (
    select(func.count(DealChecklistItem.id))
    .where(and_(DealChecklistItem.deal_id == Deal.id,
                DealChecklistItem.stage == Deal.stage,
                DealChecklistItem.done.is_(False)))
    .correlate(Deal)
    .scalar_subquery()
)


def list_deals(
    db: Session, *, stage: DealStage | None, q: str | None, agent_id: int | None, page: int, page_size: int
) -> tuple[list[DealListItem], int]:
    stmt = select(Deal, _open_items_sq.label("open_items")).join(Deal.property).join(Deal.client)
    if stage:
        stmt = stmt.where(Deal.stage == stage)
    if agent_id:
        stmt = stmt.where(Deal.agent_id == agent_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Deal.code.ilike(like), Property.title.ilike(like), Client.name.ilike(like)))

    total = db.scalar(select(func.count()).select_from(stmt.with_only_columns(Deal.id).subquery())) or 0
    rows = db.execute(
        stmt.options(joinedload(Deal.property), joinedload(Deal.client), joinedload(Deal.agent))
        .order_by(Deal.stage_entered_at.desc(), Deal.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        DealListItem(
            id=d.id, code=d.code, stage=d.stage, stage_entered_at=as_utc(d.stage_entered_at),
            days_in_stage=days_since(d.stage_entered_at), target_close_date=d.target_close_date,
            offer_price=float(d.offer_price), list_price=float(d.property.list_price),
            property_id=d.property_id, property_title=d.property.title,
            property_address=d.property.address, neighborhood=d.property.neighborhood,
            city=d.property.city, client_name=d.client.name,
            agent=AgentRef.model_validate(d.agent) if d.agent else None,
            open_items=open_items,
        )
        for d, open_items in rows
    ]
    return items, total


def _load(db: Session, deal_id: int) -> Deal:
    deal = db.scalar(
        select(Deal)
        .options(
            joinedload(Deal.property).joinedload(Property.agent),
            joinedload(Deal.client),
            joinedload(Deal.agent),
            selectinload(Deal.stage_events),
            selectinload(Deal.checklist),
        )
        .where(Deal.id == deal_id)
    )
    if deal is None:
        raise NotFoundError(f"Deal {deal_id} not found")
    return deal


def _to_detail(deal: Deal) -> DealDetail:
    prop = deal.property
    breakdown = offer_breakdown(
        offer_price=float(deal.offer_price), list_price=float(prop.list_price),
        down_payment_pct=float(deal.down_payment_pct), interest_rate=float(deal.interest_rate),
        loan_term_years=deal.loan_term_years, commission_rate=float(deal.commission_rate),
        tax_annual=float(prop.tax_annual), hoa_monthly=float(prop.hoa_monthly),
    )
    return DealDetail(
        id=deal.id, code=deal.code, stage=deal.stage, stage_entered_at=as_utc(deal.stage_entered_at),
        days_in_stage=days_since(deal.stage_entered_at), target_close_date=deal.target_close_date,
        closed_at=deal.closed_at, lost_reason=deal.lost_reason, channel=deal.channel,
        financing=deal.financing, created_at=as_utc(deal.created_at),
        property=PropertyOut.model_validate(prop),
        client=deal.client,  # type: ignore[arg-type]
        agent=AgentRef.model_validate(deal.agent) if deal.agent else None,
        offer=OfferTerms.model_validate(deal),
        breakdown=OfferBreakdownOut(**breakdown.to_dict()),
        stage_events=[{"stage": e.stage, "entered_at": as_utc(e.entered_at)} for e in deal.stage_events],  # type: ignore[misc]
        checklist=deal.checklist,  # type: ignore[arg-type]
    )


def get_deal(db: Session, deal_id: int) -> DealDetail:
    return _to_detail(_load(db, deal_id))


def update_offer(db: Session, deal_id: int, data: OfferUpdate) -> DealDetail:
    deal = _load(db, deal_id)
    if deal.stage not in OFFER_EDITABLE_STAGES:
        raise ConflictError(f"Offer terms are locked once a deal is {stage_label(deal.stage).lower()}",
                            code="offer_locked", stage=deal.stage.value)

    current = OfferTerms.model_validate(deal).model_dump(exclude={"offer_version"})
    incoming = data.model_dump()
    if all(abs(float(current[k]) - float(v)) < 1e-9 for k, v in incoming.items()):
        return _to_detail(deal)

    for key, value in incoming.items():
        setattr(deal, key, value)
    deal.offer_version += 1
    list_price = float(deal.property.list_price)
    pct = (data.offer_price - list_price) / list_price * 100
    db.add(Activity(
        kind=ActivityKind.OFFER_UPDATED, deal_id=deal.id, property_id=deal.property_id, agent_id=deal.agent_id,
        message=f"{deal.code} offer v{deal.offer_version}: EUR {data.offer_price:,.0f} ({pct:+.1f}% vs list)",
        payload={"code": deal.code, "version": deal.offer_version, "price": data.offer_price, "pct": round(pct, 1)},
    ))
    db.commit()
    return get_deal(db, deal_id)


def advance_deal(db: Session, deal_id: int) -> DealDetail:
    deal = _load(db, deal_id)
    target = next_stage(deal.stage)
    if target is None:
        raise ConflictError(f"Deal is already {stage_label(deal.stage).lower()}", code="deal_terminal",
                            stage=deal.stage.value)

    blocking = [i for i in deal.checklist if i.stage == deal.stage and not i.done]
    if blocking:
        raise ConflictError(
            f"{len(blocking)} open item(s) must be resolved before moving to {stage_label(target)}",
            code="checklist_open", count=len(blocking), stage=target.value,
        )

    now = utcnow()
    deal.stage = target
    deal.stage_entered_at = now
    deal.stage_events.append(DealStageEvent(stage=target, entered_at=now))
    for kind, code, title in STAGE_CHECKLIST.get(target, []):
        deal.checklist.append(DealChecklistItem(stage=target, kind=kind, code=code, title=title))

    prop = deal.property
    if target == DealStage.UNDER_CONTRACT:
        prop.status = ListingStatus.PENDING
    elif target == DealStage.CLOSED:
        deal.closed_at = now.date()
        prop.status = ListingStatus.SOLD
        prop.sold_price = deal.offer_price
        prop.sold_at = now.date()

    db.add(Activity(kind=ActivityKind.STAGE_CHANGE, deal_id=deal.id, property_id=prop.id,
                    agent_id=deal.agent_id, message=f"{deal.code} moved to {stage_label(target)}",
                    payload={"code": deal.code, "stage": target.value}))
    db.commit()
    return get_deal(db, deal_id)


def mark_lost(db: Session, deal_id: int, reason: str) -> DealDetail:
    deal = _load(db, deal_id)
    if deal.stage in (DealStage.CLOSED, DealStage.LOST):
        raise ConflictError(f"Deal is already {stage_label(deal.stage).lower()}", code="deal_terminal",
                            stage=deal.stage.value)
    now = utcnow()
    deal.stage = DealStage.LOST
    deal.stage_entered_at = now
    deal.lost_reason = reason
    deal.stage_events.append(DealStageEvent(stage=DealStage.LOST, entered_at=now))
    if deal.property.status == ListingStatus.PENDING:
        deal.property.status = ListingStatus.ACTIVE
    db.add(Activity(kind=ActivityKind.STAGE_CHANGE, deal_id=deal.id, property_id=deal.property_id,
                    agent_id=deal.agent_id, message=f"{deal.code} marked lost: {reason}",
                    payload={"code": deal.code, "stage": "lost", "reason": reason}))
    db.commit()
    return get_deal(db, deal_id)


def toggle_checklist_item(db: Session, deal_id: int, item_id: int, done: bool) -> DealDetail:
    item = db.get(DealChecklistItem, item_id)
    if item is None or item.deal_id != deal_id:
        raise NotFoundError(f"Checklist item {item_id} not found on deal {deal_id}")
    if item.done != done:
        item.done = done
        item.done_at = utcnow() if done else None
        deal = db.get(Deal, deal_id)
        db.add(Activity(kind=ActivityKind.CHECKLIST, deal_id=deal_id,
                        agent_id=deal.agent_id if deal else None,
                        message=f"{'Resolved' if done else 'Reopened'}: {item.title}",
                        payload={"item": item.code, "title": item.title, "done": done,
                                 "code": deal.code if deal else None}))
        db.commit()
    return get_deal(db, deal_id)
