import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { type Lang, setFormatLocale } from "@/lib/format";

import { de } from "./de";
import { en, type MessageKey } from "./en";

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, de };
const KEY = "fityes-lang";

export type Vars = Record<string, string | number>;
export type TFn = (key: MessageKey, vars?: Vars) => string;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
  /** Plural helper: picks `${base}_one` / `${base}_other` and injects `{n}`. */
  tn: (base: string, n: number, vars?: Vars) => string;
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "de") return saved;
  } catch {
    /* storage unavailable */
  }
  // German client: default to German unless the browser is clearly non-German.
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "de";
}

const interpolate = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  setFormatLocale(lang); // synchronous so formatters are correct in this render pass

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const value = useMemo<I18n>(() => {
    const dict = DICTS[lang];
    const t: TFn = (key, vars) => interpolate(dict[key] ?? en[key] ?? key, vars);
    const tn = (base: string, n: number, vars?: Vars) =>
      t(`${base}_${n === 1 ? "one" : "other"}` as MessageKey, { n, ...vars });
    return { lang, setLang, t, tn };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Translate a key whose suffix comes from data (e.g. `stage.${stage}`), falling back to the raw value. */
export function tKey(t: TFn, prefix: string, value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback ?? "";
  const key = `${prefix}.${value}` as MessageKey;
  const out = t(key);
  return out === key ? (fallback ?? value) : out;
}
