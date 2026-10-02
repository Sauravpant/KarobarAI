
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  detail?: string | null;
}

// auth
export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
}

export interface LoginResponse {
  user: User;
  token: { access_token: string; token_type: string };
}

// shops
export type LocationType = 'urban' | 'semi_urban' | 'rural';

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

// customers
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

// dashboard
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

export interface DashboardDetail {
  summary: DashboardSummary;
  revenue_by_payment: { cash: number; credit: number; qr: number };
  top_products: {
    product_name: string;
    total_sold: number;
    total_revenue: number;
    total_profit: number;
  }[];
  inventory_status: { in_stock: number; low_stock: number; out_of_stock: number };
}

// daily brief (backend/app/schemas/dashboard.py DailyBriefResponse)
export interface RestockSuggestion {
  product_name: string;
  sold_today: number;
  current_stock: number;
  predicted_tomorrow: number;
  needs_restock: boolean;
}

export interface DailyBrief {
  brief_date: string;
  /** Nepali text; the exact string the audio endpoint reads out. Last paragraph is ai_insight. */
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

// voice
export type VoiceAction = 'sale' | 'purchase';
export type PaymentType = 'cash' | 'credit' | 'qr';

export interface MatchedItem {
  spoken_product: string;
  quantity: number;
  unit: string | null;
  product_id: string | null;
  product_name: string;
  stock_quantity: number | null;
  match_confidence: 'high' | 'none';
}

export interface MatchedTransaction {
  action: VoiceAction;
  customer_name: string | null;
  customer_id: string | null;
  payment_type: string;
  due_date: string | null;
  notes: string | null;
  items: MatchedItem[];
}

export interface ExtractResult {
  matched_items: (MatchedItem & { action: VoiceAction })[];
  matched_transactions: MatchedTransaction[];
}

export interface VoiceConfirmLineItem {
  action: VoiceAction;
  product_id: string;
  quantity: number;
  product_name?: string;
}

export interface SingleTransactionConfirm {
  action: VoiceAction;
  items: VoiceConfirmLineItem[];
  payment_type: PaymentType;
  customer_id?: string | null;
  due_date?: string | null;
  notes?: string | null;
}

export interface VoiceConfirmRequest {
  transactions: SingleTransactionConfirm[];
}
