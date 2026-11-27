import { motion } from "framer-motion";
import { useId } from "react";

/** Tiny trend line (no axes) for KPI tiles and table rows. */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--chart-line)",
  accent = "var(--chart-fill)",
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** area + end-dot colour (lime); the line uses `color` */
  accent?: string;
  fill?: boolean;
}) {
  const id = useId();
  if (data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && (
        <motion.path d={area} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      )}
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <circle cx={lx} cy={ly} r={4} fill={accent} stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
