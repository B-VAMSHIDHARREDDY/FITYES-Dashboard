import { motion } from "framer-motion";
import { Bell, ChevronDown, FlaskConical, Moon, Plus, Search, Sun, Volume2, VolumeX } from "lucide-react";
import { type FormEvent, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useNavCounts } from "@/api/hooks";
import type { MessageKey } from "@/i18n/en";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import type { Lang } from "@/lib/format";
import { sound } from "@/lib/sound";
import { useSampleData } from "@/providers/useSampleData";
import { useTheme } from "@/providers/ThemeProvider";
import { useSoundPrefs } from "@/providers/useSound";

const TABS: { to: string; label: MessageKey; count: "listings" | "deals" | null }[] = [
  { to: "/", label: "nav.desk", count: null },
  { to: "/listings", label: "nav.listings", count: "listings" },
  { to: "/deals", label: "nav.deals", count: "deals" },
  { to: "/market", label: "nav.market", count: null },
  { to: "/partners", label: "nav.partners", count: null },
];

function SampleSwitch() {
  const { t } = useI18n();
  const { on, set } = useSampleData();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t("sample.label")}
      title={t(on ? "sample.hintOn" : "sample.hintOff")}
      onClick={() => set(!on)}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-full border pr-1.5 pl-2.5 text-xs font-medium transition-colors",
        on ? "border-brand-text/50 bg-brand-soft text-ink" : "border-line bg-surface-muted text-ink-2 hover:text-ink",
      )}
    >
      <FlaskConical size={14} className={cn(on && "text-brand-text")} />
      <span className="hidden xl:inline">{t("sample.label")}</span>
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-brand" : "bg-[var(--track)]")}>
        <motion.span
          layout
          transition={{ type: "spring", bounce: 0.25, duration: 0.3 }}
          className={cn("absolute top-0.5 size-4 rounded-full shadow-sm", on ? "right-0.5 bg-brand-ink" : "left-0.5 bg-ink-3")}
        />
      </span>
    </button>
  );
}

function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t("nav.language")} className="flex h-9 items-center rounded-full border border-line bg-surface-muted p-0.5">
      {(["de", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={cn("relative h-full rounded-full px-2.5 text-[11px] font-semibold uppercase transition-colors", lang === l ? "text-brand-ink" : "text-ink-2 hover:text-ink")}
        >
          {lang === l && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

export function TopNav() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const { effects } = useSoundPrefs();
  const { data: counts } = useNavCounts();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/listings?q=${encodeURIComponent(q.trim())}`);
    setSearchOpen(false);
  };

  return (
    <header className="card flex items-center gap-3 rounded-[1.4rem] px-3 py-2.5">
      <NavLink to="/" className="shrink-0 px-2 text-lg font-semibold tracking-tight" aria-label="FITYES">
        FITYES
      </NavLink>

      <nav className="scrollbar-thin flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-surface-muted p-1">
        {TABS.map((tab) => {
          const active = isActive(tab.to);
          const count = tab.count ? counts?.[tab.count] : undefined;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                active ? "text-brand-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {active && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-brand shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
              )}
              <span className="relative">{t(tab.label)}</span>
              {count !== undefined && (
                <span className={cn("tabular relative rounded-full px-1.5 text-[10px] font-semibold", active ? "bg-brand-ink/20" : "bg-[var(--track)] text-ink-2")}>
                  {count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <form onSubmit={submitSearch} className="hidden items-center md:flex">
          <motion.div
            animate={{ width: searchOpen ? 220 : 36 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            className="relative flex h-9 items-center overflow-hidden rounded-full border border-line bg-surface-muted"
          >
            <button type="button" aria-label={t("nav.search")} onClick={() => setSearchOpen((o) => !o)} className="grid size-9 shrink-0 place-items-center text-ink-2 hover:text-ink">
              <Search size={16} />
            </button>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => !q && setSearchOpen(false)}
              tabIndex={searchOpen ? 0 : -1}
              placeholder={t("nav.searchPlaceholder")}
              className="h-full w-full bg-transparent pr-3 text-sm outline-none placeholder:text-ink-3"
            />
          </motion.div>
        </form>

        <button className="btn btn-primary hidden lg:inline-flex" onClick={() => navigate("/listings?new=1")}>
          <Plus size={15} /> {t("nav.new")}
        </button>

        <SampleSwitch />

        <LanguageSwitch />

        <button
          className="icon-btn hidden sm:inline-grid"
          onClick={() => sound.setEffects(!effects)}
          aria-label={t(effects ? "nav.soundOff" : "nav.soundOn")}
          aria-pressed={effects}
          title={t(effects ? "nav.soundOff" : "nav.soundOn")}
          data-no-sound
        >
          {effects ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button className="icon-btn" onClick={toggle} aria-label={t("nav.theme")} title={t("nav.theme")}>
          <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </motion.span>
        </button>

        <button className="icon-btn relative" aria-label={t("nav.attention")} onClick={() => navigate("/deals")}>
          <Bell size={16} />
          {!!counts?.attention && (
            <span className="tabular absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-bad-soft px-1 text-[9px] font-bold text-bad-on">
              {counts.attention > 9 ? "9+" : counts.attention}
            </span>
          )}
        </button>

        <button className="hidden items-center gap-1 text-ink-2 xl:flex" aria-label={t("nav.account")}>
          <span className="relative grid size-8 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text">
            LH
            <span className="absolute right-0 bottom-0 size-2 rounded-full bg-good-fill ring-2 ring-[var(--surface-solid)]" />
          </span>
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  );
}
