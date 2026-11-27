import { motion } from "framer-motion";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import type { AgentRef } from "@/api/types";
import { errorText } from "@/i18n/domain";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/* ---------- Pill ---------- */
type Tone = "brand" | "good" | "warn" | "bad" | "neutral";
const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-text",
  good: "bg-good-soft text-good-on",
  warn: "bg-warn-soft text-warn-on",
  bad: "bg-bad-soft text-bad-on",
  neutral: "bg-surface-muted text-ink-2 border border-line",
};

export function Pill({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || Number.isNaN(value)) return <span className="text-xs text-ink-3">—</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn("tabular inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold", good ? "bg-good-soft text-good-on" : "bg-bad-soft text-bad-on")}>
      {value > 0 ? "▲" : value < 0 ? "▼" : "•"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ agent, size = 28 }: { agent: Pick<AgentRef, "name" | "avatar_color">; size?: number }) {
  return (
    <span
      title={agent.name}
      className="inline-grid shrink-0 place-items-center rounded-full bg-brand font-semibold text-brand-ink ring-2 ring-[var(--surface-solid)]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(agent.name)}
    </span>
  );
}

/* ---------- Card header ---------- */
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Segmented control with sliding indicator ---------- */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  layoutId,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-line bg-surface-muted p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              active ? "text-brand-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Loading / empty / error ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-[var(--track)]/60", className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-text">
        <Inbox size={20} />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-3">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const message = errorText(t, error);
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-bad-soft text-bad-on">
        <AlertTriangle size={20} />
      </span>
      <p className="font-medium text-ink">{t("common.loadError")}</p>
      <p className="max-w-sm text-sm text-ink-3">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost mt-2" onClick={onRetry}>
          <RotateCw size={14} /> {t("common.retry")}
        </button>
      )}
    </div>
  );
}

/* ---------- Motion presets ---------- */
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

export const stagger = (i: number) => ({ ...fadeUp, transition: { ...fadeUp.transition, delay: 0.04 * i } });
