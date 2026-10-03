import { useMemo, useState } from "react";
import { useShopId } from "@/providers/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage } from "@/lib/queryClient";
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
  LabelList,
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

const tooltipStyle = { fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px -8px rgb(15 23 42 / 0.15)" };
const axisTick = { fontSize: 12, fill: "#64748b" };
const LOW_CONFIDENCE = 60;

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const conf = payload[0].payload.confidence;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5 space-y-0.5">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      <p className="text-sm font-bold text-slate-900 tabular">{Number(payload[0].value).toFixed(1)} units</p>
      <p className={cn("text-xs tabular", conf < LOW_CONFIDENCE ? "text-amber-600" : "text-slate-500")}>
        {conf}% confidence
      </p>
    </div>
  );
};

function LegendDot({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span
        className="size-2.5 rounded-full shrink-0"
        style={hollow ? { border: `2px solid ${color}` } : { background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

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
  const avgDaily = chartData.length ? totalPredicted / chartData.length : 0;

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

        <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4">
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
          <div className="rounded-xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Peak day</p>
            <p className="mt-2 text-2xl font-semibold text-white">{peakDay ? peakDay.units : "—"}</p>
            <p className="text-xs text-slate-400">{peakDay?.date ?? ""}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {stockSummary && (
            <>
              <div className={cn("rounded-full px-3 py-1 text-sm font-semibold", stockSummary.recommended_restock ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200")}>
                {stockSummary.recommended_restock ? `Restock ${stockSummary.recommended_restock} units` : "No urgent restock needed"}
              </div>
              <div className={cn("rounded-full px-3 py-1 text-sm font-semibold", stockSummary.stock_gap_for_next_7_days ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200")}>
                {stockSummary.stock_gap_for_next_7_days ? `Short by ${stockSummary.stock_gap_for_next_7_days} units over 7 days` : "Covered for 7 days"}
              </div>
            </>
          )}
        </div>
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
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Daily demand, next 7 days
                </h2>
                <p className="text-xs text-slate-500">
                  Predicted units sold per day for {selected?.product_name}.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <LegendDot color="#E3182D" label="Predicted units" />
                <LegendDot color="#E3182D" label={`Confidence < ${LOW_CONFIDENCE}%`} hollow />
                <LegendDot color="#94a3b8" label={`Daily avg ${avgDaily.toFixed(1)}`} />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 24, right: 16, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E3182D" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#E3182D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
                <ReferenceLine y={avgDaily} stroke="#94a3b8" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="units"
                  stroke="#E3182D"
                  strokeWidth={2.5}
                  fill="url(#colorDemand)"
                  activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const low = (chartData[props.index ?? 0]?.confidence ?? 100) < LOW_CONFIDENCE;
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={4.5}
                        fill={low ? "#fff" : "#E3182D"}
                        stroke={low ? "#E3182D" : "#fff"}
                        strokeWidth={2}
                      />
                    );
                  }}>
                  <LabelList dataKey="units" position="top" offset={12} style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Daily breakdown + SHAP explanation from forecast ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cumulative demand against what's on the shelf */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Cumulative demand vs stock</h2>
              <p className={cn("text-xs mb-3", runsOutOn ? "text-red-600 font-medium" : "text-slate-500")}>
                {runsOutOn
                  ? `At this rate current stock (${currentStock}) runs out around ${runsOutOn}.`
                  : `Current stock (${currentStock}) covers the forecast week.`}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                <LegendDot color="#10b981" label="Covered by stock" />
                <LegendDot color="#E3182D" label="Beyond stock" />
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-4 border-t-2 border-dashed border-amber-500" aria-hidden /> Stock {currentStock}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 20, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                  <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    formatter={(value: unknown) => [`${Number(value)} units`, "Cumulative demand"]}
                    contentStyle={tooltipStyle}
                  />
                  {/* extendDomain keeps the stock line visible when stock is above every bar */}
                  <ReferenceLine
                    y={currentStock}
                    stroke="#d97706"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    ifOverflow="extendDomain"
                  />
                  <Bar dataKey="cumulative" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {chartData.map((d) => (
                      <Cell key={d.date} fill={d.cumulative > currentStock ? "#E3182D" : "#10b981"} />
                    ))}
                    <LabelList dataKey="cumulative" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast detail table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 transition-all duration-300 hover:shadow-md hover:shadow-slate-100/50 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Forecast details
                </h2>
                <p className="text-xs text-slate-500 mb-3">Units per day. Bar length is relative to the peak day.</p>
                <div className="space-y-1 divide-y divide-slate-100">
                  {chartData.map((d) => (
                    <div
                      key={d.date}
                      className="flex items-center justify-between py-2.5">
                      <span className="w-16 shrink-0 text-sm font-semibold text-slate-600">
                        {d.date}
                      </span>
                      <div className="mx-3 h-2 flex-1 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
                        <div
                          className={cn("h-full rounded-full", d === peakDay ? "bg-brand" : "bg-red-300")}
                          style={{ width: `${peakDay?.units ? (d.units / peakDay.units) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="w-12 text-right text-sm font-bold text-slate-900 tabular">
                          {d.units}
                        </span>
                        <Badge
                          className={cn(
                            "w-16 justify-center text-[10px] border-0 px-2 py-0.5 shadow-none font-semibold rounded-md tabular",
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
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 20, right: 32, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                    <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      formatter={(value: unknown) => [`${Number(value)}%`, "Confidence"]}
                      contentStyle={tooltipStyle}
                    />
                    <ReferenceLine y={LOW_CONFIDENCE} stroke="#d97706" strokeDasharray="4 4" label={{ value: `${LOW_CONFIDENCE}%`, position: "right", fontSize: 11, fill: "#d97706" }} />
                    <Bar dataKey="confidence" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {chartData.map((d) => (
                        <Cell key={d.date} fill={d.confidence < LOW_CONFIDENCE ? "#f59e0b" : "#10b981"} />
                      ))}
                      <LabelList dataKey="confidence" position="top" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }} />
                    </Bar>
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
