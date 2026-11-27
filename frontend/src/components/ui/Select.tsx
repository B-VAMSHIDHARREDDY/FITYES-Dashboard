import { Check, ChevronDown, Search } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";

import { Popover } from "./Popover";

export interface SelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** plain text used for search / type-ahead when `label` is not a string */
  text?: string;
  /** right-aligned secondary text, e.g. a count */
  hint?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * Themed replacement for <select>: check-marked options, hints, keyboard navigation
 * (↑ ↓ Home End Enter Esc, type-ahead) and a search box for long lists.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  searchable,
  size = "md",
  active,
  align = "start",
  icon,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  ariaLabel: string;
  placeholder?: string;
  /** defaults to true for lists longer than 10 */
  searchable?: boolean;
  size?: "sm" | "md";
  /** highlight the trigger (e.g. a filter that is not at its default) */
  active?: boolean;
  align?: "start" | "end";
  icon?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);

  const canSearch = searchable ?? options.length > 10;
  const textOf = (o: SelectOption<T>) => o.text ?? (typeof o.label === "string" ? o.label : String(o.value));
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    // names starting with the query first ("ber" → Berlin before Allersberg), then other matches
    const starts = options.filter((o) => textOf(o).toLowerCase().startsWith(needle));
    const contains = options.filter((o) => !starts.includes(o) && textOf(o).toLowerCase().includes(needle));
    return [...starts, ...contains];
  }, [options, q]);
  const selected = options.find((o) => o.value === value);

  const openMenu = () => {
    setQ("");
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) anchor.current?.focus();
  }, []);
  const pick = (o: SelectOption<T> | undefined) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => (canSearch ? search.current : list.current)?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, canSearch]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const move = (dir: 1 | -1) =>
    setHi((h) => {
      let i = h;
      for (let k = 0; k < shown.length; k++) {
        i = (i + dir + shown.length) % shown.length;
        if (!shown[i].disabled) return i;
      }
      return h;
    });

  const onKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        if (!canSearch) {
          e.preventDefault();
          setHi(0);
        }
        break;
      case "End":
        if (!canSearch) {
          e.preventDefault();
          setHi(shown.length - 1);
        }
        break;
      case "Enter":
        e.preventDefault();
        pick(shown[hi]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!canSearch && e.key.length === 1) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
          const i = shown.findIndex((o) => !o.disabled && textOf(o).toLowerCase().startsWith(typed.current.text));
          if (i >= 0) setHi(i);
        }
    }
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          "field inline-flex items-center gap-2 text-left transition-[border-color,background-color]",
          size === "sm" && "h-8 rounded-[0.65rem] px-2.5 text-xs",
          active && "border-brand-text/50 bg-brand-soft/40",
          open && "border-brand-text",
          className,
        )}
      >
        {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-ink-3")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={size === "sm" ? 13 : 15} className={cn("shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      <Popover anchor={anchor} open={open} onClose={() => close(false)} align={align} className="w-max max-w-[min(22rem,calc(100vw-16px))]">
        {canSearch && (
          <div className="relative p-1 pb-1.5">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input
              ref={search}
              className="field h-8 w-full pl-8 text-xs"
              placeholder={t("picker.search")}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={onKey}
              aria-controls={id}
              aria-activedescendant={shown[hi] ? `${id}-${hi}` : undefined}
            />
          </div>
        )}
        <div
          ref={list}
          id={id}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={canSearch ? undefined : onKey}
          aria-activedescendant={!canSearch && shown[hi] ? `${id}-${hi}` : undefined}
          className="scrollbar-thin max-h-72 overflow-y-auto outline-none"
        >
          {shown.map((o, i) => {
            const isSel = o.value === value;
            return (
              <div
                key={String(o.value)}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => !o.disabled && setHi(i)}
                onClick={() => pick(o)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] transition-colors",
                  i === hi && !o.disabled && "bg-surface-muted",
                  isSel ? "font-medium text-ink" : "text-ink-2",
                  o.disabled && "cursor-not-allowed opacity-35",
                )}
              >
                <Check size={14} strokeWidth={2.5} className={cn("shrink-0 text-brand-text", !isSel && "invisible")} />
                {o.icon && <span className="shrink-0 text-ink-3">{o.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint != null && <span className="tabular ml-4 shrink-0 text-[11px] text-ink-3">{o.hint}</span>}
              </div>
            );
          })}
          {shown.length === 0 && <p className="px-3 py-5 text-center text-xs text-ink-3">{t("picker.noResults")}</p>}
        </div>
      </Popover>
    </>
  );
}
