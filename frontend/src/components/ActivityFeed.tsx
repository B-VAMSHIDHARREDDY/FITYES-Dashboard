import { motion } from "framer-motion";
import { ArrowRightLeft, CheckCircle2, FileText, type LucideIcon, MessageSquare, Tag, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

import { useActivities } from "@/api/hooks";
import type { ActivityKind } from "@/api/types";
import { Avatar, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { activityText } from "@/i18n/domain";
import { useI18n } from "@/i18n/I18nProvider";
import { relativeTime } from "@/lib/format";

const ICON: Record<ActivityKind, LucideIcon> = {
  listing_created: Tag,
  price_change: TrendingDown,
  stage_change: ArrowRightLeft,
  offer_updated: FileText,
  checklist: CheckCircle2,
  note: MessageSquare,
};

export function ActivityFeed({ limit = 10, dealId }: { limit?: number; dealId?: number }) {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } = useActivities(limit, dealId);

  if (isLoading) return <div className="grid gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data?.length) return <EmptyState title={t("common.noActivity")} />;

  return (
    <ol className="relative">
      <span className="absolute top-2 bottom-2 left-[15px] w-px bg-[var(--line)]" aria-hidden />
      {data.map((a, i) => {
        const Icon = ICON[a.kind];
        const body = (
          <>
            <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-solid text-brand-text">
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink" title={activityText(t, a)}>{activityText(t, a)}</p>
              <p className="text-[11px] text-ink-3">
                {a.agent?.name ?? t("common.system")} · {relativeTime(a.created_at)}
              </p>
            </div>
            {a.agent && <Avatar agent={a.agent} size={22} />}
          </>
        );
        return (
          <motion.li key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
            {a.deal_id && !dealId ? (
              <Link to={`/deals/${a.deal_id}`} className="flex items-center gap-3 rounded-xl py-2 pr-2 transition-colors hover:bg-surface-muted">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2 pr-2">{body}</div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
