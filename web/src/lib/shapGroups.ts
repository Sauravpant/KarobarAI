import { formatCurrency } from '@/utils/format';

/**
 * Human labels and factor groups for the ML features, so SHAP output can be
 * shown as a few understandable factors instead of 18-40 raw columns.
 */

// Categorical order is fixed (validated: CVD and normal-vision separation pass);
// contrast is under 3:1 for slots 3-4, so every chart using these shows values as text.
export const GROUP_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const;
export const RISK_UP = '#E3182D';
export const RISK_DOWN = '#059669';

type Feature = { label: string; group: string; describe?: (v: number) => string };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const days = (v: number) => `${Math.round(v)} day${Math.round(v) === 1 ? '' : 's'}`;
const times = (v: number) => `${v.toFixed(1)}×`;
const count = (v: number) => String(Math.round(v));

// ── Credit risk ───────────────────────────────────────────────────────────────

export const CREDIT_GROUPS = ['Repayment record', 'Current debt', 'Credit use', 'Shopping activity'] as const;

export const CREDIT_FEATURES: Record<string, Feature> = {
  pct_repaid_on_time: { label: 'Repaid on time', group: 'Repayment record', describe: (v) => `repaid ${pct(v)} of credit by the due date` },
  avg_days_to_repay: { label: 'Days to repay', group: 'Repayment record', describe: (v) => `takes ${days(v)} to repay on average` },
  repayment_consistency: { label: 'Repayment consistency', group: 'Repayment record', describe: (v) => `varies by ±${days(v)} in how long repayment takes` },
  historical_repayment_ratio: { label: 'Credit repaid overall', group: 'Repayment record', describe: (v) => `has repaid ${pct(v)} of all credit ever taken` },
  num_completed_credit_cycles: { label: 'Credits fully repaid', group: 'Repayment record', describe: (v) => `has fully repaid ${count(v)} credit sales` },
  num_severely_late_repayments: { label: 'Very late repayments', group: 'Repayment record', describe: (v) => `made ${count(v)} repayments more than 30 days late` },
  current_outstanding_balance: { label: 'Amount owed now', group: 'Current debt', describe: (v) => `owes ${formatCurrency(v)} right now` },
  outstanding_to_avg_transaction_ratio: { label: 'Debt vs usual purchase', group: 'Current debt', describe: (v) => `owes ${times(v)} a typical purchase` },
  max_outstanding_ever: { label: 'Highest debt ever', group: 'Current debt', describe: (v) => `once owed as much as ${formatCurrency(v)}` },
  credit_purchase_value_last_30d: { label: 'Credit bought (30 days)', group: 'Credit use', describe: (v) => `bought ${formatCurrency(v)} on credit in 30 days` },
  credit_transaction_count_last_30d: { label: 'Credit purchases (30 days)', group: 'Credit use', describe: (v) => `made ${count(v)} credit purchases in 30 days` },
  credit_to_purchase_ratio: { label: 'Share bought on credit', group: 'Credit use', describe: (v) => `put ${pct(v)} of recent spending on credit` },
  avg_credit_transaction_amount: { label: 'Average credit purchase', group: 'Credit use', describe: (v) => `spends ${formatCurrency(v)} per credit purchase on average` },
  relationship_days: { label: 'Time as customer', group: 'Shopping activity', describe: (v) => `has been a customer for ${days(v)}` },
  transaction_count_last_30d: { label: 'Visits (30 days)', group: 'Shopping activity', describe: (v) => `made ${count(v)} purchases in 30 days` },
  cash_purchase_value_last_30d: { label: 'Cash/QR bought (30 days)', group: 'Shopping activity', describe: (v) => `paid ${formatCurrency(v)} upfront in 30 days` },
  avg_purchase_amount: { label: 'Average purchase', group: 'Shopping activity', describe: (v) => `spends ${formatCurrency(v)} per visit on average` },
  days_since_last_purchase: { label: 'Days since last visit', group: 'Shopping activity', describe: (v) => `last bought ${days(v)} ago` },
};

// ── Demand ────────────────────────────────────────────────────────────────────

export const DEMAND_GROUPS = ['Shop & category', 'Recent sales', 'Calendar', 'Festivals'] as const;

const DEMAND_LABELS: Record<string, string> = {
  shop_category_avg_demand: 'Usual demand in this shop & category',
  category_avg_demand: 'Usual demand for the category',
  shop_avg_demand: 'Usual demand in this shop',
  shop_vs_category_avg_ratio: 'Shop vs category average',
  units_rolling_mean_3: 'Avg sales, last 3 days',
  units_rolling_mean_7: 'Avg sales, last 7 days',
  units_rolling_mean_14: 'Avg sales, last 14 days',
  units_lag_1: 'Sales yesterday',
  units_lag_7: 'Sales same day last week',
  trend_slope: 'Sales trend',
  growth_rate: 'Growth rate',
  momentum: 'Momentum',
  year: 'Year',
  is_weekend: 'Weekend',
  is_month_end: 'Month end',
  day_of_week_enc: 'Day of week',
  day_of_month: 'Day of month',
  is_pre_festival_peak: 'Pre-festival rush',
  is_festival_window: 'Festival period',
  tihar_ramp: 'Run-up to Tihar',
  dashain_ramp: 'Run-up to Dashain',
  days_to_nearest_festival: 'Days to next festival',
  days_to_tihar: 'Days to Tihar',
  days_to_dashain: 'Days to Dashain',
  location_type_enc: 'Urban / rural location',
  is_staple: 'Staple item',
  is_perishable: 'Perishable item',
};

function demandGroup(f: string): string {
  if (/festival|tihar|dashain/.test(f)) return 'Festivals';
  if (/^(units|txn)_|trend|growth|momentum|moving_average/.test(f)) return 'Recent sales';
  if (/year|month|week|day_of/.test(f)) return 'Calendar';
  return 'Shop & category';
}

const titleCase = (f: string) => f.replace(/_enc$/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function demandFeature(f: string): Feature {
  return { label: DEMAND_LABELS[f] ?? titleCase(f), group: demandGroup(f) };
}

export function creditFeature(f: string): Feature {
  return CREDIT_FEATURES[f] ?? { label: titleCase(f), group: 'Shopping activity' };
}

/** Sum values per group in the given order, dropping empty groups. */
export function groupTotals(
  values: Record<string, number>,
  groups: readonly string[],
  lookup: (f: string) => Feature,
  abs = false
) {
  const totals = new Map<string, number>(groups.map((g) => [g, 0]));
  for (const [f, v] of Object.entries(values)) {
    const g = lookup(f).group;
    totals.set(g, (totals.get(g) ?? 0) + (abs ? Math.abs(v) : v));
  }
  return groups.map((name, i) => ({ name, value: totals.get(name) ?? 0, color: GROUP_COLORS[i] }));
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
