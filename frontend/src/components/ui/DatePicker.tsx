import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";

import { Popover } from "./Popover";

/* ISO yyyy-mm-dd helpers in local time (no UTC shifting). */
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso: string, n: number) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};
const addMonths = (iso: string, n: number) => {
  const d = fromIso(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toIso(d);
};
export const todayIso = () => toIso(new Date());

/**
 * Themed date field + calendar popover. Value is an ISO date string ("" = empty).
 * Keyboard: arrows move by day/week, PageUp/PageDown by month, Enter picks, Esc closes.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  ariaLabel,
  placeholder,
  clearable = true,
  autoOpen = false,
  size = "md",
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  ariaLabel: string;
  placeholder?: string;
  clearable?: boolean;
  autoOpen?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const anchor = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso);
  const [open, setOpen] = useState(autoOpen);
  const [focus, setFocus] = useState(() => value || clamp(todayIso()));
  const disabled = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  const openPicker = () => {
    setFocus(value || clamp(todayIso()));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) anchor.current?.focus();
  };
  const pick = (iso: string) => {
    if (disabled(iso)) return;
    onChange(iso);
    close();
  };

  // keep keyboard focus on the focused day while the calendar is open
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focus}"]`)?.focus());
    return () => cancelAnimationFrame(raf);
  }, [focus, open]);

  const view = fromIso(focus);
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first weeks
  const days = Array.from({ length: 42 }, (_, i) => toIso(new Date(first.getFullYear(), first.getMonth(), 1 - offset + i)));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }).replace(".", "").slice(0, 2),
  );
  const today = todayIso();
  const fmt = (iso: string) => fromIso(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setFocus(moves[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focus);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const navBtn = (label: string, Icon: typeof ChevronLeft, to: string) => (
    <button type="button" onClick={() => setFocus(to)} aria-label={label} title={label}
      className="grid size-7 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink">
      <Icon size={15} />
    </button>
  );

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => (open ? close() : openPicker())}
        className={cn(
          "field inline-flex items-center gap-2 text-left transition-[border-color,background-color]",
          size === "sm" && "h-8 rounded-[0.65rem] px-2.5 text-xs",
          value && "border-brand-text/50 bg-brand-soft/40",
          open && "border-brand-text",
          className,
        )}
      >
        <CalendarDays size={size === "sm" ? 13 : 15} className="shrink-0 text-ink-3" />
        <span className={cn("tabular min-w-0 flex-1 truncate", !value && "text-ink-3")}>{value ? fmt(value) : placeholder ?? t("picker.pickDate")}</span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={t("picker.clear")}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="-mr-1 grid size-5 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-muted hover:text-ink"
          >
            <X size={12} />
          </span>
        )}
      </button>

      <Popover anchor={anchor} open={open} onClose={() => close(false)} matchWidth={false} className="w-[18.5rem] p-3">
        <div role="dialog" aria-label={ariaLabel}>
          <div className="flex items-center gap-0.5">
            {navBtn(t("picker.prevYear"), ChevronsLeft, addMonths(focus, -12))}
            {navBtn(t("picker.prevMonth"), ChevronLeft, addMonths(focus, -1))}
            <p className="flex-1 text-center text-sm font-medium capitalize">
              {view.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </p>
            {navBtn(t("picker.nextMonth"), ChevronRight, addMonths(focus, 1))}
            {navBtn(t("picker.nextYear"), ChevronsRight, addMonths(focus, 12))}
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            {weekdays.map((w) => <span key={w} className="py-1">{w}</span>)}
          </div>

          <div ref={grid} role="grid" onKeyDown={onKey} className="grid grid-cols-7 gap-0.5">
            {days.map((iso) => {
              const inMonth = fromIso(iso).getMonth() === view.getMonth();
              const isSel = iso === value;
              const isToday = iso === today;
              const off = disabled(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  data-iso={iso}
                  tabIndex={iso === focus ? 0 : -1}
                  disabled={off}
                  aria-selected={isSel}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => pick(iso)}
                  className={cn(
                    "tabular grid h-9 place-items-center rounded-xl text-[13px] outline-none transition-colors",
                    !inMonth && "text-ink-3/60",
                    inMonth && !isSel && "text-ink",
                    !isSel && !off && "hover:bg-surface-muted",
                    iso === focus && !isSel && "bg-surface-muted",
                    isToday && !isSel && "font-semibold text-brand-text ring-1 ring-brand-text/50 ring-inset",
                    isSel && "bg-brand font-semibold text-brand-ink",
                    off && "cursor-not-allowed opacity-25",
                  )}
                >
                  {fromIso(iso).getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button type="button" className="rounded-lg px-2 py-1 text-xs font-medium text-brand-text hover:bg-surface-muted disabled:opacity-30"
              disabled={disabled(today)} onClick={() => pick(today)}>
              {t("picker.today")}
            </button>
            {clearable && value && (
              <button type="button" className="rounded-lg px-2 py-1 text-xs text-ink-3 hover:bg-surface-muted hover:text-ink"
                onClick={() => {
                  onChange("");
                  close();
                }}>
                {t("picker.clear")}
              </button>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}
