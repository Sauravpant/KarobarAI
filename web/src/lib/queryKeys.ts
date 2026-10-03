import type { CreditStatus, PaymentType } from '@/types';

/**
 * Single query key factory. Shop-scoped keys start with ['shops', shopId] so
 * invalidating qk.shop(shopId) refreshes everything for that shop.
 */
export const qk = {
  me: ['me'] as const,

  shops: ['shops'] as const,
  shop: (shopId: string) => ['shops', shopId] as const,

  // Categories are global on the backend (not shop-scoped)
  categories: ['categories'] as const,

  products: (shopId: string) => ['shops', shopId, 'products'] as const,
  productList: (shopId: string) => ['shops', shopId, 'products', 'list'] as const,
  lowStock: (shopId: string) => ['shops', shopId, 'products', 'low-stock'] as const,

  customers: (shopId: string) => ['shops', shopId, 'customers'] as const,
  customerList: (shopId: string) => ['shops', shopId, 'customers', 'list'] as const,

  transactions: (shopId: string) => ['shops', shopId, 'transactions'] as const,
  transactionList: (shopId: string, filters: { payment_type?: PaymentType; search?: string }) =>
    ['shops', shopId, 'transactions', 'list', filters] as const,
  transactionStats: (shopId: string) => ['shops', shopId, 'transactions', 'stats'] as const,
  transaction: (shopId: string, transactionId: string) =>
    ['shops', shopId, 'transactions', 'detail', transactionId] as const,

  creditSales: (shopId: string) => ['shops', shopId, 'credit-sales'] as const,
  creditSaleList: (shopId: string, status?: CreditStatus) =>
    ['shops', shopId, 'credit-sales', status ?? 'all'] as const,

  dashboard: (shopId: string) => ['shops', shopId, 'dashboard'] as const,
  brief: (shopId: string, briefDate?: string) =>
    ['shops', shopId, 'brief', briefDate ?? 'today'] as const,

  creditRisk: (shopId: string) => ['shops', shopId, 'credit-risk'] as const,
  creditRiskExplain: (shopId: string, customerId: string) =>
    ['shops', shopId, 'credit-risk', 'explain', customerId] as const,
  creditRiskGlobalImportance: ['ml', 'credit-risk', 'global-importance'] as const,
  creditRiskModelInfo: ['ml', 'credit-risk', 'model-info'] as const,

  demandForecast: (shopId: string) => ['shops', shopId, 'demand'] as const,
  demandNextDay: (shopId: string, productId: string) =>
    ['shops', shopId, 'demand', 'next-day', productId] as const,
  demand7Days: (shopId: string, productId: string) =>
    ['shops', shopId, 'demand', '7-days', productId] as const,
  demandStockSummary: (shopId: string, productId: string, lastDate?: string) =>
    ['shops', shopId, 'demand', 'stock-summary', productId, lastDate ?? 'latest'] as const,
  demandGlobalImportance: ['ml', 'demand', 'global-importance'] as const,
  demandModelInfo: ['ml', 'demand', 'model-info'] as const,
};

/** Stale times by data volatility. */
export const STALE = {
  live: 30_000, // dashboard, transactions, stock
  normal: 2 * 60_000, // customers, credit sales
  slow: 30 * 60_000, // categories, shop, model info
} as const;
