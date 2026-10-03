import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, Package, TrendingDown, TrendingUp, UserCircle, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useShopId, useAuth } from '@/providers/AuthProvider';
import { useDashboard } from '@/hooks/useDashboard';
import { useCustomers } from '@/hooks/useCustomers';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState, EmptyState } from '@/components/ui/StateComponents';
import { StatCard } from '@/components/ui/StatCard';
import { DailyBriefCard } from '@/components/dashboard/DailyBriefCard';
import { cn } from '@/lib/utils';
import { formatCompact, formatCurrency, pctChange } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-[15px] text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-[13px] text-brand font-semibold hover:opacity-75">
      {children} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

const chartTooltip = {
  contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 },
  formatter: (value: unknown, name: unknown) => [formatCurrency(Number(value)), String(name)] as [string, string],
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const shopId = useShopId();
  const { activeShop, user } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboard(shopId);
  const { data: customers } = useCustomers(shopId);

  if (!shopId || isLoading) return <PageSkeleton />;
  if (isError || !data) return <ErrorState message="Could not load the dashboard." onRetry={refetch} />;

  const { summary, inventory_status: inv, revenue_by_payment: pay } = data;
  // sales_over_time is 7 zero-filled days, oldest first; the last two are yesterday and today
  const yesterday = data.sales_over_time.at(-2);
  const revenueTrend = yesterday ? pctChange(summary.today_revenue, yesterday.revenue) : undefined;
  const profitTrend = yesterday ? pctChange(summary.today_profit, yesterday.profit) : undefined;
  const chartData = data.sales_over_time.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    Revenue: d.revenue,
    Profit: d.profit,
  }));
  const payTotal = pay.cash + pay.credit + pay.qr;
  const topDebtors = [...(customers ?? [])]
    .filter((c) => c.current_outstanding_balance > 0)
    .sort((a, b) => b.current_outstanding_balance - a.current_outstanding_balance)
    .slice(0, 5);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {greeting()}, {user?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's how <span className="font-medium text-slate-700">{activeShop?.shop_name}</span> is doing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="Today's revenue"
          value={formatCurrency(summary.today_revenue)}
          trend={revenueTrend}
          trendLabel="vs yesterday"
          subtitle={revenueTrend === undefined ? `All time ${formatCurrency(summary.total_revenue)}` : undefined}
          icon={Wallet}
          iconBg="bg-brand-soft"
          iconColor="text-brand"
        />
        <StatCard
          title="Today's profit"
          value={formatCurrency(summary.today_profit)}
          trend={profitTrend}
          trendLabel="vs yesterday"
          subtitle={profitTrend === undefined ? `All time ${formatCurrency(summary.total_profit)}` : undefined}
          icon={TrendingUp}
          iconBg="bg-success-soft"
          iconColor="text-success"
        />
        <StatCard
          title="Today's transactions"
          value={summary.today_transactions.toLocaleString('en-IN')}
          subtitle={`${summary.total_transactions.toLocaleString('en-IN')} all time`}
          icon={Activity}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
        <StatCard
          title="Credit outstanding"
          value={formatCurrency(summary.total_credit_outstanding)}
          subtitle={`${summary.total_customers} customers`}
          icon={UserCircle}
          iconBg="bg-warning-soft"
          iconColor="text-warning"
        />
        <StatCard
          title="Low on stock"
          value={summary.low_stock_count.toLocaleString('en-IN')}
          subtitle={`of ${summary.total_products.toLocaleString('en-IN')} products`}
          icon={Package}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      <DailyBriefCard shopId={shopId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Section title="Sales and profit, last 7 days" action={<SectionLink to={ROUTES.REPORTS}>Reports</SectionLink>}>
            <div className="p-5">
              {chartData.length === 0 ? (
                <EmptyState title="No sales yet" description="Record a transaction to see the chart." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E3182D" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#E3182D" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip {...chartTooltip} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Revenue" stroke="#E3182D" strokeWidth={2.5} fill="url(#revGrad)" />
                    <Area type="monotone" dataKey="Profit" stroke="#FF6B35" strokeWidth={2} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Best-selling products" action={<SectionLink to={ROUTES.INVENTORY}>Inventory</SectionLink>}>
            {data.top_products.length === 0 ? (
              <EmptyState title="No product sales yet" description="Record a sale to see top products." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider bg-slate-50/70">
                      <th className="px-5 py-3 text-left">Product</th>
                      <th className="px-5 py-3 text-right">Units sold</th>
                      <th className="px-5 py-3 text-right">Revenue</th>
                      <th className="px-5 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 tabular">
                    {data.top_products.map((p) => (
                      <tr key={p.product_name} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800 max-w-50 truncate" title={p.product_name}>
                          {p.product_name}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">{p.total_sold.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(p.total_revenue)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-success">{formatCurrency(p.total_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Revenue by payment">
            <div className="p-5 space-y-4">
              {payTotal === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No revenue yet</p>
              ) : (
                (
                  [
                    ['Cash', pay.cash, 'bg-emerald-500'],
                    ['Credit', pay.credit, 'bg-amber-500'],
                    ['QR', pay.qr, 'bg-slate-500'],
                  ] as const
                ).map(([label, amount, bar]) => {
                  const pct = Math.round((amount / payTotal) * 100);
                  return (
                    <div key={label} className="space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="font-medium text-slate-700">{label}</span>
                        <span className="tabular">
                          <span className="font-semibold text-slate-900">{formatCurrency(amount)}</span>
                          <span className="text-[11px] text-slate-500 ml-2">{pct}%</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700', bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Section>

          <Section title="Inventory status" action={<SectionLink to={ROUTES.INVENTORY}>Manage</SectionLink>}>
            <div className="p-4 space-y-2">
              {[
                { label: 'In stock', count: inv.in_stock, cls: 'bg-success-soft text-emerald-800', icon: Package },
                { label: 'Low stock', count: inv.low_stock, cls: 'bg-warning-soft text-amber-800', icon: AlertTriangle },
                { label: 'Out of stock', count: inv.out_of_stock, cls: 'bg-danger-soft text-red-800', icon: TrendingDown },
              ].map(({ label, count, cls, icon: Icon }) => (
                <div key={label} className={cn('flex items-center justify-between px-4 py-2.5 rounded-xl', cls)}>
                  <span className="text-[13px] font-semibold flex items-center gap-2">
                    <Icon className="size-3.5" /> {label}
                  </span>
                  <span className="text-[13px] font-bold tabular">{count}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Top credit customers" action={<SectionLink to={ROUTES.CUSTOMERS}>Customers</SectionLink>}>
            {topDebtors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No outstanding credit</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {topDebtors.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span className="font-medium text-slate-700 truncate pr-3" title={c.full_name}>
                      {c.full_name}
                    </span>
                    <span className="font-semibold text-slate-900 tabular shrink-0">
                      {formatCurrency(c.current_outstanding_balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
