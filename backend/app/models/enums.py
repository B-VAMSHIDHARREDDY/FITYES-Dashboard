from enum import StrEnum


class PropertyType(StrEnum):
    SINGLE_FAMILY = "single_family"
    CONDO = "condo"
    TOWNHOUSE = "townhouse"
    MULTI_FAMILY = "multi_family"
    LAND = "land"


class ListingStatus(StrEnum):
    ACTIVE = "active"
    PENDING = "pending"
    SOLD = "sold"
    OFF_MARKET = "off_market"


class DealStage(StrEnum):
    LEAD = "lead"
    VIEWING = "viewing"
    OFFER = "offer"
    UNDER_CONTRACT = "under_contract"
    CLOSING = "closing"
    CLOSED = "closed"
    LOST = "lost"


# Linear happy-path order used by the pipeline stepper and `advance`.
DEAL_STAGE_ORDER: tuple[DealStage, ...] = (
    DealStage.LEAD,
    DealStage.VIEWING,
    DealStage.OFFER,
    DealStage.UNDER_CONTRACT,
    DealStage.CLOSING,
    DealStage.CLOSED,
)
OPEN_STAGES: tuple[DealStage, ...] = DEAL_STAGE_ORDER[:-1]


class ClientKind(StrEnum):
    BUYER = "buyer"
    SELLER = "seller"
    INVESTOR = "investor"


class ChecklistKind(StrEnum):
    CHECK = "check"
    QUESTION = "question"


class ActivityKind(StrEnum):
    LISTING_CREATED = "listing_created"
    PRICE_CHANGE = "price_change"
    STAGE_CHANGE = "stage_change"
    OFFER_UPDATED = "offer_updated"
    CHECKLIST = "checklist"
    NOTE = "note"
