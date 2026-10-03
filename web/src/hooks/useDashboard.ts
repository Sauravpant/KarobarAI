import { useQuery } from '@tanstack/react-query';
import { getDashboardData, getDailyBrief } from '@/services/dashboard.service';
import { qk, STALE } from '@/lib/queryKeys';

export function useDashboard(shopId: string) {
  return useQuery({
    queryKey: qk.dashboard(shopId),
    queryFn: () => getDashboardData(shopId),
    enabled: !!shopId,
    staleTime: STALE.live,
    refetchOnWindowFocus: true,
  });
}

/**
 * The backend generates the brief once per shop and date (LLM call) and serves
 * the stored row after that, so refetching can't change it. Fetch once per session.
 */
export function useDailyBrief(shopId: string, briefDate?: string) {
  return useQuery({
    queryKey: qk.brief(shopId, briefDate),
    queryFn: () => getDailyBrief(shopId, briefDate),
    enabled: !!shopId,
    staleTime: Infinity,
    retry: false,
  });
}
