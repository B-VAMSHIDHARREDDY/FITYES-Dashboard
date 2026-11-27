from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DbSession, PageQ, PageSizeQ
from app.models.enums import ListingStatus, PropertyType
from app.schemas.common import Page
from app.schemas.property import PropertyCreate, PropertyOut, PropertyUpdate
from app.services import property_service as svc
from app.services.property_service import PropertyFilters, PropertySort

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("", response_model=Page[PropertyOut])
def list_properties(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status_: Annotated[ListingStatus | None, Query(alias="status")] = None,
    property_type: PropertyType | None = None,
    city: str | None = None,
    neighborhood: str | None = None,
    min_price: Annotated[float | None, Query(ge=0)] = None,
    max_price: Annotated[float | None, Query(ge=0)] = None,
    min_beds: Annotated[int | None, Query(ge=0)] = None,
    sort: PropertySort = "newest",
    page: PageQ = 1,
    page_size: PageSizeQ = 24,
):
    filters = PropertyFilters(q=q, status=status_, property_type=property_type, city=city,
                              neighborhood=neighborhood, min_price=min_price, max_price=max_price,
                              min_beds=min_beds)
    items, total = svc.list_properties(db, filters, sort=sort, page=page, page_size=page_size)
    return Page[PropertyOut](items=[PropertyOut.model_validate(p) for p in items],
                             total=total, page=page, page_size=page_size)


@router.get("/cities", response_model=list[str])
def list_cities(db: DbSession):
    return svc.distinct_cities(db)


@router.get("/{property_id}", response_model=PropertyOut)
def get_property(property_id: int, db: DbSession):
    return svc.get_property(db, property_id)


@router.post("", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(payload: PropertyCreate, db: DbSession):
    return svc.create_property(db, payload)


@router.patch("/{property_id}", response_model=PropertyOut)
def update_property(property_id: int, payload: PropertyUpdate, db: DbSession):
    return svc.update_property(db, property_id, payload)
