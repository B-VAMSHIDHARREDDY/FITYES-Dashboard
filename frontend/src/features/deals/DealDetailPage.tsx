import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, MoreHorizontal, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useDeal } from "@/api/hooks";
import type { OfferInput } from "@/api/types";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SubBar } from "@/components/layout/SubBar";
import { ErrorState, Pill, Skeleton } from "@/components/ui/primitives";
import { stageLabel } from "@/i18n/domain";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";

import { Checklist } from "./Checklist";
import { isDirty, OfferBuilder, termsOf } from "./OfferBuilder";
import { OfferSummary } from "./OfferSummary";
import { Particulars } from "./Particulars";
import { PipelineStepper } from "./PipelineStepper";

type Tab = "overview" | "offer" | "checklist" | "activity";
const TABS: Tab[] = ["overview", "offer", "checklist", "activity"];

export default function DealDetailPage() {
  const { t } = useI18n();
  const id = Number(useParams().dealId);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "overview") as Tab;
  const { data: deal, isLoading, isError, error, refetch } = useDeal(id);
  const [draft, setDraft] = useState<OfferInput | null>(null);
  const [starred, setStarred] = useState(false);

  // Re-sync the draft whenever a new offer version lands from the server.
  useEffect(() => {
    if (deal) setDraft(termsOf(deal));
  }, [deal?.id, deal?.offer.offer_version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isError) return <div className="card mt-4"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  if (isLoading || !deal || !draft) {
    return (
      <div className="mt-4 grid gap-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-40" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      </div>
    );
  }

  const openItems = deal.checklist.filter((c) => c.stage === deal.stage && !c.done).length;
  const dirty = isDirty(draft, termsOf(deal));
  const stageTone = deal.stage === "lost" ? "bad" : deal.stage === "closed" ? "good" : "brand";

  return (
    <>
      <SubBar
        crumbs={[{ label: t("crumb.workspace"), to: "/" }, { label: t("nav.deals"), to: "/deals" }, { label: deal.property.title }]}
        tabs={[
          { value: "overview", label: t("deal.overview") },
          { value: "offer", label: dirty ? `${t("deal.offer")} •` : t("deal.offer") },
          { value: "checklist", label: t("deal.checklist"), badge: openItems },
          { value: "activity", label: t("deal.activity") },
        ]}
        active={tab}
        onTab={(t) => setParams({ tab: t }, { replace: true })}
      />

      <div className="mt-6 flex items-start gap-3">
        <button className="icon-btn mt-1 shrink-0" aria-label={t("common.back")} onClick={() => navigate("/deals")}>
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="truncate text-2xl font-medium tracking-tight sm:text-[2rem]">
            {deal.property.title}
          </motion.h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
              <span className="size-2 rounded-[3px] bg-brand" />
              {deal.property.address} · {deal.property.neighborhood}, {deal.property.city}
            </span>
            <span>{t("deal.id", { code: deal.code })}</span>
            <Pill tone={stageTone} dot>{stageLabel(t, deal.stage)}</Pill>
          </div>
        </div>
        <button className={cn("icon-btn", starred && "text-brand-text")} aria-label={t("deal.star")} aria-pressed={starred} onClick={() => setStarred((s) => !s)}>
          <Star size={16} fill={starred ? "currentColor" : "none"} />
        </button>
        <button className="icon-btn" aria-label={t("deal.more")}>
          <MoreHorizontal size={16} />
        </button>
      </div>

      <PipelineStepper deal={deal} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"
        >
          {tab === "overview" && <Particulars deal={deal} />}
          {tab === "offer" && <OfferBuilder deal={deal} draft={draft} onChange={setDraft} />}
          {tab === "checklist" && <Checklist deal={deal} />}
          {tab === "activity" && (
            <section className="card p-5">
              <h3 className="mb-3 text-[15px] font-medium">{t("deal.activityTitle")}</h3>
              <ActivityFeed dealId={deal.id} limit={30} />
            </section>
          )}
          <div className="lg:sticky lg:top-4">
            <OfferSummary deal={deal} terms={tab === "offer" ? draft : termsOf(deal)} live={tab === "offer" && dirty} />
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
