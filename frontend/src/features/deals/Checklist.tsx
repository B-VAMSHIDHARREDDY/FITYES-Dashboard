import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, CircleHelp, ListChecks, XCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useAdvanceDeal, useMarkLost, useToggleChecklist } from "@/api/hooks";
import type { DealDetail } from "@/api/types";
import { CardHeader } from "@/components/ui/primitives";
import { checklistTitle, errorText, stageLabel } from "@/i18n/domain";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { nextStage, PIPELINE } from "@/lib/stages";

export function Checklist({ deal }: { deal: DealDetail }) {
  const { t } = useI18n();
  const toggle = useToggleChecklist(deal.id);
  const advance = useAdvanceDeal(deal.id);
  const lost = useMarkLost(deal.id);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");

  const terminal = deal.stage === "closed" || deal.stage === "lost";
  const next = nextStage(deal.stage);
  const openCount = deal.checklist.filter((c) => c.stage === deal.stage && !c.done).length;
  const stages = PIPELINE.filter((s) => deal.checklist.some((c) => c.stage === s)).reverse();
  const error = advance.error ?? lost.error ?? toggle.error;

  const submitLost = (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length >= 3) lost.mutate(reason.trim(), { onSuccess: () => setLostOpen(false) });
  };

  return (
    <section className="card p-5">
      <CardHeader title={t("checklist.title")} subtitle={t("checklist.subtitle")} />

      <div className="mt-4 grid gap-4">
        {stages.map((stage) => {
          const items = deal.checklist.filter((c) => c.stage === stage);
          const current = stage === deal.stage;
          const done = items.filter((i) => i.done).length;
          return (
            <div key={stage} className={cn("rounded-2xl border p-3", current ? "border-brand-text/40 bg-brand-soft/40" : "border-line")}>
              <div className="mb-1 flex items-center justify-between px-1">
                <p className={cn("text-sm font-medium", current ? "text-brand-text" : "text-ink-2")}>{stageLabel(t, stage)}</p>
                <span className="tabular text-xs text-ink-3">{t("checklist.resolved", { done, total: items.length })}</span>
              </div>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      disabled={!current || terminal || toggle.isPending}
                      onClick={() => toggle.mutate({ itemId: item.id, done: !item.done })}
                      className="group flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left enabled:hover:bg-surface-muted disabled:cursor-default"
                    >
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors", item.done ? "border-brand-text bg-brand text-brand-ink" : "border-[var(--track)] bg-surface-solid")}>
                        <AnimatePresence>
                          {item.done && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Check size={12} strokeWidth={3.5} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span className={cn("flex-1 text-sm transition-colors", item.done ? "text-ink-3 line-through" : "text-ink")}>{checklistTitle(t, item)}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                        {item.kind === "question" ? <CircleHelp size={12} /> : <ListChecks size={12} />}
                        {t(item.kind === "question" ? "checklist.kind.question" : "checklist.kind.check")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {!terminal && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {error && <p className="w-full text-xs text-bad">{errorText(t, error)}</p>}
          <button className="btn btn-ghost text-bad" onClick={() => setLostOpen((o) => !o)}>
            <XCircle size={14} /> {t("checklist.markLost")}
          </button>
          <button className="btn btn-primary ml-auto" disabled={openCount > 0 || advance.isPending} onClick={() => advance.mutate(undefined)}
            title={openCount ? t("checklist.resolveFirst", { n: openCount }) : undefined}>
            {advance.isPending ? t("checklist.moving") : <>{t("checklist.moveTo", { stage: stageLabel(t, next ?? "closed") })} <ArrowRight size={14} /></>}
          </button>
          <AnimatePresence>
            {lostOpen && (
              <motion.form onSubmit={submitLost} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex w-full gap-2 overflow-hidden">
                <input autoFocus className="field flex-1" placeholder={t("checklist.lostReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="btn bg-bad-soft text-bad-on" disabled={reason.trim().length < 3 || lost.isPending}>{t("common.confirm")}</button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
