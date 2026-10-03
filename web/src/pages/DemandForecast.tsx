import { useMemo, useState } from "react";
import { useShopId } from "@/providers/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage } from "@/lib/queryClient";
import { formatDate } from "@/utils/format";
import { useProducts } from "@/hooks/useInventory";
import {
  useDemandForecast7Days,
  useDemandForecastNextDay,
  useDemandModelInfo,
  useDemandGlobalImportance,
  useDemandStockSummary,
} from "@/hooks/useML";
import { PageSkeleton, BlockSkeleton } from "@/components/ui/LoadingSkeleton";
import { InfluenceDonut } from "@/components/charts/InfluenceDonut";
import { DriverBars } from "@/components/charts/DriverBars";
import { DEMAND_GROUPS, GROUP_COLORS, demandFeature, groupTotals } from "@/lib/shapGroups";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemandGlobalImportanceEntry } from "@/types";

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { value: number; payload: { confidence: number } }[];
};

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="text-xs text-brand">Predicted: {Number(payload[0].value).toFixed(1)} units</p>
      <p className="text-xs text-slate-500">Confidence: {payload[0].payload.confidence}%</p>
    </div>
  );
};

export default function DemandForecast() {
  const shopId = useShopId();
  const { data: products, isLoading, isError, refetch } = useProducts(shopId);
  const [productId, setProductId] = useState<string | null>(null);
  const [showConfidence, setShowConfidence] = useState(false);

  const selectedId = productId ?? products?.[0]?.id ?? null;
  const selected = products?.find((p) => p.id === selectedId) ?? null;

  const {
    data: forecast,
    isLoading: forecastLoading,
    isError: forecastError,
    error: forecastErr,
    refetch: refetchForecast,
  } = useDemandForecast7Days(shopId, selectedId);

  const { data: nextDay } = useDemandForecastNextDay(shopId, selectedId);
  const { data: stockSummary } = useDemandStockSummary(shopId, selectedId);
  const { data: modelInfo } = useDemandModelInfo(!!shopId);
  const { data: globalImportance, isLoading: globalLoading } =
    useDemandGlobalImportance(!!shopId);

  const chartData = useMemo(() => {
    const rows = [];
    let running = 0;
    for (const d of forecast ?? []) {
      running += d.predicted_units;
      rows.push({
        date: new Date(d.forecast_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        units: Math.round(d.predicted_units * 10) / 10,
        cumulative: Math.round(running * 10) / 10,
        confidence: Math.round(d.confidence * 100),
      });
    }
    return rows;
  }, [forecast]);
  const currentStock = stockSummary?.current_stock ?? selected?.stock_quantity ?? 0;
  const runsOutOn = chartData.find((d) => d.cumulative > currentStock)?.date;

  const peakDay = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((a, b) => (b.units > a.units ? b : a));
  }, [chartData]);

  const totalPredicted = chartData.reduce((s, d) => s + d.units, 0);

  if (!shopId || isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={refetch} />;

  if (!products?.length) {
    return (
      <div className="p-6">
        <EmptyState
          title="No products to forecast"
          description="Add products and record sales so the demand model can build history."
        />
      </div>
    );
  }

  const modelName = String(modelInfo?.best_model ?? modelInfo?.model ?? "demand model");

  // Global importance entries from the backend
  // SHAP rows carry mean_abs_shap (units), native rows carry importance
  const globalValues = Object.fromEntries(
    (globalImportance?.shap_importance ?? globalImportance?.native_importance ?? []).map((e: DemandGlobalImportanceEntry) => [
      e.feature,
      e.mean_abs_shap ?? e.importance ?? 0,
    ]),
  );
  const groupShare = groupTotals(globalValues, DEMAND_GROUPS, demandFeature);
  const driverData = Object.entries(globalValues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([f, value]) => {
      const meta = demandFeature(f);
      return {
        label: meta.label,
        group: meta.group,
        value,
        color: GROUP_COLORS[DEMAND_GROUPS.indexOf(meta.group as (typeof DEMAND_GROUPS)[number])] ?? GROUP_COLORS[0],
      };
    });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Demand Forecast"
        description={`Per-product predictions from your sales history (${modelName}).`}
        icon={TrendingUp}
        actions={
          <>
            <label htmlFor="df-product" className="sr-only">Product</label>
            <select
              id="df-product"
              className="h-9 rounded-lg border border-input px-3 text-sm bg-white w-full sm:w-60"
              value={selectedId ?? ""}
              onChange={(e) => setProductId(e.target.value)}>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* ── Stock vs demand summary card ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
              <Package className="w-3.5 h-3.5" /> Stock planning
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">
              {selected?.product_name ?? "Selected product"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {stockSummary?.summary ?? "Current stock compared with forecast demand for tomorrow and the next 7 days."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Status</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {!stockSummary ? "—" : stockSummary.status === "restock" ? "Restock recommended" : "Healthy stock"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Current stock</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stockSummary?.current_stock ?? selected?.stock_quantity ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Next 1 day</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stockSummary?.next_day_forecast ?? nextDay?.predicted_units?.toFixed(1) ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Next 7 days</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stockSummary?.next_7_day_forecast ?? totalPredicted.toFixed(0)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {stockSummary && (
            <>
              <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-200">
                {stockSummary.recommended_restock ? `Restock ${stockSummary.recommended_restock} units` : "No urgent restock needed"}
              </div>
              <div className="rounded-full bg-red-500/20 px-3 py-1 text-sm font-semibold text-red-200">
                {stockSummary.stock_gap_for_next_7_days ? `Short by ${stockSummary.stock_gap_for_next_7_days} units over 7 days` : "Covered for 7 days"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Product"
          value={selected?.product_name ?? "—"}
          subtitle={`Stock: ${selected?.stock_quantity ?? 0}`}
          icon={Package}
          iconBg="bg-red-50/80"
          iconColor="text-brand"
        />
        <StatCard
          title="Tomorrow"
          value={nextDay ? nextDay.predicted_units.toFixed(1) : "—"}
          subtitle={nextDay ? formatDate(nextDay.forecast_date) : "—"}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="7-Day Demand"
          value={totalPredicted.toFixed(0)}
          subtitle="Predicted units"
          icon={TrendingUp}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          title="Peak Day"
          value={peakDay ? String(peakDay.units) : "—"}
          subtitle={peakDay?.date ?? modelName}
          icon={AlertTriangle}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>
      {forecastLoading ?
        <div className="space-y-6" aria-busy="true" aria-label="Generating forecast">
          <Skeleton className="h-80 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <BlockSkeleton rows={7} className="bg-white rounded-xl border border-border p-6" />
          </div>
        </div>
      : forecastError ?
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-800">Forecast unavailable</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {errorMessage(forecastErr, "The demand model needs more sales history for this product.")}
          </p>
          <Button
            onClick={() => refetchForecast()}
            >
            Retry
          </Button>
        </div>
      : <>
          {/* ── 7-day area chart ── */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 transition-all duration-300 hover:shadow-md hover:shadow-slate-100/50">
            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Next 7 Days — {selected?.product_name}
              </h2>
              <p className="text-xs text-slate-500">
                Predicted units sold per day. Hollow points: model confidence below 60%.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E3182D" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#E3182D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="units"
                  stroke="#E3182D"
                  strokeWidth={2.5}
                  fill="url(#colorDemand)"
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const low = (chartData[props.index ?? 0]?.confidence ?? 100) < 60;
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={low ? 4 : 3}
                        fill={low ? "#fff" : "#E3182D"}
                        stroke="#E3182D"
                        strokeWidth={low ? 2 : 0}
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Daily breakdown + SHAP explanation from forecast ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cumulative demand against what's on the shelf */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Cumulative demand vs stock</h2>
              <p className="text-xs text-slate-500 mb-4">
                {runsOutOn
                  ? `At this rate current stock (${currentStock}) runs out around ${runsOutOn}.`
                  : `Current stock (${currentStock}) covers the forecast week.`}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: unknown) => [`${Number(value)} units`, "Cumulative demand"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <ReferenceLine
                    y={currentStock}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{ value: "Stock", position: "insideTopRight", fontSize: 11, fill: "#d97706" }}
                  />
                  <Bar dataKey="cumulative" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.date} fill={d.cumulative > currentStock ? "#E3182D" : "#fca5a5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast detail table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 transition-all duration-300 hover:shadow-md hover:shadow-slate-100/50 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-4 tracking-tight">
                  Forecast Details
                </h2>
                <div className="space-y-1 divide-y divide-slate-100">
                  {chartData.map((d) => (
                    <div
                      key={d.date}
                      className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-semibold text-slate-600">
                        {d.date}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900">
                          {d.units} units
                        </span>
                        <Badge
                          className={cn(
                            "text-[10px] border-0 px-2 py-0.5 shadow-none font-semibold rounded-md",
                            d.confidence >= 70 ?
                              "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                          )}>
                          {d.confidence}% conf
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selected && totalPredicted > selected.stock_quantity && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-xs font-semibold text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Predicted 7-day demand ({totalPredicted.toFixed(0)}) exceeds
                    current stock ({selected.stock_quantity}). Consider
                    restocking.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Forecast confidence (from the forecast rows) ──
              Per-product SHAP explanations aren't exposed by the backend; the
              /ml/demand/explain-* routes need hand-built 21-day histories. */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowConfidence((v) => !v)}
              aria-expanded={showConfidence}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Info className="w-4 h-4 text-brand" /> Model confidence per day
              </span>
              {showConfidence ?
                <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showConfidence && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <p className="text-xs text-slate-500 mt-4 mb-4">
                  Confidence returned by the model for each forecast day. Lower values mean a wider likely range.
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip
                      formatter={(value: unknown) => [`${Number(value)}%`, "Confidence"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="confidence" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </>
      }

      {/* ── What drives demand (model-wide SHAP, grouped into factors) ──
          The backend has no per-product explanation route, so this is the model's
          average influence across all products and shops. */}
      <section className="bg-white rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">What drives demand</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-5">
          How much each factor moves the forecast on average, across all products and shops.
        </p>
        {globalLoading ? (
          <BlockSkeleton rows={6} />
        ) : !driverData.length ? (
          <p className="text-sm text-slate-500 py-8 text-center">No model data available.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <InfluenceDonut data={groupShare} label="Share of influence on demand" />
            </div>
            <div>
              <DriverBars data={driverData} valueLabel="Avg. units moved per day" format={(v) => `±${v.toFixed(1)}`} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
