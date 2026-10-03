import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from 'recharts';

type Row = { label: string; value: number; color: string; group?: string };

/** Horizontal bars of the strongest drivers, biggest first. */
export function DriverBars({
  data,
  valueLabel,
  format = (v) => v.toFixed(2),
}: {
  data: Row[];
  valueLabel: string;
  format?: (v: number) => string;
}) {
  const height = Math.max(160, data.length * 34 + 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={170}
          tick={{ fontSize: 12, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(v: unknown, _n: unknown, item: { payload?: Row }) => [
            `${format(Number(v))}${item.payload?.group ? ` · ${item.payload.group}` : ''}`,
            valueLabel,
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} style={{ fontSize: 11, fill: '#334155' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
