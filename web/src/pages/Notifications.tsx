import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShopId } from '@/providers/AuthProvider';
import { useLowStockProducts } from '@/hooks/useInventory';
import { useCreditSales } from '@/hooks/useTransactions';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateComponents';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Package, ShieldAlert, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatDateTime, formatRelative } from '@/utils/format';
import { ROUTES } from '@/constants/routes';

type NotifType = 'inventory' | 'credit' | 'payment';

type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  href: string;
  at: string;
};

const typeConfig = {
  inventory: {
    icon: Package,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    label: 'Inventory',
  },
  credit: {
    icon: ShieldAlert,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    label: 'Credit',
  },
  payment: {
    icon: CreditCard,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    label: 'Payment',
  },
};

export default function Notifications() {
  const shopId = useShopId();
  const low = useLowStockProducts(shopId);
  const unpaidQ = useCreditSales(shopId, 'unpaid');
  const overdueQ = useCreditSales(shopId, 'overdue');
  const paidQ = useCreditSales(shopId, 'paid');
  const lowStock = low.data;
  const unpaid = unpaidQ.data;
  const overdue = overdueQ.data;
  const paid = paidQ.data;
  const queries = [low, unpaidQ, overdueQ, paidQ];
  const [activeFilter, setActiveFilter] = useState<'all' | NotifType>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const notifications = useMemo(() => {
    const list: AppNotification[] = [];

    (lowStock ?? []).forEach((p) => {
      list.push({
        id: `inv-${p.id}`,
        title: p.stock_quantity <= 0 ? 'Out of Stock' : 'Low Stock Alert',
        message: `${p.product_name} has ${p.stock_quantity} ${p.unit} left (reorder at ${p.reorder_level}).`,
        type: 'inventory',
        href: ROUTES.INVENTORY,
        at: p.updated_at,
      });
    });

    [...(overdue ?? []), ...(unpaid ?? [])].forEach((sale) => {
      list.push({
        id: `credit-${sale.id}`,
        title: sale.status === 'overdue' ? 'Payment Overdue' : 'Unpaid Credit',
        message: `Credit of ${formatCurrency(sale.credit_amount)} due ${formatDate(sale.due_date)}${
          sale.remarks ? ` — ${sale.remarks}` : ''
        }.`,
        type: 'credit',
        href: ROUTES.TRANSACTIONS,
        at: sale.created_at,
      });
    });

    (paid ?? [])
      .slice(0, 5)
      .forEach((sale) => {
        list.push({
          id: `paid-${sale.id}`,
          title: 'Payment Received',
          message: `Credit of ${formatCurrency(sale.credit_amount)} marked as paid${
            sale.paid_at
              ? ` on ${new Date(sale.paid_at).toLocaleDateString('en-IN')}`
              : ''
          }.`,
          type: 'payment',
          href: ROUTES.TRANSACTIONS,
          at: sale.paid_at ?? sale.created_at,
        });
      });

    return list.filter((n) => !dismissed.has(n.id));
  }, [lowStock, unpaid, overdue, paid, dismissed]);

  const filtered = notifications.filter(
    (n) => activeFilter === 'all' || n.type === activeFilter
  );

  if (!shopId || queries.some((q) => q.isLoading)) return <PageSkeleton />;
  if (queries.some((q) => q.isError)) {
    return <ErrorState message="Could not load alerts." onRetry={() => queries.forEach((q) => q.refetch())} />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Alerts"
        description="Low stock and credit alerts from your live inventory and credit sales."
        icon={Bell}
        actions={notifications.length > 0 && <Badge variant="destructive">{notifications.length} open</Badge>}
      />

      <div className="flex gap-2 flex-wrap">
        {(['all', 'inventory', 'credit', 'payment'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors',
              activeFilter === f
                ? 'bg-brand text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {f === 'all' ? 'All' : typeConfig[f].label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No low-stock or unpaid credit alerts right now."
          />
        ) : (
          filtered.map((n) => {
            const cfg = typeConfig[n.type];
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-start hover:border-slate-300 transition-colors"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    cfg.iconBg
                  )}
                >
                  <Icon className={cn('w-5 h-5', cfg.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{n.title}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                      <time className="text-xs text-slate-500 mt-1 block" dateTime={n.at} title={formatDateTime(n.at)}>
                        {formatRelative(n.at)}
                      </time>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 h-8"
                      onClick={() => setDismissed((prev) => new Set(prev).add(n.id))}
                    >
                      Dismiss
                    </Button>
                  </div>
                  <Link
                    to={n.href}
                    className="text-xs font-semibold text-brand hover:underline mt-2 inline-block"
                  >
                    View details →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
