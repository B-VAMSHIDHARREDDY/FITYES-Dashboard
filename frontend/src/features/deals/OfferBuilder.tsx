import { AnimatePresence, motion } from "framer-motion";
import { Lock, RotateCcw, Save } from "lucide-react";

import { useSaveOffer } from "@/api/hooks";
import type { DealDetail, OfferInput } from "@/api/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { CardHeader, Segmented } from "@/components/ui/primitives";
import { Slider } from "@/components/ui/Slider";
import { errorText, stageLabel } from "@/i18n/domain";
import { tKey, useI18n } from "@/i18n/I18nProvider";
import { money, moneyCompact, rate } from "@/lib/format";

export const OFFER_EDITABLE = new Set(["lead", "viewing", "offer", "under_contract"]);

export const termsOf = (d: DealDetail): OfferInput => ({
  offer_price: d.offer.offer_price,
  down_payment_pct: d.offer.down_payment_pct,
  interest_rate: d.offer.interest_rate,
  loan_term_years: d.offer.loan_term_years,
  commission_rate: d.offer.commission_rate,
});

export const isDirty = (a: OfferInput, b: OfferInput) =>
  (Object.keys(a) as (keyof OfferInput)[]).some((k) => Math.abs(a[k] - b[k]) > 1e-9);

const TERMS = [20, 25, 30];

export function OfferBuilder({ deal, draft, onChange }: { deal: DealDetail; draft: OfferInput; onChange: (d: OfferInput) => void }) {
  const { t } = useI18n();
  const save = useSaveOffer(deal.id);
  const saved = termsOf(deal);
  const dirty = isDirty(draft, saved);
  const editable = OFFER_EDITABLE.has(deal.stage);
  const list = deal.property.list_price;
  const minPrice = Math.round((list * 0.8) / 1000) * 1000;
  const maxPrice = Math.round((list * 1.15) / 1000) * 1000;
  const delta = draft.offer_price - saved.offer_price;
  const v = deal.offer.offer_version;
  const set = <K extends keyof OfferInput>(k: K, val: OfferInput[K]) => onChange({ ...draft, [k]: val });
  const terms = TERMS.includes(draft.loan_term_years) ? TERMS : [...TERMS, draft.loan_term_years].sort((a, b) => a - b);

  return (
    <section className="card p-5">
      <CardHeader
        title={t("offer.title")}
        subtitle={t("offer.subtitle", { financing: tKey(t, "financing", deal.financing), hood: deal.property.neighborhood })}
        action={!editable && <span className="inline-flex items-center gap-1 text-xs text-ink-3"><Lock size={12} /> {t("offer.locked", { stage: stageLabel(t, deal.stage) })}</span>}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AnimatedNumber value={draft.offer_price} format={money} className="text-[2.6rem] leading-none font-semibold tracking-tight" duration={0.35} />
        <AnimatePresence mode="wait">
          <motion.span
            key={dirty ? "changed" : "same"}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={dirty ? "rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn-on" : "rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-3"}
          >
            {dirty ? t("offer.changed", { delta: `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`, v }) : t("offer.same", { v })}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="mt-4 divide-y divide-[var(--line)]">
        <Slider label={t("offer.price")} value={draft.offer_price} min={minPrice} max={maxPrice} step={1000} disabled={!editable}
          onChange={(x) => set("offer_price", x)} display={moneyCompact(draft.offer_price)} minLabel={moneyCompact(minPrice)} maxLabel={moneyCompact(maxPrice)} />
        <Slider label={t("offer.down")} value={draft.down_payment_pct} min={0} max={50} step={1} disabled={!editable}
          onChange={(x) => set("down_payment_pct", x)} display={`${rate(draft.down_payment_pct, 0)} · ${moneyCompact((draft.offer_price * draft.down_payment_pct) / 100)}`} minLabel={rate(0, 0)} maxLabel={rate(50, 0)} />
        <Slider label={t("offer.rate")} value={draft.interest_rate} min={1} max={7} step={0.05} disabled={!editable}
          onChange={(x) => set("interest_rate", Math.round(x * 100) / 100)} display={rate(draft.interest_rate)} minLabel={rate(1)} maxLabel={rate(7)} />
        <Slider label={t("offer.commission")} value={draft.commission_rate * 100} min={1} max={7.14} step={0.01} disabled={!editable}
          onChange={(x) => set("commission_rate", Math.round(x * 100) / 10000)} display={rate(draft.commission_rate * 100)} minLabel={rate(1)} maxLabel={rate(7.14)} />
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-ink-2">{t("offer.term")}</span>
          <Segmented layoutId="term" size="sm" value={draft.loan_term_years} onChange={(y) => editable && set("loan_term_years", y)}
            options={terms.map((y) => ({ value: y, label: t("unit.years", { n: y }) }))} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {save.isError && <p className="mr-auto text-xs text-bad">{errorText(t, save.error)}</p>}
        {save.isSuccess && !dirty && <p className="mr-auto text-xs text-good">{t("offer.saved", { v })}</p>}
        <button className="btn btn-ghost" disabled={!dirty || save.isPending} onClick={() => onChange(saved)}>
          <RotateCcw size={14} /> {t("offer.reset")}
        </button>
        <button className="btn btn-primary" disabled={!dirty || !editable || save.isPending} onClick={() => save.mutate(draft)}>
          <Save size={14} /> {save.isPending ? t("offer.saving") : t("offer.save", { v: v + 1 })}
        </button>
      </div>
    </section>
  );
}
