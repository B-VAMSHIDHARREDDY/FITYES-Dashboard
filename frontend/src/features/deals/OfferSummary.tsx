import { motion } from "framer-motion";
import type { ReactNode } from "react";

import type { DealDetail, OfferInput } from "@/api/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { offerBreakdown } from "@/lib/finance";
import { money, pct, rate } from "@/lib/format";

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className={cn("tabular", strong ? "font-semibold text-brand-text" : "font-medium text-ink")}>{children}</span>
    </div>
  );
}

/** Right-rail summary. Takes the live draft so it re-rates alongside the builder. */
export function OfferSummary({ deal, terms, live }: { deal: DealDetail; terms: OfferInput; live?: boolean }) {
  const { t } = useI18n();
  const b = offerBreakdown({
    offerPrice: terms.offer_price,
    listPrice: deal.property.list_price,
    downPaymentPct: terms.down_payment_pct,
    interestRate: terms.interest_rate,
    loanTermYears: terms.loan_term_years,
    commissionRate: terms.commission_rate,
    taxAnnual: deal.property.tax_annual,
    hoaMonthly: deal.property.hoa_monthly,
  });

  const parts = [
    { key: "pi", label: t("summary.pi"), value: b.monthly_principal_interest, color: "var(--chart-fill)" },
    { key: "tax", label: t("summary.tax"), value: b.monthly_tax, color: "var(--series-2)" },
    { key: "hoa", label: t("summary.hoa"), value: b.monthly_hoa, color: "var(--ink-3)" },
  ].filter((p) => p.value > 0);

  return (
    <aside className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -top-16 -right-16 size-44 rounded-full bg-brand/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-medium">{t("summary.title")}</h3>
        {live && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-text uppercase">{t("common.live")}</span>}
      </div>
      <p className="mt-0.5 text-xs text-ink-3">
        {t("summary.version", { v: deal.offer.offer_version, n: terms.loan_term_years, rate: rate(terms.interest_rate) })}
      </p>

      <AnimatedNumber value={b.offer_price} format={money} className="mt-4 block text-[2.1rem] leading-none font-semibold tracking-tight" duration={0.35} />
      <p className={cn("tabular mt-1.5 text-xs font-medium", b.delta_vs_list_pct <= 0 ? "text-good" : "text-warn")}>
        {t("summary.vsList", { pct: pct(b.delta_vs_list_pct), price: money(b.list_price) })}
      </p>

      <div className="mt-4 divide-y divide-[var(--line)] border-t border-line">
        <Row label={t("summary.down")}><AnimatedNumber value={b.down_payment} format={money} duration={0.35} /></Row>
        <Row label={t("summary.loan")}><AnimatedNumber value={b.loan_amount} format={money} duration={0.35} /></Row>
        <Row label={t("summary.monthly")}><AnimatedNumber value={b.monthly_total} format={money} duration={0.35} /></Row>
        <Row label={t("summary.commission")} strong><AnimatedNumber value={b.commission} format={money} duration={0.35} /></Row>
      </div>

      {b.monthly_total > 0 && (
        <div className="mt-4">
          <p className="label mb-2">{t("summary.mix")}</p>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {parts.map((p) => (
              <motion.div key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: p.color }}
                animate={{ width: `${(p.value / b.monthly_total) * 100}%` }} transition={{ duration: 0.4 }} title={`${p.label}: ${money(p.value)}`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {parts.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.label} <span className="tabular text-ink">{money(p.value)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
