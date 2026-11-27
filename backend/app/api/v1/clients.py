from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.api.deps import DbSession, PageQ
from app.core.errors import NotFoundError
from app.models import Client
from app.schemas.client import PartnerOut, PartnerUpdate
from app.schemas.common import Page

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=Page[PartnerOut])
def list_clients(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100, description="name, e-mail, city, street or PLZ")] = None,
    page: PageQ = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = 500,
):
    """Partners, most recent invoice payment first (unpaid last)."""
    stmt = select(Client)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(*(col.ilike(like) for col in
                                (Client.name, Client.email, Client.city, Client.street, Client.postal_code))))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Client.invoice_paid_at.desc().nulls_last(), Client.name)
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page[PartnerOut](items=rows, total=total, page=page, page_size=page_size)


@router.patch("/{client_id}", response_model=PartnerOut)
def update_client(client_id: int, payload: PartnerUpdate, db: DbSession):
    """Fill in missing partner fields (only the fields sent are changed)."""
    client = db.get(Client, client_id)
    if client is None:
        raise NotFoundError(f"Partner {client_id} not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client
