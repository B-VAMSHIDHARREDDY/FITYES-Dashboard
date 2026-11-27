/**
 * Locale-aware formatting (EUR, m², dates). The active locale is set by the I18nProvider;
 * components re-render on language change because they consume the i18n context.
 */
export type Lang = "en" | "de";

let locale = "de-DE";
const cache = new Map<string, Intl.NumberFormat>();

export function setFormatLocale(lang: Lang) {
  locale = lang === "de" ? "de-DE" : "en-GB";
}

function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `${locale}|${key}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    cache.set(k, f);
  }
  return f;
}

export const money = (n: number) => nf("eur0", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const moneyCompact = (n: number) =>
  Math.abs(n) < 10_000
    ? money(n)
    : nf("eurC", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: Math.abs(n) >= 1e6 ? 2 : 0 }).format(n);
export const number = (n: number) => nf("int", { maximumFractionDigits: 0 }).format(n);
export const decimal = (n: number, digits = 1) =>
  nf(`dec${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export const pct = (n: number, digits = 1) =>
  nf(`pct${digits}`, { style: "percent", signDisplay: "exceptZero", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n / 100);
export const rate = (n: number, digits = 2) =>
  nf(`rate${digits}`, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n / 100);
export const area = (n: number) => `${number(n)} m²`;

const parse = (iso: string) => (iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso));

export const shortDate = (iso: string) => parse(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
export const longDate = (iso: string) => parse(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
export const monthLabel = (iso: string) => parse(iso).toLocaleDateString(locale, { month: "short", year: "2-digit" });
export const fullDate = (d: Date) => d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
export const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const diff = (parse(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "minute");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return shortDate(iso);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
