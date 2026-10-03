import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

type Slice = { name: string; value: number; color: string };

/** Share of influence per factor group. Values are listed beside the donut, so color is never the only cue. */
export function InfluenceDonut({ data, label }: { data: Slice[]; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const slices = data.filter((d) => d.value > 0);
  if (total <= 0) return <p className="text-sm text-muted-foreground py-8 text-center">No influence data.</p>;
  const share = (v: number) => `${Math.round((v / total) * 100)}%`;
  const top = slices.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative size-44 shrink-0" role="img" aria-label={`${label}: ${slices.map((d) => `${d.name} ${share(d.value)}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive
            >
              {slices.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown, name: unknown) => [share(Number(v)), String(name)]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center: the biggest factor, so the headline reads without the legend */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-9">
          <span className="text-2xl font-bold text-slate-900 tabular">{share(top.value)}</span>
          <span className="text-[11px] leading-tight text-muted-foreground">{top.name}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5 text-sm whitespace-nowrap">
            <span className="size-3 rounded-sm shrink-0" style={{ background: d.color }} aria-hidden />
            <span className="flex-1 text-slate-700">{d.name}</span>
            <span className="font-semibold text-slate-900 tabular">{share(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
