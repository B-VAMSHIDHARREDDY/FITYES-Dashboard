import { motion } from "framer-motion";
import { Building, Building2, Home, LandPlot, type LucideIcon, Minus, Plus, Sparkles, Warehouse, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { useCreateProperty } from "@/api/hooks";
import type { PropertyCreate, PropertyType } from "@/api/types";
import { Select } from "@/components/ui";
import { errorText } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/en";
import { tKey, useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { money, number } from "@/lib/format";

const EMPTY: PropertyCreate = {
  title: "",
  address: "",
  city: "Berlin",
  neighborhood: "",
  state: "BE",
  zip_code: "",
  property_type: "condo",
  list_price: 495000,
  bedrooms: 2,
  bathrooms: 1,
  area_sqm: 78,
  year_built: 1908,
  hoa_monthly: 320,
  tax_annual: 900,
  description: "",
};

const TYPES: { value: PropertyType; icon: LucideIcon }[] = [
  { value: "condo", icon: Building2 },
  { value: "single_family", icon: Home },
  { value: "townhouse", icon: Warehouse },
  { value: "multi_family", icon: Building },
  { value: "land", icon: LandPlot },
];

// Bundesländer: the API stores the 2-letter code.
const STATES: [string, string][] = [
  ["BW", "Baden-Württemberg"], ["BY", "Bayern"], ["BE", "Berlin"], ["BB", "Brandenburg"], ["HB", "Bremen"],
  ["HH", "Hamburg"], ["HE", "Hessen"], ["MV", "Mecklenburg-Vorpommern"], ["NI", "Niedersachsen"],
  ["NW", "Nordrhein-Westfalen"], ["RP", "Rheinland-Pfalz"], ["SL", "Saarland"], ["SN", "Sachsen"],
  ["ST", "Sachsen-Anhalt"], ["SH", "Schleswig-Holstein"], ["TH", "Thüringen"],
];

/* ---------- small form building blocks ---------- */
function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
        <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px] text-brand-ink">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, optional, children, className }: { label: string; optional?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1.5", className)}>
      <span className="label flex items-center gap-1.5">
        {label}
        {optional && <span className="rounded-full bg-surface-muted px-1.5 text-[10px] text-ink-3">{optional}</span>}
      </span>
      {children}
    </label>
  );
}

function UnitInput({ value, onChange, unit, step = 1, min = 0, max, required = true }: {
  value: number | null | undefined;
  onChange: (n: number) => void;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <input
        className="field tabular no-spin w-full pr-12"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-ink-3">{unit}</span>
    </div>
  );
}

function Stepper({ value, onChange, min = 0, max = 50 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const btn = "grid h-full w-9 place-items-center text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-xl border border-line bg-surface-solid">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="−">
        <Minus size={14} />
      </button>
      <span className="tabular flex-1 text-center text-sm font-medium">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="+">
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ---------- dialog ---------- */
export function NewListingDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<PropertyCreate>(EMPTY);
  const create = useCreateProperty();
  const firstField = useRef<HTMLInputElement>(null);
  const set = <K extends keyof PropertyCreate>(k: K, v: PropertyCreate[K]) => setForm((f) => ({ ...f, [k]: v }));

  const isLand = form.property_type === "land";
  const isCondo = form.property_type === "condo";
  const perSqm = form.area_sqm > 0 ? form.list_price / form.area_sqm : 0;

  // Esc closes (unless a dropdown inside handled it), background page doesn't scroll, focus the title.
  // Runs once: `onClose` is read through a ref so a new callback identity never re-focuses the title.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstField.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        ...form,
        bedrooms: isLand ? 0 : form.bedrooms,
        bathrooms: isLand ? 0 : form.bathrooms,
        year_built: isLand ? null : form.year_built || null,
        hoa_monthly: isCondo ? form.hoa_monthly : 0,
        description: form.description?.trim() || null,
      },
      { onSuccess: onClose },
    );
  };

  const text = (k: "title" | "address" | "city" | "neighborhood" | "zip_code", props: Record<string, unknown> = {}) => (
    <input className="field w-full" required value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
  );
  const L = (k: MessageKey) => t(k);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-listing-title"
        initial={{ opacity: 0, scale: 0.97, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 14 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        className="relative flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-line bg-surface-solid shadow-[0_40px_120px_-30px_rgb(0_0_0/0.7)]"
      >
        {/* header */}
        <header className="flex items-center gap-3 border-b border-line px-6 py-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-brand text-brand-ink">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="new-listing-title" className="text-lg font-medium tracking-tight">{t("new.title")}</h2>
            <p className="truncate text-xs text-ink-3">{t("new.subtitle")}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </header>

        {/* body */}
        <div className="scrollbar-thin grid gap-7 overflow-y-auto px-6 py-6">
          <Section step={1} title={L("new.step1")}>
            <div role="radiogroup" aria-label={t("listings.type")} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TYPES.map(({ value, icon: Icon }) => {
                const on = form.property_type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("property_type", value)}
                    className={cn(
                      "group grid justify-items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                      on ? "border-brand-text bg-brand-soft/60" : "border-line hover:border-ink-3/60 hover:bg-surface-muted",
                    )}
                  >
                    <span className={cn("grid size-8 place-items-center rounded-xl transition-colors",
                      on ? "bg-brand text-brand-ink" : "bg-surface-muted text-ink-2 group-hover:text-ink")}>
                      <Icon size={16} />
                    </span>
                    <span className={cn("text-[13px] leading-tight", on ? "font-medium text-ink" : "text-ink-2")}>{tKey(t, "ptype", value)}</span>
                  </button>
                );
              })}
            </div>
            <Field label={t("new.name")}>
              <input ref={firstField} className="field w-full" required minLength={3} maxLength={160} placeholder={t("new.namePh")}
                value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
          </Section>

          <Section step={2} title={L("new.step2")}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label={t("new.street")} className="sm:col-span-4">{text("address", { placeholder: t("new.streetPh"), minLength: 3 })}</Field>
              <Field label={t("new.zip")} className="sm:col-span-2">
                {text("zip_code", { pattern: "\\d{5}", inputMode: "numeric", maxLength: 5, placeholder: "10405", className: "field tabular w-full" })}
              </Field>
              <Field label={t("new.city")} className="sm:col-span-2">{text("city", { minLength: 2 })}</Field>
              <Field label={t("new.hood")} className="sm:col-span-2">{text("neighborhood", { placeholder: t("new.hoodPh"), minLength: 2 })}</Field>
              <Field label={t("new.state")} className="sm:col-span-2">
                <Select<string>
                  value={form.state}
                  onChange={(v) => set("state", v)}
                  ariaLabel={t("new.state")}
                  placeholder={t("new.statePh")}
                  options={STATES.map(([code, name]) => ({ value: code, label: name, text: `${name} ${code}`, hint: code }))}
                  className="w-full"
                />
              </Field>
            </div>
          </Section>

          <Section step={3} title={L("new.step3")}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label={t("new.price")} className="sm:col-span-3">
                <UnitInput value={form.list_price} onChange={(n) => set("list_price", n)} unit="€" step={1000} min={1} />
              </Field>
              <Field label={t("new.area")} className="sm:col-span-3">
                <UnitInput value={form.area_sqm} onChange={(n) => set("area_sqm", n)} unit="m²" min={1} />
              </Field>
              {!isLand && (
                <>
                  <Field label={t("new.beds")} className="sm:col-span-2">
                    <Stepper value={form.bedrooms} onChange={(n) => set("bedrooms", n)} />
                  </Field>
                  <Field label={t("new.baths")} className="sm:col-span-2">
                    <Stepper value={form.bathrooms} onChange={(n) => set("bathrooms", n)} />
                  </Field>
                  <Field label={t("new.year")} optional={t("new.optional")} className="sm:col-span-2">
                    <UnitInput value={form.year_built} onChange={(n) => set("year_built", n || null)} unit="" min={1700} max={2100} required={false} />
                  </Field>
                </>
              )}
            </div>
          </Section>

          <Section step={4} title={L("new.step4")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("new.tax")}>
                <UnitInput value={form.tax_annual} onChange={(n) => set("tax_annual", n)} unit="€" step={10} />
              </Field>
              {isCondo && (
                <Field label={t("new.hoa")}>
                  <UnitInput value={form.hoa_monthly} onChange={(n) => set("hoa_monthly", n)} unit="€" step={5} />
                </Field>
              )}
              <Field label={t("new.description")} optional={t("new.optional")} className="sm:col-span-2">
                <textarea className="field min-h-24 w-full resize-y py-2 leading-relaxed" maxLength={4000}
                  value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
          </Section>

          {create.isError && <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad-on">{errorText(t, create.error)}</p>}
        </div>

        {/* footer */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-muted px-6 py-3.5">
          <div className="tabular min-w-0 text-xs text-ink-3">
            <span className="font-semibold text-ink">{money(form.list_price || 0)}</span>
            {" · "}{number(form.area_sqm || 0)} m²
            {perSqm > 0 && <> · <span className="text-brand-text">{t("new.perSqm", { v: money(perSqm) })}</span></>}
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button className="btn btn-primary" disabled={create.isPending}>
              <Plus size={15} /> {create.isPending ? t("new.publishing") : t("new.publish")}
            </button>
          </div>
        </footer>
      </motion.form>
    </div>
  );
}
