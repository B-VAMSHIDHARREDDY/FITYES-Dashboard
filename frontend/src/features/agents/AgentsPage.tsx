import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

import { useAgents } from "@/api/hooks";
import { SubBar } from "@/components/layout/SubBar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Avatar, ErrorState, Skeleton, stagger } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { moneyCompact } from "@/lib/format";

export default function AgentsPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useAgents();
  const max = Math.max(...(data?.map((a) => a.closed_volume) ?? [1]), 1);

  return (
    <>
      <SubBar crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.agents") }]} />
      <div className="mt-6">
        <h1 className="text-2xl font-medium tracking-tight sm:text-[2rem]">{t("agents.title")}</h1>
        <p className="mt-1 text-sm text-ink-3">{t("agents.subtitle")}</p>
      </div>

      {isError && <div className="card mt-4"><ErrorState error={error} onRetry={() => void refetch()} /></div>}
      <div className="mt-5 grid gap-3">
        {isLoading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20" />)}
        {data?.map((a, i) => (
          <motion.div key={a.agent.id} {...stagger(i)} className="card grid items-center gap-4 p-4 md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,2fr)_repeat(4,minmax(0,0.8fr))]">
            <span className={cn("tabular grid size-9 place-items-center rounded-xl text-sm font-semibold", i === 0 ? "bg-brand-soft text-brand-text" : "bg-surface-muted text-ink-2")}>
              {i === 0 ? <Trophy size={16} /> : i + 1}
            </span>
            <div className="flex min-w-0 items-center gap-3">
              <Avatar agent={a.agent} size={38} />
              <div className="min-w-0">
                <p className="truncate font-medium">{a.agent.name}</p>
                <p className="truncate text-xs text-ink-3">{a.agent.title} · {a.region}</p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-ink-3">{t("agents.volume")}</span>
                <AnimatedNumber value={a.closed_volume} format={moneyCompact} className="font-semibold" duration={1} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--track)]/60">
                <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${(a.closed_volume / max) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </div>
            {[
              [t("agents.closed"), String(a.closed_deals), false],
              [t("agents.open"), String(a.open_deals), false],
              [t("agents.pipeline"), moneyCompact(a.pipeline_value), false],
              [t("agents.commission"), moneyCompact(a.commission_earned), true],
            ].map(([k, v, accent]) => (
              <div key={String(k)} className="md:text-right">
                <p className="label">{k}</p>
                <p className={cn("tabular text-sm font-semibold", accent && "text-brand-text")}>{v}</p>
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </>
  );
}
