import { useMutation, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getTransactions,
  getTransaction,
  createTransaction,
  getCreditSales,
  updateCreditSale,
  getTransactionStats,
} from "@/services/transaction.service";
import { queryClient } from "@/lib/queryClient";
import type {
  CreateTransactionPayload,
  UpdateCreditSalePayload,
  CreditStatus,
  PaymentType,
} from "@/types";

export function useInfiniteTransactions(
  shopId: string,
  filters?: {
    payment_type?: PaymentType;
    search?: string;
    limit?: number;
  }
) {
  return useInfiniteQuery({
    queryKey: ["transactions", "infinite", shopId, filters?.payment_type, filters?.search],
    queryFn: ({ pageParam = 1 }) =>
      getTransactions(shopId, {
        page: pageParam,
        limit: filters?.limit ?? 25,
        payment_type: filters?.payment_type,
        search: filters?.search || undefined,
        include_stats: pageParam === 1,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? lastPage.page + 1 : undefined;
    },
    enabled: !!shopId,
  });
}

export function useTransactionStats(shopId: string) {
  return useQuery({
    queryKey: ["transactions", "stats", shopId],
    queryFn: () => getTransactionStats(shopId),
    enabled: !!shopId,
  });
}

export function useTransactions(shopId: string) {
  return useQuery({
    queryKey: ["transactions", shopId],
    queryFn: () => getTransactions(shopId, { limit: 50 }),
    enabled: !!shopId,
  });
}

export function useTransaction(shopId: string, transactionId: string) {
  return useQuery({
    queryKey: ["transactions", shopId, transactionId],
    queryFn: () => getTransaction(shopId, transactionId),
    enabled: !!shopId && !!transactionId,
  });
}

export function useCreateTransaction(shopId: string) {
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) =>
      createTransaction(shopId, payload),
    onSuccess: (newTx) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", shopId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", shopId] });
      void queryClient.refetchQueries({ queryKey: ["transactions", shopId] });
      void queryClient.refetchQueries({ queryKey: ["dashboard", shopId] });
      // Credit transactions affect customer balance
      if (newTx.customer_id) {
        queryClient.invalidateQueries({ queryKey: ["customers", shopId] });
        queryClient.invalidateQueries({ queryKey: ["credit-sales", shopId] });
        void queryClient.refetchQueries({ queryKey: ["customers", shopId] });
        void queryClient.refetchQueries({ queryKey: ["credit-sales", shopId] });
      }
      // Transactions deduct product stock
      queryClient.invalidateQueries({ queryKey: ["products", shopId] });
      void queryClient.refetchQueries({ queryKey: ["products", shopId] });
      toast.success("Transaction recorded!");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Failed to record transaction",
      );
    },
  });
}

export function useCreditSales(shopId: string, status?: CreditStatus) {
  return useQuery({
    queryKey: ["credit-sales", shopId, status],
    queryFn: () => getCreditSales(shopId, status),
    enabled: !!shopId,
  });
}

export function useUpdateCreditSale(shopId: string) {
  return useMutation({
    mutationFn: ({
      creditSaleId,
      payload,
    }: {
      creditSaleId: string;
      payload: UpdateCreditSalePayload;
    }) => updateCreditSale(shopId, creditSaleId, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["credit-sales", shopId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", shopId] });
      void queryClient.refetchQueries({ queryKey: ["credit-sales", shopId] });
      void queryClient.refetchQueries({ queryKey: ["transactions", shopId] });
      // Paying off credit changes customer balance
      queryClient.invalidateQueries({ queryKey: ["customers", shopId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", shopId] });
      void queryClient.refetchQueries({ queryKey: ["customers", shopId] });
      void queryClient.refetchQueries({ queryKey: ["dashboard", shopId] });
      toast.success(
        updated.status === "paid" ?
          "Payment recorded! Balance updated."
        : "Credit sale updated",
      );
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Failed to update credit sale",
      );
    },
  });
}
