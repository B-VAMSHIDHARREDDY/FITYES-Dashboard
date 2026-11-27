import { motion } from "framer-motion";
import { type ReactElement, type ReactNode, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useNeighborhoods, useTrends } from "@/api/hooks";
import type { TrendPoint } from "@/api/types";
import { axisProps, ChartTooltip } from "@/components/charts/ChartTooltip";
import { SubBar } from "@/components/layout/SubBar";
import { CardHeader, ErrorState, Segmented, Skeleton, Sparkline, stagger } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { decimal, money, moneyCompact, monthLabel, number, pct } from "@/lib/format";

function ChartCard({ title, subtitle, i, children, legend }: { title: string; subtitle: string; i: number; children: ReactElement; legend?: ReactNode }) {
  const { lang } = useI18n();
  return (
    <motion.section {...stagger(i)} className="card p-5">
      <CardHeader title={title} subtitle={subtitle} action={legend} />
      <div className="mt-4 h-56">
        {/* keyed by language so axis ticks re-format immediately */}
        <ResponsiveContainer key={lang} width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </motion.section>
  );
}

const LegendKey = ({ items }: { items: { label: string; color: string }[] }) => (
  <div className="flex gap-3">
    {items.map((it) => (
      <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
        <span className="size-2 rounded-full" style={{ background: it.color }} /> {it.label}
      </span>
    ))}
  </div>
);

function Charts({ data }: { data: TrendPoint[] }) {
  const { t } = useI18n();
  const last = data.at(-1);
  const first = data[0];
  const change = (k: keyof TrendPoint) => (first && last ? pct(((Number(last[k]) - Number(first[k])) / Number(first[k])) * 100) : "");
  const days = (v: number) => t("unit.daysLong", { n: decimal(v, 0) });
  const count = (v: number) => number(v);
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  const xAxis = <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} minTickGap={24} />;
  const grid = <CartesianGrid vertical={false} stroke="var(--line)" />;
  const cursor = { stroke: "var(--ink-3)", strokeDasharray: "3 3" };
  const dot = { r: 5, stroke: "var(--surface-solid)", strokeWidth: 2 };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <ChartCard i={2} title={t("market.median")} subtitle={t("market.medianSub", { v: last ? money(last.median_price) : "", pct: change("median_price") })}>
        <AreaChart {...common}>
          <defs>
            <linearGradient id="mkArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}{xAxis}
          <YAxis tickFormatter={moneyCompact} {...axisProps} width={72} domain={["auto", "auto"]} />
          <Tooltip cursor={cursor} content={<ChartTooltip formatters={{ median_price: money }} />} />
          <Area type="monotone" dataKey="median_price" name={t("market.medianPrice")} stroke="var(--chart-line)" strokeWidth={2} fill="url(#mkArea)" activeDot={dot} />
        </AreaChart>
      </ChartCard>

      <ChartCard i={3} title={t("market.ppsqm")} subtitle={t("market.ppsqmSub", { v: last ? t("unit.perSqm", { v: money(last.price_per_sqm) }) : "", pct: change("price_per_sqm") })}>
        <LineChart {...common}>
          {grid}{xAxis}
          <YAxis tickFormatter={(v: number) => money(v)} {...axisProps} width={64} domain={["auto", "auto"]} />
          <Tooltip cursor={cursor} content={<ChartTooltip formatters={{ price_per_sqm: money }} />} />
          <Line type="monotone" dataKey="price_per_sqm" name={t("market.col.ppsqm")} stroke="var(--chart-line)" strokeWidth={2} dot={false} activeDot={dot} />
        </LineChart>
      </ChartCard>

      <ChartCard i={4} title={t("market.supply")} subtitle={t("market.supplySub")}
        legend={<LegendKey items={[{ label: t("market.newListings"), color: "var(--chart-fill)" }, { label: t("market.closedSales"), color: "var(--series-2)" }]} />}>
        <BarChart {...common} barGap={2} barCategoryGap="22%">
          {grid}{xAxis}
          <YAxis {...axisProps} width={36} />
          <Tooltip cursor={{ fill: "var(--line)" }} content={<ChartTooltip formatters={{ new_listings: count, closed_sales: count }} />} />
          <Bar dataKey="new_listings" name={t("market.newListings")} fill="var(--chart-fill)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="closed_sales" name={t("market.closedSales")} fill="var(--series-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard i={5} title={t("market.dom")} subtitle={t("market.domSub", { v: last ? days(last.avg_days_on_market) : "" })}>
        <LineChart {...common}>
          {grid}{xAxis}
          <YAxis {...axisProps} width={36} />
          <Tooltip cursor={cursor} content={<ChartTooltip formatters={{ avg_days_on_market: days }} />} />
          <Line type="monotone" dataKey="avg_days_on_market" name={t("market.avgDom")} stroke="var(--chart-line)" strokeWidth={2} dot={false} activeDot={dot} />
        </LineChart>
      </ChartCard>
    </div>
  );
}

export default function MarketPage() {
  const { t } = useI18n();
  const [hood, setHood] = useState<string | null>(null);
  const [months, setMonths] = useState(24);
  const trends = useTrends(hood, months);
  const hoods = useNeighborhoods();
  const cities = useMemo(() => [...new Set(hoods.data?.map((h) => h.city))], [hoods.data]);
  const cols = ["hood", "median", "yoy", "trend", "ppsqm", "inventory", "dom", "supply"] as const;

  return (
    <>
      <SubBar crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.market") }, ...(hood ? [{ label: hood }] : [])]} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-[2rem]">{hood ?? t("market.title")}</h1>
          <p className="mt-1 text-sm text-ink-3">{t("market.subtitle", { n: hoods.data?.length ?? "…", cities: cities.join(", ") || "…" })}</p>
        </div>
        <Segmented layoutId="mk-range" value={months} onChange={setMonths} options={[6, 12, 24].map((m) => ({ value: m, label: t("unit.monthsLong", { n: m }) }))} />
      </div>

      <motion.div {...stagger(1)} className="scrollbar-thin mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {[null, ...(hoods.data?.map((h) => h.neighborhood) ?? [])].map((h) => (
          <button key={h ?? "all"} onClick={() => setHood(h)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              hood === h ? "border-brand-text bg-brand text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink")}>
            {h ?? t("market.allHoods")}
          </button>
        ))}
      </motion.div>

      {trends.isError ? <div className="card mt-4"><ErrorState error={trends.error} onRetry={() => void trends.refetch()} /></div>
        : trends.data ? <Charts data={trends.data} />
        : <div className="mt-4 grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72" />)}</div>}

      <motion.section {...stagger(6)} className="card mt-4 overflow-hidden">
        <div className="p-5 pb-3"><CardHeader title={t("market.scorecard")} subtitle={t("market.scorecardSub")} /></div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[11px] tracking-wide text-ink-3 uppercase">
                {cols.map((c, i) => (
                  <th key={c} className={cn("px-5 py-2.5 font-medium", i > 0 && i !== 3 && "text-right")}>{t(`market.col.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hoods.isLoading && <tr><td colSpan={8} className="p-5"><Skeleton className="h-40" /></td></tr>}
              {hoods.data?.map((n) => (
                <tr key={n.neighborhood} onClick={() => setHood(n.neighborhood)}
                  className={cn("cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-muted", hood === n.neighborhood && "bg-brand-soft/50")}>
                  <td className="px-5 py-3"><p className="font-medium">{n.neighborhood}</p><p className="text-[11px] text-ink-3">{n.city}</p></td>
                  <td className="tabular px-5 py-3 text-right font-medium">{moneyCompact(n.median_price)}</td>
                  <td className={cn("tabular px-5 py-3 text-right font-medium", n.yoy_pct >= 0 ? "text-good" : "text-bad")}>{pct(n.yoy_pct)}</td>
                  <td className="px-5 py-3"><Sparkline data={n.sparkline} width={96} height={26} fill={false} /></td>
                  <td className="tabular px-5 py-3 text-right">{money(n.price_per_sqm)}</td>
                  <td className="tabular px-5 py-3 text-right">{n.inventory}</td>
                  <td className="tabular px-5 py-3 text-right">{t("unit.days", { n: n.avg_days_on_market })}</td>
                  <td className="tabular px-5 py-3 text-right">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", n.months_of_supply < 3 ? "bg-good-soft text-good-on" : n.months_of_supply > 6 ? "bg-bad-soft text-bad-on" : "bg-warn-soft text-warn-on")}>
                      {t("market.supplyMonths", { n: decimal(n.months_of_supply) })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </>
  );
}
