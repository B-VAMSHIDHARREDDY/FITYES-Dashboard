// Mirror of backend/app/services/finance.py — keeps the offer builder re-rating live without round-trips.
import type { OfferBreakdown } from "@/api/types";

export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  return r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
}

export function offerBreakdown(a: {
  offerPrice: number;
  listPrice: number;
  downPaymentPct: number;
  interestRate: number;
  loanTermYears: number;
  commissionRate: number;
  taxAnnual: number;
  hoaMonthly: number;
}): OfferBreakdown {
  const down = (a.offerPrice * a.downPaymentPct) / 100;
  const loan = Math.max(a.offerPrice - down, 0);
  const pi = monthlyPayment(loan, a.interestRate, a.loanTermYears);
  const tax = a.taxAnnual / 12;
  const delta = a.offerPrice - a.listPrice;
  return {
    offer_price: a.offerPrice,
    list_price: a.listPrice,
    delta_vs_list: delta,
    delta_vs_list_pct: a.listPrice ? (delta / a.listPrice) * 100 : 0,
    down_payment: down,
    loan_amount: loan,
    monthly_principal_interest: pi,
    monthly_tax: tax,
    monthly_hoa: a.hoaMonthly,
    monthly_total: pi + tax + a.hoaMonthly,
    commission: a.offerPrice * a.commissionRate,
  };
}
