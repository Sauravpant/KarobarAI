import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShopId } from '@/providers/AuthProvider';
import { useCustomers } from '@/hooks/useCustomers';
import {
  useCreditRiskExplain,
  useApplyCreditLimit,
  useCreditRiskGlobalImportance,
  useCreditRiskModelInfo,
} from '@/hooks/useML';
import { PageSkeleton, BlockSkeleton } from '@/components/ui/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { RiskBadge } from '@/components/ui/StatusBadge';
import { CreditRiskWaterfall, CreditFactorDonut, CreditTopDrivers } from '@/components/charts/CreditRiskBreakdown';
import { InfluenceDonut } from '@/components/charts/InfluenceDonut';
import { DriverBars } from '@/components/charts/DriverBars';
import { CREDIT_GROUPS, GROUP_COLORS, creditFeature, groupTotals } from '@/lib/shapGroups';
import { ErrorState, EmptyState } from '@/components/ui/StateComponents';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  CheckCircle2,
  ShieldAlert,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/format';
import { errorMessage } from '@/lib/queryClient';
import type { Customer } from '@/types';

/** Share of the credit limit in use. Shown in the list; the ML score is per customer. */
function limitUsage(c: Customer) {
  if (!c.credit_limit) return c.current_outstanding_balance > 0 ? 100 : 0;
  return Math.min(100, Math.round((c.current_outstanding_balance / c.credit_limit) * 100));
}

export default function CreditRisk() {
  const shopId = useShopId();
  const { data: customers, isLoading, isError, refetch } = useCustomers(shopId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGlobal, setShowGlobal] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (customers ?? []).filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const effectiveId = selectedId ?? filtered[0]?.id ?? null;
  const selected = customers?.find((c) => c.id === effectiveId) ?? null;

  // ── Per-customer SHAP explain ────────────────────────────────────────────────
  const {
    data: explanation,
    isLoading: explainLoading,
    isError: explainError,
    error: explainErr,
    refetch: refetchExplain,
  } = useCreditRiskExplain(shopId, effectiveId);

  const applyLimit = useApplyCreditLimit(shopId);

  // ── Global importance + model info ───────────────────────────────────────────
  const { data: globalImportance, isLoading: globalLoading } = useCreditRiskGlobalImportance(
    !!shopId && showGlobal
  );
  const { data: modelInfo } = useCreditRiskModelInfo(!!shopId);

  // ── Derived metrics ───────────────────────────────────────────────────────────
  const score = explanation
    ? Math.round((1 - explanation.risk_probability) * 100)
    : null;
  const repayProb = explanation
    ? Math.round((1 - explanation.risk_probability) * 1000) / 10
    : null;
  // One limit: customers.credit_limit. The suggestion comes from the backend and
  // doesn't depend on the current limit, so applying it twice changes nothing.
  const suggestedLimit = explanation?.recommended_credit_limit ?? null;
  const limitChange = selected && suggestedLimit != null ? suggestedLimit - selected.credit_limit : 0;

  const globalTotal = Object.values(globalImportance?.mean_abs_shap_values ?? {}).reduce((s, v) => s + v, 0) || 1;

  const modelName = String(
    (modelInfo?.metadata as { model_name?: string } | undefined)?.model_name ??
      modelInfo?.model ??
      'credit risk'
  );


  if (!shopId || isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-background lg:overflow-hidden">
      {/* ── Customer sidebar ── */}
      <div className="w-full lg:w-80 max-h-72 lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search customers..."
              className="pl-9 bg-slate-50/50 border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="font-bold text-sm text-slate-800">Customer Registry</span>
          <span className="text-xs font-bold text-red-600">{customers?.length ?? 0} Active</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {filtered.length === 0 ? (
            <EmptyState title="No customers" description="Add customers to run credit analysis." />
          ) : (
            filtered.map((c) => {
              const usage = limitUsage(c);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(c.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(c.id)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all duration-200 relative',
                    effectiveId === c.id
                      ? 'bg-white border-red-200 shadow-sm ring-1 ring-red-500/20'
                      : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {effectiveId === c.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-600 rounded-r-full" />
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3">
                      <Avatar
                        className={cn(
                          'w-10 h-10 border',
                          effectiveId === c.id
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        )}
                      >
                        <AvatarFallback className="font-semibold">
                          {c.full_name.substring(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 leading-tight">
                          {c.full_name}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          #{c.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-0 shadow-none text-[10px] font-bold px-2 py-0.5 h-auto rounded-sm',
                        usage >= 80 && 'bg-red-100 text-red-700',
                        usage >= 40 && usage < 80 && 'bg-amber-100 text-amber-700',
                        usage < 40 && 'bg-emerald-100 text-emerald-700'
                      )}
                      title="Share of credit limit in use"
                    >
                      {usage}% of limit
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-600">
                      Outstanding: {formatCurrency(c.current_outstanding_balance)}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium flex items-center gap-1',
                        c.current_outstanding_balance > 0
                          ? 'text-slate-500'
                          : 'text-emerald-600'
                      )}
                    >
                      {c.current_outstanding_balance > 0 ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {c.current_outstanding_balance > 0 ? 'Open' : 'Clear'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        {/* Topbar */}
        <div className="h-16 px-6 border-b border-slate-200 flex justify-between items-center gap-4 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Sparkles className="w-4 h-4 text-red-600" />
            AI Credit Risk Analysis
            {modelInfo && (
              <span className="text-xs text-slate-500 ml-2">· {modelName}</span>
            )}
          </div>
        </div>

        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="Select a customer"
              description="Choose a customer from the list to run ML credit analysis."
            />
          </div>
        ) : explainLoading ? (
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6" aria-busy="true">
            <Skeleton className="h-48 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <BlockSkeleton rows={5} className="bg-white rounded-xl border border-border p-6" />
          </div>
        ) : explainError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <p className="font-semibold text-slate-800">Could not run credit analysis</p>
            <p className="text-sm text-slate-500 max-w-md">
              {errorMessage(explainErr, 'The credit risk model is not available on the backend.')}
            </p>
            <Button
              onClick={() => refetchExplain()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : explanation ? (
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">

            {/* ── Score card + actions ── */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Score ring + summary */}
              <Card className="flex-1 bg-white rounded-xl border border-slate-200/80 p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-slate-100/60 hover:-translate-y-0.5">
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        className={cn(
                          'drop-shadow-md',
                          score! >= 70
                            ? 'stroke-emerald-500'
                            : score! >= 40
                              ? 'stroke-amber-500'
                              : 'stroke-red-500'
                        )}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray="351.8"
                        strokeDashoffset={351.8 - (351.8 * (score ?? 0)) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="text-4xl font-black text-slate-800 tracking-tighter leading-none">
                        {score}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mt-1">
                        AI Score
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Base prob: {(explanation.base_probability * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-2xl font-bold text-foreground mb-3">{selected.full_name}</h2>
                  <div className="flex items-center gap-3 mb-4">
                    <RiskBadge isRisk={explanation.is_risk} probability={explanation.risk_probability} />
                    <p className="text-xs font-medium text-slate-500">
                      Threshold: {(explanation.threshold * 100).toFixed(0)}%
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {explanation.human_readable_explanation}
                  </p>
                </div>
              </Card>

              {/* Action panel */}
              <div className="w-full lg:w-64 bg-slate-100/50 rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Recommended Actions
                </h3>

                {/* Apply suggested credit limit (disabled once it already matches) */}
                {suggestedLimit != null && (
                  <div className="space-y-2">
                    <Button
                      className="w-full justify-start h-14 rounded-lg"
                      disabled={applyLimit.isPending || limitChange === 0}
                      onClick={() => selected && applyLimit.mutate(selected.id)}
                    >
                      {applyLimit.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <div className="flex flex-col items-start">
                          <span className="font-bold">
                            {limitChange === 0 ? 'Limit is up to date' : limitChange < 0 ? 'Lower limit' : 'Raise limit'}
                          </span>
                          <span className="text-[11px] opacity-90">
                            {limitChange === 0 ? formatCurrency(suggestedLimit) : `to ${formatCurrency(suggestedLimit)}`}
                          </span>
                        </div>
                      )}
                    </Button>
                    <p className="text-[11px] text-slate-500 leading-snug">{explanation.limit_reason}</p>
                  </div>
                )}

                {/* Model info */}
                {modelInfo && (
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Model: {modelName}
                  </p>
                )}

                {/* Top 3 global drivers */}
                {globalImportance?.ranked_features?.slice(0, 3)?.length ? (
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <p className="font-bold uppercase tracking-wider">Top global drivers</p>
                    {globalImportance.ranked_features.slice(0, 3).map((f) => (
                      <p key={f}>{creditFeature(f).label}</p>
                    ))}
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  className="w-full justify-start h-14 bg-white border-slate-200 text-slate-700 rounded-lg"
                  asChild
                >
                  <Link to="/customers">
                    <ShieldAlert className="w-5 h-5 mr-3 text-slate-400" />
                    View Customer
                  </Link>
                </Button>
              </div>
            </div>

            {/* ── 3 KPI cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white rounded-xl border border-slate-200/80 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-slate-100/60 hover:-translate-y-0.5">
                <CardContent className="p-6">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Suggested Limit
                  </p>
                  <div className="text-3xl font-black text-brand mb-4 tracking-tight tabular">
                    {formatCurrency(suggestedLimit ?? 0)}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 flex items-start gap-1.5">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    Current limit {formatCurrency(selected.credit_limit)} · available{' '}
                    {formatCurrency(Math.max(0, selected.credit_limit - selected.current_outstanding_balance))}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-xl border border-slate-200/80 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-slate-100/60 hover:-translate-y-0.5">
                <CardContent className="p-6">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Repayment Probability
                  </p>
                  <div className="text-4xl font-black text-slate-800 tracking-tight mb-4">
                    {repayProb}%
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        repayProb! >= 70 ? 'bg-emerald-600' : repayProb! >= 40 ? 'bg-amber-500' : 'bg-red-600'
                      )}
                      style={{ width: `${repayProb}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-xl border border-slate-200/80 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-slate-100/60 hover:-translate-y-0.5">
                <CardContent className="p-6">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Outstanding Amount
                  </p>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mb-4">
                    {formatCurrency(selected.current_outstanding_balance)}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Clock className="w-4 h-4" /> Limit {formatCurrency(selected.credit_limit)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── How the score was built (SHAP, grouped into factors) ── */}
            <Card className="bg-white rounded-xl border border-border shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-bold text-slate-900 text-base">How this score was built</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Starts from a typical customer's risk, then each factor pushes it up (red) or down (green).
                </p>
                <CreditRiskWaterfall explanation={explanation} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white rounded-xl border border-border shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-bold text-slate-900 text-base mb-4">What mattered most</h3>
                  <CreditFactorDonut explanation={explanation} />
                </CardContent>
              </Card>
              <Card className="bg-white rounded-xl border border-border shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-bold text-slate-900 text-base mb-4">Key reasons</h3>
                  <CreditTopDrivers explanation={explanation} />
                </CardContent>
              </Card>
            </div>

            {/* ── Model-wide drivers (collapsible) ── */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <button
                onClick={() => setShowGlobal((v) => !v)}
                aria-expanded={showGlobal}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <BarChart3 className="w-4 h-4 text-brand" /> What the model looks at for every customer
                </span>
                {showGlobal ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showGlobal && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  {globalLoading ? (
                    <BlockSkeleton rows={6} className="py-6" />
                  ) : !globalImportance ? (
                    <p className="text-sm text-slate-500 py-8 text-center">No model-wide data available.</p>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-5">
                      <div>
                        <InfluenceDonut
                          data={groupTotals(globalImportance.mean_abs_shap_values, CREDIT_GROUPS, creditFeature)}
                          label="Influence across all customers"
                        />
                      </div>
                      <div>
                        <DriverBars
                          valueLabel="Share of influence"
                          format={(v) => `${Math.round((v / globalTotal) * 100)}%`}
                          data={globalImportance.ranked_features.slice(0, 8).map((f) => {
                            const meta = creditFeature(f);
                            return {
                              label: meta.label,
                              group: meta.group,
                              value: globalImportance.mean_abs_shap_values[f] ?? 0,
                              color: GROUP_COLORS[CREDIT_GROUPS.indexOf(meta.group as (typeof CREDIT_GROUPS)[number])] ?? GROUP_COLORS[0],
                            };
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
