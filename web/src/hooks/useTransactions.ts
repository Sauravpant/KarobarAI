import { useMutation, useQuery, useInfiniteQuery, useQueryClient, keepPreviousData, type QueryKey } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getTransactions,
  getTransaction,
  createTransaction,
  getCreditSales,
  updateCreditSale,
  getTransactionStats,
} from '@/services/transaction.service';
import { qk, STALE } from '@/lib/queryKeys';
import type { CreateTransactionPayload, UpdateCreditSalePayload, CreditStatus, PaymentType } from '@/types';

export function useInfiniteTransactions(
  shopId: string,
  filters: { payment_type?: PaymentType; search?: string; limit?: number } = {}
) {
  const { payment_type, search, limit = 25 } = filters;
  return useInfiniteQuery({
    queryKey: qk.transactionList(shopId, { payment_type, search }),
    queryFn: ({ pageParam }) =>
      getTransactions(shopId, {
        page: pageParam,
        limit,
        payment_type,
        search: search || undefined,
        include_stats: false,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
    enabled: !!shopId,
    staleTime: STALE.live,
    placeholderData: keepPreviousData,
  });
}

export function useTransactionStats(shopId: string) {
  return useQuery({
    queryKey: qk.transactionStats(shopId),
    queryFn: () => getTransactionStats(shopId),
    enabled: !!shopId,
    staleTime: STALE.live,
  });
}

export function useTransaction(shopId: string, transactionId: string) {
  return useQuery({
    queryKey: qk.transaction(shopId, transactionId),
    queryFn: () => getTransaction(shopId, transactionId),
    enabled: !!shopId && !!transactionId,
  });
}

export function useCreateTransaction(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) => createTransaction(shopId, payload),
    meta: { errorMessage: 'Failed to record transaction' },
    onSuccess: async (tx) => {
      const keys: QueryKey[] = [
        qk.transactions(shopId),
        qk.dashboard(shopId),
        qk.products(shopId), // stock moved
        qk.demandForecast(shopId), // stock summary uses current stock
      ];
      if (tx.payment_type === 'credit' || tx.customer_id) {
        keys.push(qk.creditSales(shopId), qk.customers(shopId), qk.creditRisk(shopId));
      }
      await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success('Transaction recorded');
    },
  });
}

export function useCreditSales(shopId: string, status?: CreditStatus) {
  return useQuery({
    queryKey: qk.creditSaleList(shopId, status),
    queryFn: () => getCreditSales(shopId, status),
    enabled: !!shopId,
    staleTime: STALE.normal,
  });
}

export function useUpdateCreditSale(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creditSaleId, payload }: { creditSaleId: string; payload: UpdateCreditSalePayload }) =>
      updateCreditSale(shopId, creditSaleId, payload),
    meta: { errorMessage: 'Failed to update credit sale' },
    onSuccess: async (updated) => {
      await Promise.all(
        [
          qk.creditSales(shopId),
          qk.transactions(shopId), // transactions embed their credit_sale
          qk.customers(shopId), // outstanding balance
          qk.creditRisk(shopId),
          qk.dashboard(shopId),
        ].map((queryKey) => qc.invalidateQueries({ queryKey }))
      );
      toast.success(updated.status === 'paid' ? 'Payment recorded. Balance updated.' : 'Credit sale updated');
    },
  });
}
