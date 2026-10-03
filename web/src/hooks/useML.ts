import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  explainCreditRiskForCustomer,
  getCreditRiskGlobalImportance,
  getCreditRiskModelInfo,
  getDemandForecastNext7Days,
  getDemandForecastNextDay,
  getDemandGlobalImportance,
  getDemandModelInfo,
  getDemandStockSummary,
  applySuggestedCreditLimit,
} from '@/services/ml.service';
import { qk, STALE } from '@/lib/queryKeys';

// ── Credit risk (per customer; backend computes features from the DB) ─────────

export function useCreditRiskExplain(shopId: string, customerId: string | null) {
  return useQuery({
    queryKey: qk.creditRiskExplain(shopId, customerId ?? ''),
    queryFn: () => explainCreditRiskForCustomer(shopId, customerId!),
    enabled: !!shopId && !!customerId,
    staleTime: STALE.normal,
  });
}

/** Sets customers.credit_limit to the server's suggestion (the only credit limit). */
export function useApplyCreditLimit(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => applySuggestedCreditLimit(shopId, customerId),
    meta: { errorMessage: 'Could not update the credit limit' },
    onSuccess: async (r) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.creditRisk(shopId) }),
        qc.invalidateQueries({ queryKey: qk.customers(shopId) }),
        qc.invalidateQueries({ queryKey: qk.dashboard(shopId) }),
      ]);
      toast.success(
        r.recommended_credit_limit === r.previous_credit_limit
          ? 'Credit limit already matches the suggestion'
          : `Credit limit set to Rs. ${r.recommended_credit_limit.toLocaleString('en-IN')}`
      );
    },
  });
}

export function useCreditRiskGlobalImportance(enabled = true) {
  return useQuery({
    queryKey: qk.creditRiskGlobalImportance,
    queryFn: getCreditRiskGlobalImportance,
    enabled,
    staleTime: STALE.slow,
  });
}

export function useCreditRiskModelInfo(enabled = true) {
  return useQuery({
    queryKey: qk.creditRiskModelInfo,
    queryFn: getCreditRiskModelInfo,
    enabled,
    staleTime: STALE.slow,
  });
}

// ── Demand (per product; backend builds sales history and persists forecasts) ──

export function useDemandForecast7Days(shopId: string, productId: string | null) {
  return useQuery({
    queryKey: qk.demand7Days(shopId, productId ?? ''),
    queryFn: () => getDemandForecastNext7Days(shopId, productId!),
    enabled: !!shopId && !!productId,
    staleTime: STALE.normal,
  });
}

export function useDemandForecastNextDay(shopId: string, productId: string | null) {
  return useQuery({
    queryKey: qk.demandNextDay(shopId, productId ?? ''),
    queryFn: () => getDemandForecastNextDay(shopId, productId!),
    enabled: !!shopId && !!productId,
    staleTime: STALE.normal,
  });
}

export function useDemandStockSummary(shopId: string, productId: string | null, lastDate?: string) {
  return useQuery({
    queryKey: qk.demandStockSummary(shopId, productId ?? '', lastDate),
    queryFn: () => getDemandStockSummary(shopId, productId!, lastDate),
    enabled: !!shopId && !!productId,
    staleTime: STALE.live,
  });
}

export function useDemandModelInfo(enabled = true) {
  return useQuery({
    queryKey: qk.demandModelInfo,
    queryFn: getDemandModelInfo,
    enabled,
    staleTime: STALE.slow,
  });
}

export function useDemandGlobalImportance(enabled = true) {
  return useQuery({
    queryKey: qk.demandGlobalImportance,
    queryFn: getDemandGlobalImportance,
    enabled,
    staleTime: STALE.slow,
  });
}
