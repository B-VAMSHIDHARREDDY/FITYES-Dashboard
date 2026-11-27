"""Business rules for the deal pipeline (German residential market)."""

from app.models.enums import DEAL_STAGE_ORDER, ChecklistKind, DealStage

# Items that must be resolved before a deal may leave the given stage.
# (kind, code, English fallback title). `code` is the translation key used by the UI.
STAGE_CHECKLIST: dict[DealStage, list[tuple[ChecklistKind, str, str]]] = {
    DealStage.LEAD: [
        (ChecklistKind.CHECK, "financing_confirmation", "Bank financing confirmation received"),
        (ChecklistKind.QUESTION, "move_in_timeline", "Confirm target move-in timeline"),
    ],
    DealStage.VIEWING: [
        (ChecklistKind.CHECK, "second_viewing", "Second viewing completed"),
        (ChecklistKind.QUESTION, "must_haves", "Any must-haves the property doesn't meet?"),
    ],
    DealStage.OFFER: [
        (ChecklistKind.CHECK, "comparables_reviewed", "Comparable sales reviewed"),
        (ChecklistKind.QUESTION, "seller_notary_date", "Seller's preferred notary date?"),
        (ChecklistKind.QUESTION, "documents_complete", "Land register extract & energy certificate complete?"),
    ],
    DealStage.UNDER_CONTRACT: [
        (ChecklistKind.CHECK, "notary_draft", "Notary draft contract sent to both parties"),
        (ChecklistKind.CHECK, "priority_notice", "Priority notice entered in land register"),
        (ChecklistKind.QUESTION, "loan_agreement", "Loan agreement signed with bank?"),
    ],
    DealStage.CLOSING: [
        (ChecklistKind.CHECK, "transfer_tax_paid", "Real estate transfer tax paid"),
        (ChecklistKind.CHECK, "purchase_price_paid", "Purchase price paid to seller"),
        (ChecklistKind.CHECK, "handover_protocol", "Handover protocol signed"),
    ],
}

# Offer terms may be renegotiated until the deal is in closing.
OFFER_EDITABLE_STAGES = {DealStage.LEAD, DealStage.VIEWING, DealStage.OFFER, DealStage.UNDER_CONTRACT}


def next_stage(stage: DealStage) -> DealStage | None:
    if stage not in DEAL_STAGE_ORDER or stage == DealStage.CLOSED:
        return None
    return DEAL_STAGE_ORDER[DEAL_STAGE_ORDER.index(stage) + 1]


def stage_label(stage: DealStage) -> str:
    return stage.value.replace("_", " ").title()
