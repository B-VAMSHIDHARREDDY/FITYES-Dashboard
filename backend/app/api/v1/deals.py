from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession, PageQ, PageSizeQ
from app.models.enums import DealStage
from app.schemas.common import Page
from app.schemas.deal import ChecklistToggle, DealDetail, DealListItem, MarkLost, OfferUpdate
from app.services import deal_service as svc

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("", response_model=Page[DealListItem])
def list_deals(
    db: DbSession,
    stage: DealStage | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    agent_id: int | None = None,
    page: PageQ = 1,
    page_size: PageSizeQ = 25,
):
    items, total = svc.list_deals(db, stage=stage, q=q, agent_id=agent_id, page=page, page_size=page_size)
    return Page[DealListItem](items=items, total=total, page=page, page_size=page_size)


@router.get("/{deal_id}", response_model=DealDetail)
def get_deal(deal_id: int, db: DbSession):
    return svc.get_deal(db, deal_id)


@router.put("/{deal_id}/offer", response_model=DealDetail)
def update_offer(deal_id: int, payload: OfferUpdate, db: DbSession):
    """Save offer terms. Any real change creates a new offer version."""
    return svc.update_offer(db, deal_id, payload)


@router.post("/{deal_id}/advance", response_model=DealDetail)
def advance_deal(deal_id: int, db: DbSession):
    """Move the deal to the next stage. Fails with 409 while checklist items are open."""
    return svc.advance_deal(db, deal_id)


@router.post("/{deal_id}/lost", response_model=DealDetail)
def mark_lost(deal_id: int, payload: MarkLost, db: DbSession):
    return svc.mark_lost(db, deal_id, payload.reason)


@router.patch("/{deal_id}/checklist/{item_id}", response_model=DealDetail)
def toggle_checklist(deal_id: int, item_id: int, payload: ChecklistToggle, db: DbSession):
    return svc.toggle_checklist_item(db, deal_id, item_id, payload.done)
