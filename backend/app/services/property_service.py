from dataclasses import dataclass
from datetime import date
from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import NotFoundError
from app.core.time import utcnow
from app.models import Activity, Agent, Property
from app.models.enums import ActivityKind, ListingStatus, PropertyType
from app.schemas.property import PropertyCreate, PropertyUpdate

PropertySort = Literal["newest", "price_asc", "price_desc", "area_desc", "dom_desc"]

_SORTS = {
    "newest": (Property.listed_at.desc(), Property.id.desc()),
    "price_asc": (Property.list_price.asc(), Property.id),
    "price_desc": (Property.list_price.desc(), Property.id),
    "area_desc": (Property.area_sqm.desc(), Property.id),
    "dom_desc": (Property.listed_at.asc(), Property.id),
}


@dataclass(slots=True)
class PropertyFilters:
    q: str | None = None
    status: ListingStatus | None = None
    property_type: PropertyType | None = None
    city: str | None = None
    neighborhood: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    min_beds: int | None = None


def _apply_filters(stmt: Select, f: PropertyFilters) -> Select:
    if f.q:
        like = f"%{f.q.strip()}%"
        stmt = stmt.where(
            or_(Property.title.ilike(like), Property.address.ilike(like), Property.code.ilike(like),
                Property.neighborhood.ilike(like))
        )
    if f.status:
        stmt = stmt.where(Property.status == f.status)
    if f.property_type:
        stmt = stmt.where(Property.property_type == f.property_type)
    if f.city:
        stmt = stmt.where(Property.city == f.city)
    if f.neighborhood:
        stmt = stmt.where(Property.neighborhood == f.neighborhood)
    if f.min_price is not None:
        stmt = stmt.where(Property.list_price >= f.min_price)
    if f.max_price is not None:
        stmt = stmt.where(Property.list_price <= f.max_price)
    if f.min_beds is not None:
        stmt = stmt.where(Property.bedrooms >= f.min_beds)
    return stmt


def list_properties(
    db: Session, filters: PropertyFilters, *, sort: PropertySort, page: int, page_size: int
) -> tuple[list[Property], int]:
    base = _apply_filters(select(Property), filters)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(
        base.options(joinedload(Property.agent))
        .order_by(*_SORTS[sort])
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total


def get_property(db: Session, property_id: int) -> Property:
    prop = db.scalar(
        select(Property).options(joinedload(Property.agent)).where(Property.id == property_id)
    )
    if prop is None:
        raise NotFoundError(f"Property {property_id} not found")
    return prop


def _next_code(db: Session) -> str:
    max_id = db.scalar(select(func.max(Property.id))) or 0
    return f"OBJ-{date.today():%y%m}-{max_id + 1:04d}"


def create_property(db: Session, data: PropertyCreate) -> Property:
    if data.agent_id is not None and db.get(Agent, data.agent_id) is None:
        raise NotFoundError(f"Agent {data.agent_id} not found")
    prop = Property(
        **data.model_dump(),
        code=_next_code(db),
        status=ListingStatus.ACTIVE,
        listed_at=utcnow().date(),
    )
    db.add(prop)
    db.flush()
    db.add(Activity(kind=ActivityKind.LISTING_CREATED, message=f"New listing: {prop.title}",
                    payload={"title": prop.title, "address": prop.address},
                    property_id=prop.id, agent_id=prop.agent_id))
    db.commit()
    return get_property(db, prop.id)


def update_property(db: Session, property_id: int, data: PropertyUpdate) -> Property:
    prop = get_property(db, property_id)
    changes = data.model_dump(exclude_unset=True)
    if "list_price" in changes and float(prop.list_price) != changes["list_price"]:
        old = float(prop.list_price)
        new = changes["list_price"]
        db.add(Activity(kind=ActivityKind.PRICE_CHANGE,
                        message=f"{prop.title}: price {'reduced' if new < old else 'raised'} "
                                f"EUR {old:,.0f} -> EUR {new:,.0f}",
                        payload={"title": prop.title, "old": old, "new": new},
                        property_id=prop.id, agent_id=prop.agent_id))
    if changes.get("agent_id") is not None and db.get(Agent, changes["agent_id"]) is None:
        raise NotFoundError(f"Agent {changes['agent_id']} not found")
    for key, value in changes.items():
        setattr(prop, key, value)
    db.commit()
    return get_property(db, property_id)


def distinct_cities(db: Session) -> list[str]:
    return list(db.scalars(select(Property.city).distinct().order_by(Property.city)))
