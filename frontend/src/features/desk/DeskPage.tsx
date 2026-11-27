import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useDeals, useNeighborhoods, usePipeline, useSummary, useTrends } from "@/api/hooks";
import type { Kpi } from "@/api/types";
import { ActivityFeed } from "@/components/ActivityFeed";
import { axisProps, ChartTooltip } from "@/components/charts/ChartTooltip";
import { SubBar } from "@/components/layout/SubBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { CardHeader, Delta, ErrorState, Pill, Segmented, Skeleton, Sparkline, stagger } from "@/components/ui";
import { stageLabel } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/en";
import { type TFn, useI18n } from "@/i18n/I18nProvider";
import { decimal, fullDate, money, moneyCompact, monthLabel, number, pct } from "@/lib/format";
import { OPEN_STAGES } from "@/lib/stages";

const formatter = (t: TFn, f: Kpi["format"]): ((n: number) => string) =>
  ({
    currency: (n: number) => moneyCompact(n),
    number: (n: number) => number(n),
    days: (n: number) => t("unit.days", { n: decimal(n) }),
    percent: (n: number) => pct(n),
  })[f];

function KpiCard({ kpi, i }: { kpi: Kpi; i: number }) {
  const { t } = useI18n();
  const meta = kpi.meta ?? {};
  const hint = t(`kpiHint.${kpi.key}` as MessageKey, {
    n: meta.n ?? 0,
    v: meta.v !== undefined ? moneyCompact(meta.v) : "",
  });
  return (
    <motion.div {...stagger(i)} className="card flex flex-col justify-between gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{t(`kpi.${kpi.key}` as MessageKey)}</p>
        <Delta value={kpi.delta_pct} invert={kpi.key === "days_on_market"} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <AnimatedNumber value={kpi.value} format={formatter(t, kpi.format)} className="text-[1.55rem] leading-none font-semibold tracking-tight" duration={1} />
        <Sparkline data={kpi.trend} width={78} height={30} />
      </div>
      <p className="truncate text-[11px] text-ink-3" title={hint}>{hint}</p>
    </motion.div>
  );
}

function MarketTrendCard() {
  const { t, lang } = useI18n();
  const [months, setMonths] = useState(12);
  const { data, isLoading, isError, error, refetch } = useTrends(null, months);
  const first = data?.[0]?.median_price ?? 0;
  const last = data?.at(-1)?.median_price ?? 0;

  return (
    <motion.section {...stagger(5)} className="card p-5">
      <CardHeader
        title={t("desk.medianTitle")}
        subtitle={data ? t("desk.medianSub", { pct: pct(first ? ((last - first) / first) * 100 : 0), n: months }) : t("desk.allHoods")}
        action={<Segmented layoutId="desk-range" size="sm" value={months} onChange={setMonths} options={[6, 12, 24].map((m) => ({ value: m, label: t("unit.months", { n: m }) }))} />}
      />
      <div className="mt-4 h-64">
        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : isLoading ? <Skeleton className="h-full" /> : (
          <ResponsiveContainer key={lang} width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="deskArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} minTickGap={24} />
              <YAxis tickFormatter={(v: number) => moneyCompact(v)} {...axisProps} width={72} domain={["dataMin - 20000", "dataMax + 20000"]} />
              <Tooltip cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }} content={<ChartTooltip formatters={{ median_price: money }} />} />
              <Area type="monotone" dataKey="median_price" name={t("market.medianPrice")} stroke="var(--chart-line)" strokeWidth={2} fill="url(#deskArea)"
                activeDot={{ r: 5, stroke: "var(--surface-solid)", strokeWidth: 2 }} animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.section>
  );
}

function PipelineCard() {
  const { t } = useI18n();
  const { data, isLoading } = usePipeline();
  const open = data?.filter((s) => OPEN_STAGES.includes(s.stage)) ?? [];
  const max = Math.max(...open.map((s) => s.value), 1);
  const total = open.reduce((s, x) => s + x.value, 0);

  return (
    <motion.section {...stagger(6)} className="card p-5">
      <CardHeader title={t("desk.pipelineTitle")}
        subtitle={<span className="tabular">{t("desk.pipelineSub", { value: moneyCompact(total), count: open.reduce((s, x) => s + x.count, 0) })}</span>}
        action={<Link to="/deals" className="icon-btn" aria-label={t("nav.deals")}><ArrowUpRight size={15} /></Link>} />
      <div className="mt-5 grid gap-3.5">
        {isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8" />)}
        {open.map((s, i) => (
          <div key={s.stage}>
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-ink-2">{stageLabel(t, s.stage)} <span className="text-ink-3">· {s.count}</span></span>
              <span className="tabular font-medium text-ink">{moneyCompact(s.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--track)]/60">
              <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${(s.value / max) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function TopNeighborhoods() {
  const { t } = useI18n();
  const { data, isLoading } = useNeighborhoods();
  return (
    <motion.section {...stagger(7)} className="card p-5">
      <CardHeader title={t("desk.hoodsTitle")} subtitle={t("desk.hoodsSub")}
        action={<Link to="/market" className="icon-btn" aria-label={t("nav.market")}><ArrowUpRight size={15} /></Link>} />
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {isLoading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="my-2 h-9" />)}
        {data?.slice(0, 6).map((n) => (
          <li key={n.neighborhood} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{n.neighborhood}</p>
              <p className="text-[11px] text-ink-3">{n.city}</p>
            </div>
            <Sparkline data={n.sparkline} width={64} height={24} fill={false} />
            <div className="w-28 text-right">
              <p className="tabular text-sm font-medium">{moneyCompact(n.median_price)}</p>
              <p className={`tabular text-[11px] ${n.yoy_pct >= 0 ? "text-good" : "text-bad"}`}>{t("desk.yoy", { pct: pct(n.yoy_pct) })}</p>
            </div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

function AttentionCard() {
  const { t } = useI18n();
  const { data, isLoading } = useDeals("offer", "", 20);
  const items = (data?.items ?? []).filter((d) => d.open_items > 0).slice(0, 4);
  return (
    <motion.section {...stagger(8)} className="card p-5">
      <CardHeader title={t("desk.attentionTitle")} subtitle={t("desk.attentionSub")} />
      <div className="mt-3 grid gap-2">
        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}
        {!isLoading && items.length === 0 && <p className="py-6 text-center text-xs text-ink-3">{t("desk.allClear")}</p>}
        {items.map((d) => (
          <Link key={d.id} to={`/deals/${d.id}?tab=checklist`} className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-brand-text/40">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.property_title}</p>
              <p className="truncate text-[11px] text-ink-3">{d.client_name} · {t("desk.inOffer", { n: d.days_in_stage })}</p>
            </div>
            <Pill tone="warn">{t("desk.open", { n: d.open_items })}</Pill>
          </Link>
        ))}
      </div>
    </motion.section>
  );
}

export default function DeskPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useSummary();
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "desk.morning" : hour < 18 ? "desk.afternoon" : "desk.evening");

  return (
    <>
      <SubBar crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.desk") }]} />

      <div className="mt-6">
        <h1 className="text-2xl font-medium tracking-tight sm:text-[2rem]">{greeting}, Lukas</h1>
        <p className="mt-1 text-sm text-ink-3">{t("desk.subtitle", { date: fullDate(new Date()) })}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {isError && <div className="card col-span-full"><ErrorState error={error} onRetry={() => void refetch()} /></div>}
        {isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-32" />)}
        {data?.kpis.map((k, i) => <KpiCard key={k.key} kpi={k} i={i} />)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <MarketTrendCard />
        <PipelineCard />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <TopNeighborhoods />
        <motion.section {...stagger(9)} className="card p-5">
          <CardHeader title={t("desk.activityTitle")} subtitle={t("desk.activitySub")} />
          <div className="mt-3"><ActivityFeed limit={7} /></div>
        </motion.section>
        <AttentionCard />
      </div>
    </>
  );
}
