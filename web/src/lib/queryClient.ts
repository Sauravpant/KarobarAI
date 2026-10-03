import { MutationCache, QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { STALE } from '@/lib/queryKeys';

/** Backend errors come back as { success: false, message, detail }. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { errorMessage?: string };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.normal,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // Don't retry client errors (401/403/404/422); they won't fix themselves
        if (status && status >= 400 && status < 500) return false;
        return count < 1;
      },
    },
  },
  // One place that surfaces every failed mutation, so none fail silently
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      toast.error(errorMessage(err, mutation.meta?.errorMessage));
    },
  }),
});
