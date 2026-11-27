import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CircleAlert, Clock, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/api/client";
import { qk } from "@/api/hooks";
import type { DealListItem, DealStage, Page } from "@/api/types";
import { SubBar } from "@/components/layout/SubBar";
import { Avatar, EmptyState, ErrorState, Pill, Segmented, Skeleton } from "@/components/ui/primitives";
import { stageLabel } from "@/i18n/domain";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { moneyCompact, pct } from "@/lib/format";
import { OPEN_STAGES, STAGE_ICON } from "@/lib/stages";

type View = "open" | "closed" | "lost";
const COLUMNS: Record<View, DealStage[]> = { open: OPEN_STAGES, closed: ["closed"], lost: ["lost"] };
const PAGE_SIZE = 100;

function DealCard({ d, i }: { d: DealListItem; i: number }) {
  const { t } = useI18n();
  const delta = d.list_price ? ((d.offer_price - d.list_price) / d.list_price) * 100 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.3 }}
      className="min-w-0"
    >
      <Link
        to={`/deals/${d.id}`}
        className="group block min-w-0 rounded-2xl border border-line bg-surface-solid p-3 shadow-[var(--shadow)] transition-[border-color,box-shadow] hover:border-brand-text/50 hover:shadow-md"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink group-hover:text-brand-text" title={d.property_title}>{d.property_title}</p>
            <p className="truncate text-[11px] text-ink-3" title={`${d.property_address} · ${d.neighborhood}`}>
              {d.property_address} · {d.neighborhood}
            </p>
          </div>
          {d.agent && <Avatar agent={d.agent} size={22} />}
        </div>

        <div className="mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="tabular text-base font-semibold text-ink">{moneyCompact(d.offer_price)}</span>
          <span className={cn("tabular text-[11px] font-medium whitespace-nowrap", delta <= 0 ? "text-good" : "text-warn")}>
            {pct(delta)} {t("common.vsList")}
          </span>
        </div>

        <div className="mt-2.5 flex min-w-0 items-center gap-2 border-t border-line pt-2 text-[11px] text-ink-3">
          <span className="min-w-0 flex-1 truncate">{d.client_name}</span>
          {d.open_items > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-warn" title={t("desk.open", { n: d.open_items })}>
              <CircleAlert size={11} /> {d.open_items}
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock size={11} /> {t("unit.days", { n: d.days_in_stage })}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function DealsBoardPage() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const stages = COLUMNS[view];
  const isBoard = view === "open";

  const results = useQueries({
    queries: stages.map((s) => ({
      queryKey: qk.deals(s, query, PAGE_SIZE),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<Page<DealListItem>>("/deals", { stage: s, q: query, page_size: PAGE_SIZE }, signal),
      // Keep showing the current cards while a new search loads, instead of flashing skeletons.
      placeholderData: keepPreviousData,
    })),
  });
  const failed = results.find((r) => r.isError);
  const loaded = results.every((r) => r.data);
  const totalShown = results.reduce((s, r) => s + (r.data?.items.length ?? 0), 0);

  return (
    <>
      <SubBar
        crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.deals") }]}
        right={
          <label className="relative">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
            <input className="field h-8 w-44 pr-7 pl-8 sm:w-56" placeholder={t("deals.search")} value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label={t("common.close")} className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-3 hover:text-ink">
                <X size={13} />
              </button>
            )}
          </label>
        }
      />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight sm:text-[2rem]">{t("deals.title")}</h1>
          <p className="mt-1 text-sm text-ink-3">{t("deals.subtitle")}</p>
        </div>
        <Segmented layoutId="deal-view" value={view} onChange={setView}
          options={[{ value: "open", label: t("deals.open") }, { value: "closed", label: t("deals.closed") }, { value: "lost", label: t("deals.lost") }]} />
      </div>

      {failed ? (
        <div className="card mt-4"><ErrorState error={failed.error} onRetry={() => results.forEach((r) => void r.refetch())} /></div>
      ) : loaded && totalShown === 0 && query ? (
        <div className="card mt-4"><EmptyState title={t("deals.none")} body={`„${query}“`} /></div>
      ) : (
        <div
          className={cn(
            "scrollbar-thin mt-4 grid gap-3 pb-2",
            // Lanes share the width equally and only scroll horizontally below ~240px each.
            isBoard ? "grid-flow-col auto-cols-[minmax(240px,1fr)] overflow-x-auto" : "grid-cols-1",
          )}
        >
          {stages.map((stage, ci) => {
            const r = results[ci];
            const items = r?.data?.items ?? [];
            const value = items.reduce((s, d) => s + d.offer_price, 0);
            const Icon = STAGE_ICON[stage];
            return (
              <motion.section
                key={stage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ci * 0.04 }}
                className="card flex min-w-0 flex-col self-start p-2"
              >
                <header className="flex min-w-0 items-center gap-2 px-1.5 pt-1">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text"><Icon size={14} /></span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{stageLabel(t, stage)}</p>
                  <Pill className="shrink-0">{r?.data?.total ?? "–"}</Pill>
                </header>
                <p className="tabular truncate px-1.5 pt-1 pb-2 text-xs text-ink-3">
                  {t(isBoard ? "deals.inOffers" : "deals.volume", { v: moneyCompact(value) })}
                </p>

                <div
                  className={cn(
                    "scrollbar-thin grid min-w-0 gap-2 p-0.5",
                    isBoard
                      ? "max-h-[calc(100vh-290px)] min-h-24 grid-cols-1 overflow-y-auto"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                    r?.isPlaceholderData && "opacity-60 transition-opacity",
                  )}
                >
                  {r?.isLoading
                    ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)
                    : items.map((d, i) => <DealCard key={d.id} d={d} i={i} />)}
                  {!r?.isLoading && items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-ink-3">{t("deals.none")}</p>
                  )}
                </div>
              </motion.section>
            );
          })}
        </div>
      )}
    </>
  );
}
