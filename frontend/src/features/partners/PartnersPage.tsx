import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useDeferredValue, useMemo, useRef, useState } from "react";

import { usePartners, useUpdatePartner } from "@/api/hooks";
import type { Partner } from "@/api/types";
import { SubBar } from "@/components/layout/SubBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DatePicker, EmptyState, ErrorState, Segmented, Select, Skeleton, stagger, todayIso } from "@/components/ui";
import { errorText } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/en";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { longDate } from "@/lib/format";

type Field = "name" | "postal_code" | "city" | "street" | "email" | "invoice_paid_at";
type Status = "all" | "complete" | "missing";
type Sort = { key: Field; dir: "asc" | "desc" };

// Same order as the Excel sheet: Name | PLZ | Ort | Straße | E-mail | Datum Rechnung bezahlt
const COLS: { key: Field; label: MessageKey }[] = [
  { key: "name", label: "partners.col.name" },
  { key: "postal_code", label: "partners.col.plz" },
  { key: "city", label: "partners.col.city" },
  { key: "street", label: "partners.col.street" },
  { key: "email", label: "partners.col.email" },
  { key: "invoice_paid_at", label: "partners.col.paid" },
];

const UNKNOWN_NAME = "Unbekannt"; // placeholder the importer uses for a row without a name
const today = todayIso; // local date, same as the picker

const isFieldMissing = (p: Partner, f: Field) => !p[f] || (f === "name" && p.name === UNKNOWN_NAME);
const isMissing = (p: Partner) => COLS.some((c) => isFieldMissing(p, c.key));

/** Client-side mirror of the API's PartnerUpdate rules, so mistakes show before saving. */
function validate(field: Field, raw: string): MessageKey | null {
  const v = raw.trim();
  if (!v) return "partners.invalid.required";
  if (field === "postal_code" && !/^\d{4,5}$/.test(v)) return "partners.invalid.plz";
  if (field === "email" && !/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(v)) return "partners.invalid.email";
  if (field === "invoice_paid_at" && v > today()) return "partners.invalid.future";
  return null;
}

const PAGE_SIZES = [20, 50, 100] as const; // first entry is the default

/** 1 … 4 5 [6] 7 8 … 12 — always shows first/last and two neighbours of the current page. */
function pageList(current: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - current) <= 2) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

function Pager({ page, pages, size, total, onPage, onSize }: {
  page: number;
  pages: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  const { t } = useI18n();
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, total);
  const nav = (p: number, label: string, Icon: typeof ChevronLeft, disabled: boolean) => (
    <button type="button" className="icon-btn size-8" disabled={disabled} onClick={() => onPage(p)} aria-label={label} title={label}>
      <Icon size={15} />
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-ink-3">
        {t("partners.perPage")}
        <Select<number> size="sm" value={size} onChange={onSize} ariaLabel={t("partners.perPage")} className="w-[4.5rem]"
          options={PAGE_SIZES.map((s) => ({ value: s, label: String(s) }))} />
      </div>
      <p className="tabular text-xs text-ink-3">{t("partners.range", { from, to, total })}</p>

      <nav className="ml-auto flex items-center gap-1" aria-label={t("partners.pagination")}>
        {nav(1, t("partners.first"), ChevronsLeft, page <= 1)}
        {nav(page - 1, t("common.prev"), ChevronLeft, page <= 1)}
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap${i}`} className="px-1 text-xs text-ink-3">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "tabular h-8 min-w-8 rounded-full px-2 text-xs font-medium transition-colors",
                p === page ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-muted hover:text-ink",
              )}
            >
              {p}
            </button>
          ),
        )}
        {nav(page + 1, t("common.next"), ChevronRight, page >= pages)}
        {nav(pages, t("partners.last"), ChevronsRight, page >= pages)}
      </nav>
    </div>
  );
}

/* ---------- editable cell (only rendered for missing values) ---------- */
function MissingCell({ partner, field }: { partner: Partner; field: Field }) {
  const { t } = useI18n();
  const update = useUpdatePartner();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = validate(field, value);

  const cancel = () => {
    setEditing(false);
    setValue("");
    setTouched(false);
    update.reset();
  };

  const commit = (v: string) => {
    setTouched(true);
    if (validate(field, v) || update.isPending) return;
    update.mutate({ id: partner.id, body: { [field]: v.trim() } }, { onSuccess: cancel });
  };
  const save = (e?: FormEvent) => {
    e?.preventDefault();
    commit(value);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") cancel();
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--track)] bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn-on transition-colors hover:border-brand-text hover:text-brand-text"
        title={t("partners.add")}
      >
        <Plus size={11} strokeWidth={2.5} />
        {t("partners.missing")} · {t("partners.add")}
      </button>
    );
  }

  const error = touched && invalid ? t(invalid) : update.isError ? errorText(t, update.error) : null;
  return (
    <form onSubmit={save} className="min-w-[150px]">
      <div className="flex items-center gap-1">
        {field === "invoice_paid_at" ? (
          // picking a day saves straight away; the calendar opens as soon as the cell is edited
          <DatePicker
            value={value}
            onChange={(v) => {
              setValue(v);
              if (v) commit(v);
            }}
            max={today()}
            autoOpen
            clearable={false}
            size="sm"
            ariaLabel={t("partners.col.paid")}
            className={cn("w-full min-w-0", error && "border-bad")}
          />
        ) : (
          <input
            autoFocus
            className={cn("field h-8 w-full min-w-0 px-2 text-xs", error && "border-bad")}
            type={field === "email" ? "email" : "text"}
            inputMode={field === "postal_code" ? "numeric" : undefined}
            maxLength={field === "postal_code" ? 5 : 200}
            placeholder={t(COLS.find((c) => c.key === field)!.label)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={onKey}
            disabled={update.isPending}
            aria-invalid={!!error}
          />
        )}
        <button type="submit" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-ink disabled:opacity-40"
          disabled={update.isPending} aria-label={t("partners.save")} title={t("partners.save")}>
          <Check size={14} strokeWidth={2.5} />
        </button>
        <button type="button" onClick={cancel} className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:text-ink"
          aria-label={t("common.cancel")} title={t("common.cancel")}>
          <X size={14} />
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-bad">{error}</p>}
    </form>
  );
}

/* ---------- page ---------- */
export default function PartnersPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = usePartners();

  const [status, setStatus] = useState<Status>("all");
  const [field, setField] = useState<Field | "">("");
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "invoice_paid_at", dir: "desc" });
  const query = useDeferredValue(q.trim().toLowerCase());

  const all = useMemo(() => data?.items ?? [], [data]);
  const missingCount = all.filter(isMissing).length;
  const lastPaid = all.reduce<string | null>((m, p) => (p.invoice_paid_at && (!m || p.invoice_paid_at > m) ? p.invoice_paid_at : m), null);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of all) if (p.city) counts.set(p.city, (counts.get(p.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [all]);

  const filtersActive = status !== "all" || field || city || from || to || q;
  const resetFilters = () => {
    setStatus("all");
    setField("");
    setCity("");
    setFrom("");
    setTo("");
    setQ("");
  };

  const rows = useMemo(() => {
    const out = all.filter((p) => {
      if (status === "missing" && !isMissing(p)) return false;
      if (status === "complete" && isMissing(p)) return false;
      if (field && !isFieldMissing(p, field)) return false;
      if (city && p.city !== city) return false;
      if (from && (!p.invoice_paid_at || p.invoice_paid_at < from)) return false;
      if (to && (!p.invoice_paid_at || p.invoice_paid_at > to)) return false;
      if (query && ![p.name, p.email, p.street, p.postal_code, p.city].some((v) => v?.toLowerCase().includes(query))) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const av = isFieldMissing(a, sort.key) ? null : a[sort.key];
      const bv = isFieldMissing(b, sort.key) ? null : b[sort.key];
      if (av === bv) return 0;
      if (av === null) return 1; // missing values always last
      if (bv === null) return -1;
      return String(av).localeCompare(String(bv), "de", { numeric: true }) * dir;
    });
  }, [all, status, field, city, from, to, query, sort]);

  // Pagination: any filter/sort/size change jumps back to page 1; edits that shrink the list clamp the page.
  const [size, setSize] = useState<number>(PAGE_SIZES[0]);
  const viewKey = JSON.stringify([status, field, city, from, to, query, sort, size]);
  const [pageState, setPageState] = useState({ key: viewKey, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pageState.key === viewKey ? pageState.page : 1, pages);
  const pageRows = rows.slice((page - 1) * size, page * size);
  const tableTop = useRef<HTMLDivElement>(null);
  const goToPage = (p: number) => {
    setPageState({ key: viewKey, page: Math.min(Math.max(p, 1), pages) });
    tableTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleSort = (key: Field) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "invoice_paid_at" ? "desc" : "asc" }));

  const tiles = [
    { label: t("partners.total"), value: all.length, accent: false },
    { label: t("partners.complete"), value: all.length - missingCount, accent: false },
    { label: t("partners.incomplete"), value: missingCount, accent: missingCount > 0 },
  ];

  return (
    <>
      <SubBar crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.partners") }]} />
      <div className="mt-6">
        <h1 className="text-2xl font-medium tracking-tight sm:text-[2rem]">{t("partners.title")}</h1>
        <p className="mt-1 text-sm text-ink-3">{t("partners.subtitle")}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <motion.div key={tile.label} {...stagger(i)} className="card p-4">
            <p className="text-xs text-ink-3">{tile.label}</p>
            <p className={cn("tabular mt-2 text-3xl font-medium", tile.accent && "text-brand-text")}>
              {isLoading ? "–" : <AnimatedNumber value={tile.value} format={(n) => String(Math.round(n))} />}
            </p>
          </motion.div>
        ))}
        <motion.div {...stagger(3)} className="card p-4">
          <p className="text-xs text-ink-3">{t("partners.lastPaid")}</p>
          <p className="tabular mt-2 text-3xl font-medium">{lastPaid ? longDate(lastPaid) : "–"}</p>
        </motion.div>
      </div>

      <motion.section {...stagger(4)} ref={tableTop} className="card mt-4 scroll-mt-4 overflow-hidden">
        {/* filters */}
        <div className="grid gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<Status>
              layoutId="partners-status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t("partners.filter.all") },
                { value: "complete", label: t("partners.filter.complete") },
                { value: "missing", label: `${t("partners.filter.missing")} · ${missingCount}` },
              ]}
            />
            <div className="relative ml-auto w-full sm:w-72">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
              <input className="field w-full pl-9" placeholder={t("partners.search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <span className="label">{t("partners.filter.field")}</span>
              <Select<Field | "">
                value={field}
                onChange={setField}
                ariaLabel={t("partners.filter.field")}
                active={field !== ""}
                className="w-56"
                options={[
                  { value: "", label: t("partners.filter.anyField"), hint: missingCount },
                  ...COLS.map((c) => {
                    const n = all.filter((p) => isFieldMissing(p, c.key)).length;
                    return { value: c.key, label: t(c.label), hint: n, disabled: !n };
                  }),
                ]}
              />
            </div>
            <div className="grid gap-1">
              <span className="label">{t("partners.col.city")}</span>
              <Select<string>
                value={city}
                onChange={setCity}
                ariaLabel={t("partners.col.city")}
                active={city !== ""}
                className="w-56"
                options={[
                  { value: "", label: t("partners.filter.allCities"), hint: cities.length },
                  ...cities.map(([c, n]) => ({ value: c, label: c, hint: n })),
                ]}
              />
            </div>
            <div className="grid gap-1">
              <span className="label">{t("partners.filter.paidFrom")}</span>
              <DatePicker value={from} onChange={setFrom} max={to || today()} ariaLabel={t("partners.filter.paidFrom")} className="w-44" />
            </div>
            <div className="grid gap-1">
              <span className="label">{t("partners.filter.paidTo")}</span>
              <DatePicker value={to} onChange={setTo} min={from || undefined} max={today()} ariaLabel={t("partners.filter.paidTo")} className="w-44" />
            </div>
            {filtersActive && (
              <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                <X size={14} /> {t("partners.filter.reset")}
              </button>
            )}
            <p className="tabular ml-auto text-xs text-ink-3">{t("partners.shown", { n: rows.length, total: all.length })}</p>
          </div>

          {missingCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <Pencil size={12} /> {t("partners.editHint")}
            </p>
          )}
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-y border-line text-left text-[11px] tracking-wide text-ink-3 uppercase">
                  {COLS.map((c) => {
                    const active = sort.key === c.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th key={c.key} className="px-5 py-2.5 font-medium" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => toggleSort(c.key)} title={t("partners.sortBy", { col: t(c.label) })}
                          className={cn("inline-flex items-center gap-1 uppercase hover:text-ink", active && "text-ink")}>
                          {t(c.label)} <Icon size={11} className={active ? "text-brand-text" : "opacity-50"} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={COLS.length} className="p-5"><Skeleton className="h-64" /></td></tr>
                )}
                {pageRows.map((p) => (
                  <tr key={p.id} className="border-b border-line align-top transition-colors last:border-0 hover:bg-surface-muted">
                    {COLS.map((c) => (
                      <td key={c.key} className={cn("px-5 py-3", c.key === "name" ? "font-medium" : "text-ink-2",
                        (c.key === "postal_code" || c.key === "invoice_paid_at") && "tabular")}>
                        {isFieldMissing(p, c.key) ? (
                          <MissingCell partner={p} field={c.key} />
                        ) : c.key === "invoice_paid_at" ? (
                          longDate(p.invoice_paid_at!)
                        ) : (
                          p[c.key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && rows.length === 0 && (
              <EmptyState title={t("partners.empty")} body={all.length ? undefined : t("partners.emptyBody")} />
            )}
          </div>
        )}
        {!isError && rows.length > 0 && (
          <Pager page={page} pages={pages} size={size} total={rows.length} onPage={goToPage} onSize={setSize} />
        )}
      </motion.section>
    </>
  );
}
