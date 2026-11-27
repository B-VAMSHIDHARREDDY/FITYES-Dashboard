import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Bath, BedDouble, ChevronLeft, ChevronRight, Plus, Ruler, Search } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useCities, useProperties } from "@/api/hooks";
import type { ListingStatus, Property, PropertyQuery, PropertyType } from "@/api/types";
import { SubBar } from "@/components/layout/SubBar";
import { EmptyState, ErrorState, Pill, Segmented, Select, Skeleton } from "@/components/ui";
import { tKey, useI18n } from "@/i18n/I18nProvider";
import { area, decimal, moneyCompact, number } from "@/lib/format";
import { LISTING_TONE } from "@/lib/stages";

import { Cover } from "./Cover";
import { NewListingDialog } from "./NewListingDialog";
import { PropertyDrawer } from "./PropertyDrawer";

const TYPES: PropertyType[] = ["condo", "single_family", "townhouse", "multi_family", "land"];

function ListingCard({ p, i, onOpen }: { p: Property; i: number; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.35 }}
      onClick={onOpen}
      className="card group p-2.5 text-left transition-transform hover:-translate-y-1"
    >
      <div className="relative">
        <Cover p={p} className="h-44" />
        <Pill tone={LISTING_TONE[p.status]} dot className="absolute top-2 left-2 bg-surface-solid/90 backdrop-blur">{tKey(t, "listing", p.status)}</Pill>
      </div>
      <div className="px-1.5 pt-3 pb-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="tabular text-lg font-semibold">{moneyCompact(p.sold_price ?? p.list_price)}</p>
          <span className="text-[11px] text-ink-3">{t("listings.dom", { n: p.days_on_market })}</span>
        </div>
        <p className="mt-0.5 truncate text-sm font-medium" title={p.title}>{p.title}</p>
        <p className="truncate text-xs text-ink-3">{p.address} · {p.neighborhood}, {p.city}</p>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5 text-xs text-ink-2">
          {p.property_type !== "land" && (
            <>
              <span className="inline-flex items-center gap-1"><BedDouble size={13} /> {p.bedrooms}</span>
              <span className="inline-flex items-center gap-1"><Bath size={13} /> {decimal(p.bathrooms, 0)}</span>
            </>
          )}
          <span className="inline-flex items-center gap-1"><Ruler size={13} /> {area(p.area_sqm)}</span>
          <span className="ml-auto truncate text-ink-3">{tKey(t, "ptype", p.property_type)}</span>
        </div>
      </div>
    </motion.button>
  );
}

export default function ListingsPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<ListingStatus | "all">("active");
  const [type, setType] = useState<PropertyType | "">("");
  const [city, setCity] = useState("");
  const [band, setBand] = useState("any");
  const [sort, setSort] = useState<NonNullable<PropertyQuery["sort"]>>("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Property | null>(null);
  const deferredQ = useDeferredValue(q.trim());
  const newOpen = params.get("new") === "1";

  const priceBands = [
    { value: "any", label: t("listings.anyPrice") },
    { value: "0-500000", label: t("listings.under", { v: moneyCompact(500_000) }) },
    { value: "500000-1000000", label: t("listings.between", { a: moneyCompact(500_000), b: moneyCompact(1_000_000) }) },
    { value: "1000000-", label: t("listings.over", { v: moneyCompact(1_000_000) }) },
  ];

  // Keep the search box in sync with the global header search.
  useEffect(() => setQ(params.get("q") ?? ""), [params]);
  useEffect(() => setPage(1), [deferredQ, status, type, city, band, sort]);

  const [minP, maxP] = band === "any" ? [undefined, undefined] : band.split("-").map((v) => (v ? Number(v) : undefined));
  const query: PropertyQuery = {
    q: deferredQ || undefined,
    status: status === "all" ? undefined : status,
    property_type: type || undefined,
    city: city || undefined,
    min_price: minP,
    max_price: maxP,
    sort,
    page,
    page_size: 12,
  };
  const { data, isLoading, isError, error, refetch, isFetching } = useProperties(query);
  const { data: cities } = useCities();
  const pages = data ? Math.max(Math.ceil(data.total / data.page_size), 1) : 1;

  const closeNew = () => {
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  };

  return (
    <>
      <SubBar crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.listings") }]} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-[2rem]">{t("listings.title")}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {data ? t("listings.match", { n: number(data.total) }) : t("listings.loading")}
            {isFetching && !isLoading && <span className="ml-2 text-brand-text">{t("listings.updating")}</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setParams({ new: "1" })}><Plus size={15} /> {t("listings.new")}</button>
      </div>

      <div className="card mt-4 flex flex-wrap items-center gap-2 p-2.5">
        <label className="relative min-w-52 flex-1">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input className="field w-full pl-9" placeholder={t("listings.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Segmented layoutId="listing-status" value={status} onChange={setStatus}
          options={[
            { value: "all", label: t("listings.all") },
            { value: "active", label: t("listing.active") },
            { value: "pending", label: t("listing.pending") },
            { value: "sold", label: t("listing.sold") },
          ]} />
        <Select<PropertyType | "">
          value={type}
          onChange={setType}
          ariaLabel={t("listings.type")}
          active={type !== ""}
          options={[{ value: "", label: t("listings.allTypes") }, ...TYPES.map((ty) => ({ value: ty, label: tKey(t, "ptype", ty) }))]}
        />
        <Select<string>
          value={city}
          onChange={setCity}
          ariaLabel={t("listings.city")}
          active={city !== ""}
          options={[{ value: "", label: t("listings.allCities") }, ...(cities ?? []).map((c) => ({ value: c, label: c }))]}
        />
        <Select<string>
          value={band}
          onChange={setBand}
          ariaLabel={t("listings.price")}
          active={band !== "any"}
          options={priceBands}
        />
        <Select<NonNullable<PropertyQuery["sort"]>>
          value={sort}
          onChange={setSort}
          ariaLabel={t("listings.sort")}
          align="end"
          icon={<ArrowUpDown size={14} />}
          options={[
            { value: "newest", label: t("listings.sortNewest") },
            { value: "price_desc", label: t("listings.sortPriceDesc") },
            { value: "price_asc", label: t("listings.sortPriceAsc") },
            { value: "area_desc", label: t("listings.sortArea") },
            { value: "dom_desc", label: t("listings.sortDom") },
          ]}
        />
      </div>

      {isError ? (
        <div className="card mt-4"><ErrorState error={error} onRetry={() => void refetch()} /></div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-72" />)}
          {data?.items.map((p, i) => <ListingCard key={p.id} p={p} i={i} onOpen={() => setSelected(p)} />)}
          {data && data.items.length === 0 && <div className="card col-span-full"><EmptyState title={t("listings.empty")} body={t("listings.emptyBody")} /></div>}
        </div>
      )}

      {data && pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t("common.prev")}><ChevronLeft size={16} /></button>
          <span className="tabular text-sm text-ink-2">{t("common.page", { page, pages })}</span>
          <button className="icon-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label={t("common.next")}><ChevronRight size={16} /></button>
        </div>
      )}

      <AnimatePresence>{selected && <PropertyDrawer key={selected.id} property={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
      <AnimatePresence>{newOpen && <NewListingDialog onClose={closeNew} />}</AnimatePresence>
    </>
  );
}
