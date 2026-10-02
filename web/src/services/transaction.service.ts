import api from '@/lib/api';
import type {
  ApiResponse,
  Transaction,
  CreateTransactionPayload,
  CreditSale,
  UpdateCreditSalePayload,
  CreditStatus,
  PaginatedTransactions,
  TransactionStats,
  PaymentType,
} from '@/types';

export interface GetTransactionsParams {
  page?: number;
  limit?: number;
  payment_type?: PaymentType;
  search?: string;
  include_stats?: boolean;
}

export async function getTransactions(
  shopId: string,
  params?: GetTransactionsParams
): Promise<PaginatedTransactions> {
  const res = await api.get<ApiResponse<PaginatedTransactions>>(
    `/shops/${shopId}/transactions/`,
    { params }
  );
  return res.data.data;
}

export async function getTransactionStats(shopId: string): Promise<TransactionStats> {
  const res = await api.get<ApiResponse<TransactionStats>>(
    `/shops/${shopId}/transactions/stats`
  );
  return res.data.data;
}

export async function getTransaction(shopId: string, transactionId: string): Promise<Transaction> {
  const res = await api.get<ApiResponse<Transaction>>(
    `/shops/${shopId}/transactions/${transactionId}`
  );
  return res.data.data;
}

export async function createTransaction(
  shopId: string,
  payload: CreateTransactionPayload
): Promise<Transaction> {
  const res = await api.post<ApiResponse<Transaction>>(
    `/shops/${shopId}/transactions/`,
    payload
  );
  return res.data.data;
}

export async function getCreditSales(shopId: string, status?: CreditStatus): Promise<CreditSale[]> {
  const params = status ? { status } : {};
  const res = await api.get<ApiResponse<CreditSale[]>>(
    `/shops/${shopId}/transactions/credit-sales/`,
    { params }
  );
  return res.data.data;
}

export async function updateCreditSale(
  shopId: string,
  creditSaleId: string,
  payload: UpdateCreditSalePayload
): Promise<CreditSale> {
  const res = await api.patch<ApiResponse<CreditSale>>(
    `/shops/${shopId}/transactions/credit-sales/${creditSaleId}`,
    payload
  );
  return res.data.data;
}
