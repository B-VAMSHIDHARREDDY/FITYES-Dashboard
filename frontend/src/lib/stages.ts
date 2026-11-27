import {
  CalendarCheck,
  Eye,
  FileSignature,
  Handshake,
  KeyRound,
  type LucideIcon,
  Sparkles,
  XCircle,
} from "lucide-react";

import type { DealStage, ListingStatus } from "@/api/types";

// Labels & hints live in the i18n dictionaries (`stage.*`, `stageHint.*`).
export const PIPELINE: DealStage[] = ["lead", "viewing", "offer", "under_contract", "closing", "closed"];
export const OPEN_STAGES: DealStage[] = ["lead", "viewing", "offer", "under_contract", "closing"];

export const STAGE_ICON: Record<DealStage, LucideIcon> = {
  lead: Sparkles,
  viewing: Eye,
  offer: FileSignature,
  under_contract: Handshake,
  closing: CalendarCheck,
  closed: KeyRound,
  lost: XCircle,
};

export const nextStage = (s: DealStage): DealStage | null => {
  const i = PIPELINE.indexOf(s);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
};

/** Typical days per stage in German transactions — used to estimate upcoming milestones. */
export const TYPICAL_DAYS: Record<DealStage, number> = {
  lead: 7,
  viewing: 10,
  offer: 8,
  under_contract: 28,
  closing: 21,
  closed: 0,
  lost: 0,
};

export const LISTING_TONE: Record<ListingStatus, "brand" | "warn" | "neutral" | "good"> = {
  active: "brand",
  pending: "warn",
  sold: "good",
  off_market: "neutral",
};
