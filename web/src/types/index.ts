// ── Auth ─────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenData {
  access_token: string;
  token_type: string;
}

export interface LoginResponse {
  user: ApiUser;
  token: TokenData;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}

// ── Generic API wrapper ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ── Shops ─────────────────────────────────────────────────────────────────────

export type LocationType = "urban" | "semi_urban" | "rural";

export interface Shop {
  id: string;
  user_id: string;
  shop_name: string;
  address: string;
  location_type: LocationType;
  created_at: string;
  updated_at: string;
}

export interface CreateShopPayload {
  shop_name: string;
  address: string;
  location_type: LocationType;
}

export interface UpdateShopPayload {
  shop_name?: string;
  address?: string;
  location_type?: LocationType;
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
}

// ── Products ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  shop_id: string;
  category_id: string;
  product_name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  stock_quantity: number;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  is_staple: boolean;
  is_perishable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  category_id: string;
  product_name: string;
  sku: string;
  barcode?: string;
  unit: string;
  stock_quantity: number;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  is_staple: boolean;
  is_perishable: boolean;
}

export interface UpdateProductPayload {
  product_name?: string;
  category_id?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  selling_price?: number;
  cost_price?: number;
  reorder_level?: number;
  is_staple?: boolean;
  is_perishable?: boolean;
  is_active?: boolean;
}

export interface StockAdjustPayload {
  quantity: number;
  reason?: string;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  current_outstanding_balance: number;
  max_outstanding_ever: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerPayload {
  full_name: string;
  phone?: string;
  address?: string;
  credit_limit: number;
}

export interface UpdateCustomerPayload {
  full_name?: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
  is_active?: boolean;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type PaymentType = "cash" | "credit" | "qr";
export type CreditStatus = "paid" | "unpaid" | "overdue";
export type TransactionType = "sale" | "purchase";

export interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface CreditSale {
  id: string;
  credit_amount: number;
  due_date: string;
  paid_at: string | null;
  status: CreditStatus;
  remarks: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  shop_id: string;
  customer_id: string | null;
  transaction_type: TransactionType;
  payment_type: PaymentType;
  subtotal: number;
  discount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  items: TransactionItem[];
  credit_sale: CreditSale | null;
}

export interface TransactionStats {
  today_sales: number;
  total_sales: number;
  credit_sales: number;
  pending_credit: number;
  total_count: number;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
  stats: TransactionStats | null;
}

export interface CreateTransactionItemPayload {
  product_id: string;
  quantity: number;
}

export interface CreateTransactionPayload {
  transaction_type?: TransactionType;
  payment_type: PaymentType;
  discount?: number;
  notes?: string;
  items: CreateTransactionItemPayload[];
  customer_id?: string;
  due_date?: string;
}

export interface UpdateCreditSalePayload {
  status?: CreditStatus;
  remarks?: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_products: number;
  total_customers: number;
  total_transactions: number;
  total_revenue: number;
  total_profit: number;
  total_credit_outstanding: number;
  low_stock_count: number;
  today_transactions: number;
  today_revenue: number;
  today_profit: number;
}

export interface RevenueByPayment {
  cash: number;
  credit: number;
  qr: number;
}

export interface TopProduct {
  product_name: string;
  total_sold: number;
  total_revenue: number;
  total_profit: number;
}

export interface DailySalesProfit {
  date: string;
  revenue: number;
  profit: number;
}

export interface CategoryRevenue {
  category_name: string;
  revenue: number;
  profit: number;
  product_count: number;
}

export interface InventoryStatus {
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  revenue_by_payment: RevenueByPayment;
  top_products: TopProduct[];
  sales_over_time: DailySalesProfit[];
  revenue_by_category: CategoryRevenue[];
  inventory_status: InventoryStatus;
}

export interface RestockSuggestion {
  product_name: string;
  sold_today: number;
  current_stock: number;
  predicted_tomorrow: number;
  needs_restock: boolean;
}

/** GET /shops/{shop_id}/dashboard/brief */
export interface DailyBrief {
  brief_date: string;
  transcript: string;
  audio_url: string | null;
  total_sales: number;
  total_credit_today: number;
  highest_credit_customer: { name: string; outstanding_balance: number } | null;
  top_selling_product: string | null;
  min_selling_product: string | null;
  low_stock_alerts: string[];
  restock_suggestions: RestockSuggestion[];
  ai_insight: string;
}

// ── ML Credit Risk ────────────────────────────────────────────────────────────

export interface ShapFeature {
  feature: string;
  shap_value: number;
}

export interface CreditRiskPrediction {
  risk_prediction: number;
  risk_probability: number;
  is_risk: boolean;
  threshold: number;
  confidence: number;
  model: string;
  customer_id?: string;
  computed_features?: Record<string, number>;
}

/** Server-side limit suggestion; added to predict/explain responses. */
export interface CreditLimitSuggestion {
  current_credit_limit: number;
  recommended_credit_limit: number;
  limit_reason: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface CreditRiskExplanation extends CreditRiskPrediction, CreditLimitSuggestion {
  base_probability: number;
  top_positive_features: ShapFeature[];
  top_negative_features: ShapFeature[];
  feature_contributions: Record<string, number>;
  human_readable_explanation: string;
}

export interface CreditRiskGlobalImportance {
  ranked_features: string[];
  mean_abs_shap_values: Record<string, number>;
  feature_importance_table: Array<Record<string, unknown>>;
}

// ── ML Demand ─────────────────────────────────────────────────────────────────

export interface DemandForecastDay {
  forecast_date: string;
  predicted_units: number;
  model: string;
  confidence: number;
  product_id?: string;
  category?: string;
  location_type?: string;
}

export interface DemandStockSummary {
  product_id: string;
  product_name: string;
  current_stock: number;
  next_day_forecast: number;
  next_7_day_forecast: number;
  stock_for_next_day: number;
  stock_for_next_7_days: number;
  recommended_restock: number;
  stock_gap_for_next_day: number;
  stock_gap_for_next_7_days: number;
  status: string;
  summary: string;
}

/** native rows: { feature, importance }; SHAP rows: { feature, mean_abs_shap } */
export interface DemandGlobalImportanceEntry {
  feature: string;
  importance?: number;
  mean_abs_shap?: number;
}

export interface DemandGlobalImportance {
  native_importance: DemandGlobalImportanceEntry[];
  shap_importance?: DemandGlobalImportanceEntry[];
}
