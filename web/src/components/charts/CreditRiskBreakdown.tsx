import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList, ReferenceLine } from 'recharts';
import {
  CREDIT_GROUPS,
  RISK_DOWN,
  RISK_UP,
  creditFeature,
  groupTotals,
  sigmoid,
} from '@/lib/shapGroups';
import { InfluenceDonut } from '@/components/charts/InfluenceDonut';
import type { CreditRiskExplanation } from '@/types';

/**
 * The credit model's SHAP values are log-odds: sigmoid(base + Σ contributions)
 * equals risk_probability. Walking the cumulative log-odds through sigmoid turns
 * them into percentage-point steps from a typical customer to this one.
 */
function waterfallRows(explanation: CreditRiskExplanation) {
  const groups = groupTotals(explanation.feature_contributions, CREDIT_GROUPS, creditFeature)
    .filter((g) => Math.abs(g.value) > 1e-6)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  let logit = explanation.base_probability;
  const start = sigmoid(logit) * 100;
  const rows: { name: string; range: [number, number]; delta: number; fill: string; label: string }[] = [
    { name: 'Typical customer', range: [0, start], delta: start, fill: '#94a3b8', label: `${start.toFixed(0)}%` },
  ];
  for (const g of groups) {
    const before = sigmoid(logit) * 100;
    logit += g.value;
    const after = sigmoid(logit) * 100;
    const delta = after - before;
    rows.push({
      name: g.name,
      range: [Math.min(before, after), Math.max(before, after)],
      delta,
      fill: delta >= 0 ? RISK_UP : RISK_DOWN,
      label: `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(0)} pts`,
    });
  }
  const end = sigmoid(logit) * 100;
  rows.push({ name: 'This customer', range: [0, end], delta: end, fill: '#0f172a', label: `${end.toFixed(0)}%` });
  return rows;
}

/** "How the score was built": risk probability stepping from a typical customer to this one. */
export function CreditRiskWaterfall({ explanation }: { explanation: CreditRiskExplanation }) {
  const rows = waterfallRows(explanation);
  const max = Math.min(100, Math.ceil(Math.max(...rows.map((r) => r.range[1]), explanation.threshold * 100) / 10) * 10 + 10);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} interval={0} />
        <YAxis domain={[0, max]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <ReferenceLine
          y={explanation.threshold * 100}
          stroke="#d97706"
          strokeDasharray="4 4"
          label={{ value: `Flag at ${(explanation.threshold * 100).toFixed(0)}%`, position: 'insideTopRight', fontSize: 11, fill: '#b45309' }}
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(_v: unknown, _n: unknown, item: { payload?: (typeof rows)[number] }) => [item.payload?.label ?? '', 'Risk']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="range" radius={4} maxBarSize={56}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.fill} />
          ))}
          <LabelList dataKey="label" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Share of the decision each factor group accounts for. */
export function CreditFactorDonut({ explanation }: { explanation: CreditRiskExplanation }) {
  const data = groupTotals(explanation.feature_contributions, CREDIT_GROUPS, creditFeature, true);
  return <InfluenceDonut data={data} label="What decided this score" />;
}

/** The strongest individual drivers, in words, using the customer's actual numbers. */
export function CreditTopDrivers({ explanation, limit = 4 }: { explanation: CreditRiskExplanation; limit?: number }) {
  const values = explanation.computed_features ?? {};
  const top = Object.entries(explanation.feature_contributions)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit);

  return (
    <ul className="space-y-3">
      {top.map(([f, shap]) => {
        const meta = creditFeature(f);
        const up = shap > 0;
        const raw = values[f];
        return (
          <li key={f} className="flex items-start gap-3">
            <span
              className={up ? 'mt-0.5 size-7 rounded-full bg-danger-soft text-danger flex items-center justify-center shrink-0' : 'mt-0.5 size-7 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0'}
              aria-hidden
            >
              {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                {meta.label}
                <span className={up ? 'ml-2 text-xs font-medium text-danger' : 'ml-2 text-xs font-medium text-success'}>
                  {up ? 'raises risk' : 'lowers risk'}
                </span>
              </p>
              {raw !== undefined && meta.describe && (
                <p className="text-sm text-muted-foreground">This customer {meta.describe(raw)}.</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
