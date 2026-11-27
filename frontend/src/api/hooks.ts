import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type {
  Activity,
  AgentStats,
  DashboardSummary,
  DealDetail,
  DealListItem,
  DealStage,
  NavCounts,
  NeighborhoodStat,
  OfferInput,
  Page,
  Partner,
  PartnerUpdate,
  PipelineStage,
  Property,
  PropertyCreate,
  PropertyQuery,
  PropertyUpdate,
  TrendPoint,
} from "./types";

export const qk = {
  health: ["health"] as const,
  counts: ["meta", "counts"] as const,
  summary: ["dashboard", "summary"] as const,
  pipeline: ["dashboard", "pipeline"] as const,
  trends: (neighborhood: string | null, months: number) => ["market", "trends", neighborhood, months] as const,
  neighborhoods: ["market", "neighborhoods"] as const,
  agents: ["agents"] as const,
  activities: (limit: number, dealId?: number) => ["activities", limit, dealId ?? null] as const,
  properties: (q: PropertyQuery) => ["properties", q] as const,
  cities: ["properties", "cities"] as const,
  deals: (stage: DealStage | null, q: string, pageSize: number) => ["deals", stage, q, pageSize] as const,
  deal: (id: number) => ["deal", id] as const,
  partners: ["partners"] as const,
};

/* ---------- queries ---------- */

export const useHealth = () =>
  useQuery({
    queryKey: qk.health,
    queryFn: ({ signal }) => api.get<{ status: string }>("/health", undefined, signal),
    refetchInterval: 30_000,
    retry: false,
  });

export const useNavCounts = () =>
  useQuery({ queryKey: qk.counts, queryFn: ({ signal }) => api.get<NavCounts>("/meta/counts", undefined, signal) });

export const useSummary = () =>
  useQuery({
    queryKey: qk.summary,
    queryFn: ({ signal }) => api.get<DashboardSummary>("/dashboard/summary", undefined, signal),
  });

export const usePipeline = () =>
  useQuery({
    queryKey: qk.pipeline,
    queryFn: ({ signal }) => api.get<PipelineStage[]>("/dashboard/pipeline", undefined, signal),
  });

export const useTrends = (neighborhood: string | null, months: number) =>
  useQuery({
    queryKey: qk.trends(neighborhood, months),
    queryFn: ({ signal }) =>
      api.get<TrendPoint[]>("/market/trends", { neighborhood: neighborhood ?? undefined, months }, signal),
    placeholderData: keepPreviousData,
  });

export const useNeighborhoods = () =>
  useQuery({
    queryKey: qk.neighborhoods,
    queryFn: ({ signal }) => api.get<NeighborhoodStat[]>("/market/neighborhoods", undefined, signal),
    staleTime: 5 * 60_000,
  });

export const useAgents = () =>
  useQuery({ queryKey: qk.agents, queryFn: ({ signal }) => api.get<AgentStats[]>("/agents", undefined, signal) });

export const useActivities = (limit = 12, dealId?: number) =>
  useQuery({
    queryKey: qk.activities(limit, dealId),
    queryFn: ({ signal }) => api.get<Activity[]>("/activities", { limit, deal_id: dealId }, signal),
  });

export const useProperties = (query: PropertyQuery) =>
  useQuery({
    queryKey: qk.properties(query),
    queryFn: ({ signal }) => api.get<Page<Property>>("/properties", { ...query }, signal),
    placeholderData: keepPreviousData,
  });

export const useCities = () =>
  useQuery({
    queryKey: qk.cities,
    queryFn: ({ signal }) => api.get<string[]>("/properties/cities", undefined, signal),
    staleTime: Infinity,
  });

export const useDeals = (stage: DealStage | null, q = "", pageSize = 50) =>
  useQuery({
    queryKey: qk.deals(stage, q, pageSize),
    queryFn: ({ signal }) =>
      api.get<Page<DealListItem>>("/deals", { stage: stage ?? undefined, q, page_size: pageSize }, signal),
    placeholderData: keepPreviousData,
  });

export const useDeal = (id: number) =>
  useQuery({
    queryKey: qk.deal(id),
    queryFn: ({ signal }) => api.get<DealDetail>(`/deals/${id}`, undefined, signal),
    enabled: Number.isFinite(id),
  });

export const usePartners = () =>
  useQuery({
    queryKey: qk.partners,
    queryFn: ({ signal }) => api.get<Page<Partner>>("/clients", { page_size: 500 }, signal),
  });

/* ---------- mutations ---------- */

function useDealMutation<V>(id: number, fn: (vars: V) => Promise<DealDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (deal) => {
      qc.setQueryData(qk.deal(id), deal);
      // Aggregates depending on deal state
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      void qc.invalidateQueries({ queryKey: qk.counts });
      void qc.invalidateQueries({ queryKey: qk.agents });
      void qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export const useSaveOffer = (id: number) =>
  useDealMutation(id, (offer: OfferInput) => api.put<DealDetail>(`/deals/${id}/offer`, offer));

export const useAdvanceDeal = (id: number) =>
  useDealMutation(id, () => api.post<DealDetail>(`/deals/${id}/advance`));

export const useMarkLost = (id: number) =>
  useDealMutation(id, (reason: string) => api.post<DealDetail>(`/deals/${id}/lost`, { reason }));

export const useToggleChecklist = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) =>
      api.patch<DealDetail>(`/deals/${id}/checklist/${itemId}`, { done }),
    // Optimistic toggle — the checkbox should feel instant.
    onMutate: async ({ itemId, done }) => {
      await qc.cancelQueries({ queryKey: qk.deal(id) });
      const prev = qc.getQueryData<DealDetail>(qk.deal(id));
      if (prev) {
        qc.setQueryData<DealDetail>(qk.deal(id), {
          ...prev,
          checklist: prev.checklist.map((i) => (i.id === itemId ? { ...i, done } : i)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.deal(id), ctx.prev),
    onSuccess: (deal) => {
      qc.setQueryData(qk.deal(id), deal);
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: qk.counts });
      void qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
};

export const useCreateProperty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PropertyCreate) => api.post<Property>("/properties", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["properties"] });
      void qc.invalidateQueries({ queryKey: qk.counts });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
};

/** Fill in missing partner data; the saved row replaces the cached one (no refetch of all 295). */
export const useUpdatePartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PartnerUpdate }) => api.patch<Partner>(`/clients/${id}`, body),
    onSuccess: (saved) => {
      qc.setQueryData<Page<Partner>>(qk.partners, (old) =>
        old ? { ...old, items: old.items.map((p) => (p.id === saved.id ? saved : p)) } : old,
      );
    },
  });
};

export const useUpdateProperty = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PropertyUpdate) => api.patch<Property>(`/properties/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["properties"] });
      void qc.invalidateQueries({ queryKey: qk.counts });
      void qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
};
