"""Pure offer/mortgage math. Mirrored in `frontend/src/lib/finance.ts` for live re-rating."""

from dataclasses import asdict, dataclass


def monthly_payment(principal: float, annual_rate_pct: float, years: int) -> float:
    if principal <= 0 or years <= 0:
        return 0.0
    n = years * 12
    r = annual_rate_pct / 100 / 12
    if r == 0:
        return principal / n
    return principal * r / (1 - (1 + r) ** -n)


@dataclass(frozen=True, slots=True)
class OfferBreakdown:
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

    def to_dict(self) -> dict[str, float]:
        return {k: round(v, 2) for k, v in asdict(self).items()}


def offer_breakdown(
    *,
    offer_price: float,
    list_price: float,
    down_payment_pct: float,
    interest_rate: float,
    loan_term_years: int,
    commission_rate: float,
    tax_annual: float,
    hoa_monthly: float,
) -> OfferBreakdown:
    down = offer_price * down_payment_pct / 100
    loan = max(offer_price - down, 0.0)
    pi = monthly_payment(loan, interest_rate, loan_term_years)
    tax = tax_annual / 12
    delta = offer_price - list_price
    return OfferBreakdown(
        offer_price=offer_price,
        list_price=list_price,
        delta_vs_list=delta,
        delta_vs_list_pct=(delta / list_price * 100) if list_price else 0.0,
        down_payment=down,
        loan_amount=loan,
        monthly_principal_interest=pi,
        monthly_tax=tax,
        monthly_hoa=hoa_monthly,
        monthly_total=pi + tax + hoa_monthly,
        commission=offer_price * commission_rate,
    )
