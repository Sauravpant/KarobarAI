import api from '@/lib/api';
import type {
  ApiResponse,
  CreditRiskExplanation,
  CreditLimitSuggestion,
  CreditRiskGlobalImportance,
  DemandForecastDay,
  DemandGlobalImportance,
  DemandStockSummary,
} from '@/types';

/**
 * Only the shop-scoped ML routes are used here: the backend builds the feature
 * vectors / sales history from the database. The raw-feature routes under
 * /ml/credit-risk/predict* and /ml/demand/predict*|explain* need hand-built
 * inputs (18 credit features, 21+ days of history) and have no web UI.
 */

function kathmanduToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ── Credit risk ───────────────────────────────────────────────────────────────

/** Backend recomputes the suggestion and writes it to customers.credit_limit. */
export async function applySuggestedCreditLimit(
  shopId: string,
  customerId: string
): Promise<CreditLimitSuggestion & { previous_credit_limit: number }> {
  const res = await api.post<ApiResponse<CreditLimitSuggestion & { previous_credit_limit: number }>>(
    `/shops/${shopId}/customers/${customerId}/credit-risk/apply-limit`
  );
  return res.data.data;
}

export async function explainCreditRiskForCustomer(
  shopId: string,
  customerId: string,
  topK = 5
): Promise<CreditRiskExplanation> {
  const res = await api.post<ApiResponse<CreditRiskExplanation>>(
    `/shops/${shopId}/customers/${customerId}/credit-risk/explain`,
    null,
    { params: { top_k: topK } }
  );
  return res.data.data;
}

export async function getCreditRiskGlobalImportance(): Promise<CreditRiskGlobalImportance> {
  const res = await api.get<ApiResponse<CreditRiskGlobalImportance>>('/ml/credit-risk/global-importance');
  return res.data.data;
}

export async function getCreditRiskModelInfo(): Promise<Record<string, unknown>> {
  const res = await api.get<ApiResponse<Record<string, unknown>>>('/ml/credit-risk/model-info');
  return res.data.data;
}

// ── Demand ────────────────────────────────────────────────────────────────────

export async function getDemandForecastNextDay(shopId: string, productId: string): Promise<DemandForecastDay> {
  const res = await api.post<ApiResponse<DemandForecastDay>>(
    `/shops/${shopId}/demand/products/${productId}/predict-next-day`,
    { last_date: kathmanduToday() }
  );
  return res.data.data;
}

export async function getDemandForecastNext7Days(shopId: string, productId: string): Promise<DemandForecastDay[]> {
  const res = await api.post<ApiResponse<DemandForecastDay[]>>(
    `/shops/${shopId}/demand/products/${productId}/predict-next-7-days`,
    { last_date: kathmanduToday() }
  );
  return res.data.data;
}

export async function getDemandStockSummary(
  shopId: string,
  productId: string,
  lastDate?: string
): Promise<DemandStockSummary> {
  const res = await api.get<ApiResponse<DemandStockSummary>>(
    `/shops/${shopId}/demand/products/${productId}/stock-summary`,
    { params: lastDate ? { last_date: lastDate } : undefined }
  );
  return res.data.data;
}

export async function getDemandModelInfo(): Promise<Record<string, unknown>> {
  const res = await api.get<ApiResponse<Record<string, unknown>>>('/ml/demand/model-info');
  return res.data.data;
}

export async function getDemandGlobalImportance(): Promise<DemandGlobalImportance> {
  const res = await api.get<ApiResponse<DemandGlobalImportance>>('/ml/demand/global-importance');
  return res.data.data;
}
