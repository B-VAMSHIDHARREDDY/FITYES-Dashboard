import { useId } from "react";

import { sound } from "@/lib/sound";

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  minLabel,
  maxLabel,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  minLabel: string;
  maxLabel: string;
  disabled?: boolean;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-ink-2">
          {label}
        </label>
        <span className="tabular text-sm font-semibold text-ink">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        className="range mt-2"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          sound.tick();
          onChange(Number(e.target.value));
        }}
        style={{ ["--pct" as string]: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
      <div className="tabular mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
