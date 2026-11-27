// Mirrors backend/app/schemas/*. Keep in sync with the OpenAPI spec at /api/v1/openapi.json.

export type PropertyType = "single_family" | "condo" | "townhouse" | "multi_family" | "land";
export type ListingStatus = "active" | "pending" | "sold" | "off_market";
export type DealStage = "lead" | "viewing" | "offer" | "under_contract" | "closing" | "closed" | "lost";
export type ChecklistKind = "check" | "question";
export type ActivityKind =
  | "listing_created"
  | "price_change"
  | "stage_change"
  | "offer_updated"
  | "checklist"
  | "note";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** A partner from the imported Excel list (stored in `clients`). */
export interface Partner {
  id: number;
  name: string;
  email: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  invoice_paid_at: string | null;
}

export type PartnerUpdate = Partial<Omit<Partner, "id">>;

export interface AgentRef {
  id: number;
  name: string;
  title: string;
  avatar_color: string;
}

export interface Property {
  id: number;
  code: string;
  title: string;
  address: string;
  city: string;
  neighborhood: string;
  state: string;
  zip_code: string;
  property_type: PropertyType;
  status: ListingStatus;
  list_price: number;
  sold_price: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  plot_sqm: number | null;
  year_built: number | null;
  hoa_monthly: number;
  tax_annual: number;
  listed_at: string;
  sold_at: string | null;
  description: string | null;
  agent: AgentRef | null;
  days_on_market: number;
  price_per_sqm: number;
}

export interface PropertyCreate {
  title: string;
  address: string;
  city: string;
  neighborhood: string;
  state: string;
  zip_code: string;
  property_type: PropertyType;
  list_price: number;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  year_built?: number | null;
  hoa_monthly?: number;
  tax_annual?: number;
  description?: string | null;
}

export interface PropertyUpdate {
  title?: string;
  status?: ListingStatus;
  list_price?: number;
  description?: string | null;
}

export interface PropertyQuery {
  q?: string;
  status?: ListingStatus;
  property_type?: PropertyType;
  city?: string;
  min_price?: number;
  max_price?: number;
  min_beds?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "area_desc" | "dom_desc";
  page?: number;
  page_size?: number;
}

export interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  kind: "buyer" | "seller" | "investor";
  pre_approved_amount: number | null;
}

export interface StageEvent {
  stage: DealStage;
  entered_at: string;
}

export interface ChecklistItem {
  id: number;
  stage: DealStage;
  kind: ChecklistKind;
  code: string | null;
  title: string;
  done: boolean;
  done_at: string | null;
}

export interface OfferTerms {
  offer_price: number;
  down_payment_pct: number;
  interest_rate: number;
  loan_term_years: number;
  commission_rate: number;
  offer_version: number;
}

export type OfferInput = Omit<OfferTerms, "offer_version">;

export interface OfferBreakdown {
  offer_price: number;
  list_price: number;
  delta_vs_list: number;
  delta_vs_list_pct: number;
  down_payment: number;
  loan_amount: number;
  monthly_principal_interest: number;
  monthly_tax: number;
  monthly_hoa: number;
  monthly_total: number;
  commission: number;
}

export interface DealListItem {
  id: number;
  code: string;
  stage: DealStage;
  stage_entered_at: string;
  days_in_stage: number;
  target_close_date: string | null;
  offer_price: number;
  list_price: number;
  property_id: number;
  property_title: string;
  property_address: string;
  neighborhood: string;
  city: string;
  client_name: string;
  agent: AgentRef | null;
  open_items: number;
}

export interface DealDetail {
  id: number;
  code: string;
  stage: DealStage;
  stage_entered_at: string;
  days_in_stage: number;
  target_close_date: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  channel: string;
  financing: string;
  created_at: string;
  property: Property;
  client: Client;
  agent: AgentRef | null;
  offer: OfferTerms;
  breakdown: OfferBreakdown;
  stage_events: StageEvent[];
  checklist: ChecklistItem[];
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "number" | "currency" | "days" | "percent";
  delta_pct: number | null;
  hint: string;
  meta: Record<string, number>;
  trend: number[];
}

export interface DashboardSummary {
  generated_at: string;
  kpis: Kpi[];
}

export interface PipelineStage {
  stage: DealStage;
  count: number;
  value: number;
}

export interface NavCounts {
  listings: number;
  deals: number;
  attention: number;
}

export interface TrendPoint {
  month: string;
  median_price: number;
  price_per_sqm: number;
  inventory: number;
  new_listings: number;
  closed_sales: number;
  avg_days_on_market: number;
}

export interface NeighborhoodStat {
  neighborhood: string;
  city: string;
  median_price: number;
  yoy_pct: number;
  price_per_sqm: number;
  inventory: number;
  avg_days_on_market: number;
  months_of_supply: number;
  sparkline: number[];
}

export interface AgentStats {
  agent: AgentRef;
  region: string;
  active_listings: number;
  open_deals: number;
  closed_deals: number;
  closed_volume: number;
  pipeline_value: number;
  commission_earned: number;
}

export interface Activity {
  id: number;
  kind: ActivityKind;
  message: string;
  payload: Record<string, unknown> | null;
  deal_id: number | null;
  property_id: number | null;
  agent: AgentRef | null;
  created_at: string;
}
