import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useHealth } from "@/api/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { clock } from "@/lib/format";

export interface Crumb {
  label: string;
  to?: string;
}

export interface SubTab<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

function LiveStatus() {
  const { isError, isSuccess } = useHealth();
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const time = clock(now);
  return (
    <span className="hidden items-center gap-1.5 text-xs text-ink-3 lg:flex">
      <span className="relative flex size-2">
        {isSuccess && <span className="absolute inline-flex size-full animate-ping rounded-full bg-good-fill opacity-60" />}
        <span className={cn("relative inline-flex size-2 rounded-full", isError ? "bg-bad-soft" : isSuccess ? "bg-good-fill" : "bg-ink-3")} />
      </span>
      {t(isError ? "status.offline" : "status.online")} · {time}
    </span>
  );
}

export function SubBar<T extends string>({
  crumbs,
  tabs,
  active,
  onTab,
  right,
}: {
  crumbs: Crumb[];
  tabs?: SubTab<T>[];
  active?: T;
  onTab?: (t: T) => void;
  right?: ReactNode;
}) {
  return (
    <div className="card mt-3 flex min-h-11 flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl px-4 py-1.5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-ink-3">
        {crumbs.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && <ChevronRight size={12} />}
            {c.to ? (
              <Link to={c.to} className="hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className="max-w-48 truncate font-medium text-ink">{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>

      {tabs && (
        <>
          <span className="hidden h-4 w-px bg-[var(--line)] sm:block" />
          <div role="tablist" className="flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={active === t.value}
                onClick={() => onTab?.(t.value)}
                className={cn("relative flex items-center gap-1.5 px-2.5 py-2 text-[13px] transition-colors", active === t.value ? "font-medium text-ink" : "text-ink-2 hover:text-ink")}
              >
                {t.label}
                {!!t.badge && <span className="tabular grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-ink">{t.badge}</span>}
                {active === t.value && <motion.span layoutId="subtab-underline" className="absolute inset-x-2 -bottom-1.5 h-0.5 rounded-full bg-brand" />}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        {right}
        <LiveStatus />
      </div>
    </div>
  );
}
