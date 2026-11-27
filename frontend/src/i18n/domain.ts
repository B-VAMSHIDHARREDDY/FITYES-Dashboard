/** Translators for server data (activities, checklist items, API errors). */
import { ApiError } from "@/api/client";
import type { Activity, ChecklistItem } from "@/api/types";
import { money, pct } from "@/lib/format";

import { type MessageKey } from "./en";
import { tKey, type TFn } from "./I18nProvider";

export const stageLabel = (t: TFn, stage: string) => tKey(t, "stage", stage);

export const checklistTitle = (t: TFn, item: Pick<ChecklistItem, "code" | "title">) => tKey(t, "check", item.code, item.title);

export function activityText(t: TFn, a: Activity): string {
  const p = a.payload as Record<string, unknown> | null;
  if (!p) return a.message;
  const s = (k: string) => String(p[k] ?? "");
  const n = (k: string) => Number(p[k] ?? 0);
  switch (a.kind) {
    case "listing_created":
      return t("act.listing_created", { title: s("title") });
    case "price_change":
      return t(n("new") < n("old") ? "act.price_reduced" : "act.price_raised", { title: s("title"), old: money(n("old")), new: money(n("new")) });
    case "stage_change":
      return s("stage") === "lost" && p.reason
        ? t("act.lost", { code: s("code"), reason: s("reason") })
        : t("act.stage_change", { code: s("code"), stage: stageLabel(t, s("stage")) });
    case "offer_updated":
      return t("act.offer_updated", { code: s("code"), version: s("version"), price: money(n("price")), pct: pct(n("pct")) });
    case "checklist":
      return t(p.done ? "act.resolved" : "act.reopened", { item: tKey(t, "check", p.item as string | null, s("title")) });
    default:
      return a.message;
  }
}

/** Localized message for an API error, using the server's stable `code` + `params`. */
export function errorText(t: TFn, err: unknown): string {
  if (!(err instanceof ApiError)) return t("error.generic");
  const params = { ...err.params };
  if (typeof params.stage === "string") params.stage = stageLabel(t, params.stage);
  const key = `error.${err.code}` as MessageKey;
  const out = t(key, params as Record<string, string | number>);
  return out === key ? err.message : out;
}
