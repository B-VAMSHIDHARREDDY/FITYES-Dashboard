import type { TooltipProps } from "recharts";

import { monthLabel } from "@/lib/format";

type Fmt = (v: number) => string;

/** Shared tooltip: inverted surface, values in ink (never series color), swatch carries identity. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatters,
}: TooltipProps<number, string> & { formatters: Record<string, Fmt> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-[var(--tooltip)] px-3 py-2 text-xs text-[var(--surface-solid)] shadow-xl">
      <p className="mb-1 font-medium opacity-70">{typeof label === "string" ? monthLabel(label) : label}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="opacity-80">{p.name}</span>
          <span className="tabular ml-auto pl-3 font-semibold">
            {formatters[String(p.dataKey)]?.(Number(p.value)) ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export const axisProps = {
  stroke: "var(--ink-3)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
