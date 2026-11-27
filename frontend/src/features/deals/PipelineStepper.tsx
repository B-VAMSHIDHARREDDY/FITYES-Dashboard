import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

import type { DealDetail, DealStage } from "@/api/types";
import { stageLabel } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/en";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { addDays, shortDate } from "@/lib/format";
import { nextStage, PIPELINE, STAGE_ICON, TYPICAL_DAYS } from "@/lib/stages";

// Gentle vertical wave across the track (px), echoing the reference design.
const WAVE = [10, 16, 6, -2, 2, 8];
const X0 = 6;
const X1 = 94;
const xAt = (i: number) => X0 + (i * (X1 - X0)) / (PIPELINE.length - 1);
const TRACK_Y = 34;

type NodeState = "done" | "current" | "future" | "lost";

export function PipelineStepper({ deal }: { deal: DealDetail }) {
  const { t, tn } = useI18n();
  const lost = deal.stage === "lost";
  const reachedBeforeLost = lost
    ? deal.stage_events.filter((e) => e.stage !== "lost").map((e) => PIPELINE.indexOf(e.stage)).reduce((a, b) => Math.max(a, b), 0)
    : -1;
  const currentIdx = lost ? reachedBeforeLost : PIPELINE.indexOf(deal.stage);
  const closed = deal.stage === "closed";

  const enteredAt = (s: DealStage) => [...deal.stage_events].reverse().find((e) => e.stage === s)?.entered_at;

  // Estimate future milestones from typical stage durations.
  const estimates: Record<number, string> = {};
  let cursor = deal.stage_entered_at;
  for (let i = currentIdx; i < PIPELINE.length - 1; i++) {
    cursor = addDays(cursor, TYPICAL_DAYS[PIPELINE[i]]);
    estimates[i + 1] = cursor;
  }

  const nodes = PIPELINE.map((stage, i) => {
    let state: NodeState = i < currentIdx || closed ? "done" : i === currentIdx ? "current" : "future";
    if (lost && i === currentIdx) state = "lost";
    let sub = "";
    const at = enteredAt(stage);
    if (state === "done" && at) sub = shortDate(at);
    else if (state === "current") sub = t("stepper.since", { date: shortDate(deal.stage_entered_at) });
    else if (state === "lost") sub = t("stepper.lostOn", { date: shortDate(deal.stage_entered_at) });
    else if (i === PIPELINE.length - 1 && deal.target_close_date) sub = t("stepper.target", { date: shortDate(deal.target_close_date) });
    else if (estimates[i]) sub = t("stepper.about", { date: shortDate(estimates[i]) });
    return { stage, state, sub, x: xAt(i), y: TRACK_Y + WAVE[i] };
  });

  const solidTo = closed ? PIPELINE.length - 1 : currentIdx;
  const solid = nodes.slice(0, solidTo + 1);
  const dashed = nodes.slice(solidTo);
  const toPath = (pts: typeof nodes) => pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

  const open = deal.checklist.filter((c) => c.stage === deal.stage && !c.done);
  const checks = open.filter((c) => c.kind === "check").length;
  const questions = open.length - checks;
  const next = nextStage(deal.stage);
  const nextLabel = next ? stageLabel(t, next) : stageLabel(t, "closed");
  const CurrentIcon = STAGE_ICON[PIPELINE[Math.max(currentIdx, 0)]];

  const parts = [checks && tn("stepper.checks", checks), questions && tn("stepper.questions", questions)].filter(Boolean) as string[];
  const items = parts.length === 2 ? t("stepper.and", { a: parts[0], b: parts[1] }) : parts[0];

  return (
    <section className="card mt-4 overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto px-2">
        <div className="relative h-[124px] min-w-[720px]">
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 124" preserveAspectRatio="none" aria-hidden>
            {dashed.length > 1 && (
              <path d={toPath(dashed)} fill="none" stroke="var(--ink-3)" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
            {solid.length > 1 && (
              <motion.path
                d={toPath(solid)}
                fill="none"
                stroke={lost ? "var(--bad)" : "var(--chart-line)"}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
              />
            )}
          </svg>

          {nodes.map((n, i) => {
            const delay = 0.15 + (i / PIPELINE.length) * 1.0;
            return (
              <div key={n.stage} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${n.x}%`, top: n.y - 12 }}>
                {n.state === "current" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.8 }}
                    animate={{ opacity: 1, y: [0, -3, 0], scale: 1 }}
                    transition={{ opacity: { delay: 1 }, scale: { delay: 1 }, y: { delay: 1.2, duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
                    className="absolute -top-10 grid size-8 place-items-center rounded-lg bg-[var(--tooltip)] text-[var(--surface-solid)] shadow-lg"
                  >
                    <CurrentIcon size={15} />
                    <span className="absolute -bottom-1 size-2 rotate-45 bg-[var(--tooltip)]" />
                  </motion.div>
                )}

                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay, type: "spring", stiffness: 300, damping: 18 }}>
                  {n.state === "done" && (
                    <span className="grid size-6 place-items-center rounded-full bg-brand text-brand-ink shadow-[0_0_0_4px_var(--brand-soft)]">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                  {n.state === "current" && (
                    <span className="relative grid size-6 place-items-center rounded-full border-2 border-brand-text bg-surface-solid shadow-[0_0_0_5px_var(--brand-soft)]">
                      <motion.span className="size-2.5 rounded-full bg-brand" animate={{ scale: [1, 0.7, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
                    </span>
                  )}
                  {n.state === "lost" && (
                    <span className="grid size-6 place-items-center rounded-full bg-bad-soft text-bad-on">
                      <X size={13} strokeWidth={3} />
                    </span>
                  )}
                  {n.state === "future" && (
                    <span className="grid size-5 place-items-center rounded-full border-2 border-[var(--track)] bg-surface-solid">
                      <span className="size-1.5 rounded-full bg-[var(--track)]" />
                    </span>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.1 }} className="mt-2 text-center whitespace-nowrap">
                  <p className={cn("text-xs", n.state === "current" ? "font-semibold text-brand-text" : n.state === "lost" ? "font-semibold text-bad" : n.state === "done" ? "text-ink" : "text-ink-3")}>
                    {stageLabel(t, n.stage)}
                  </p>
                  <p className="text-[10.5px] text-ink-3">{n.sub}</p>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 border-t border-line bg-surface-muted/50 px-5 py-3 text-xs text-ink-2">
        <span className={cn("size-1.5 rounded-full", lost ? "bg-bad-soft" : "bg-brand")} />
        {lost ? (
          <span>{t("stepper.lost", { reason: deal.lost_reason ?? "—" })}</span>
        ) : closed ? (
          <span>{t("stepper.closed", { date: deal.closed_at ? shortDate(deal.closed_at) : "—" })}</span>
        ) : (
          <>
            <span>
              {t("stepper.at", { stage: stageLabel(t, deal.stage), n: deal.days_in_stage, hint: t(`stageHint.${deal.stage}` as MessageKey) })}
            </span>
            {open.length > 0 ? (
              <span>{t("stepper.before", { items, next: nextLabel })}</span>
            ) : (
              <span className="text-good">{t("stepper.ready", { next: nextLabel })}</span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
