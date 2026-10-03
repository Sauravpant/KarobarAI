import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, CreditCard, Wallet, Search, Plus, Phone, MapPin, Calendar, Loader2, Pencil } from 'lucide-react';
import { useShopId } from '@/providers/AuthProvider';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState, EmptyState } from '@/components/ui/StateComponents';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Customer } from '@/types';

function utilization(c: Customer) {
  if (!c.credit_limit) return c.current_outstanding_balance > 0 ? 100 : 0;
  return Math.min(100, Math.round((c.current_outstanding_balance / c.credit_limit) * 100));
}

/** Credit-limit usage (not the ML score; that lives on Credit Risk). */
function UsageBadge({ customer }: { customer: Customer }) {
  const pct = utilization(customer);
  if (pct >= 80) return <Badge variant="destructive">{pct}% used</Badge>;
  if (pct >= 40) return <Badge variant="warning">{pct}% used</Badge>;
  return <Badge variant="success">{pct}% used</Badge>;
}

// Mirrors backend CustomerCreateRequest / CustomerUpdateRequest
const customerSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  credit_limit: z.coerce.number<number>().min(0, 'Cannot be negative'),
});
type CustomerForm = z.infer<typeof customerSchema>;

const blank: CustomerForm = { full_name: '', phone: '', address: '', credit_limit: 0 };

function CustomerDialog({
  open,
  onOpenChange,
  initial,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Customer | null;
  pending: boolean;
  onSubmit: (values: CustomerForm) => Promise<unknown>;
}) {
  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    values: initial
      ? {
          full_name: initial.full_name,
          phone: initial.phone ?? '',
          address: initial.address ?? '',
          credit_limit: initial.credit_limit,
        }
      : blank,
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    onOpenChange(false);
    form.reset(blank);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit customer' : 'Add customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Full name</Label>
            <Input id="c-name" aria-invalid={!!errors.full_name} {...form.register('full_name')} />
            {errors.full_name && <p className="text-xs text-danger">{errors.full_name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" type="tel" placeholder="Optional" {...form.register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-limit">Credit limit (Rs.)</Label>
              <Input
                id="c-limit"
                type="number"
                min={0}
                inputMode="decimal"
                aria-invalid={!!errors.credit_limit}
                {...form.register('credit_limit')}
              />
              {errors.credit_limit && <p className="text-xs text-danger">{errors.credit_limit.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-address">Address</Label>
            <Input id="c-address" placeholder="Optional" {...form.register('address')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {initial ? 'Save changes' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Customers() {
  const shopId = useShopId();
  const { data: customers, isLoading, isError, refetch } = useCustomers(shopId);
  const createCustomer = useCreateCustomer(shopId);
  const updateCustomer = useUpdateCustomer(shopId);
  const deleteCustomer = useDeleteCustomer(shopId);

  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search).toLowerCase();
  const [filter, setFilter] = useState<'all' | 'credit' | 'high'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = customers?.find((c) => c.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const list = customers ?? [];
    return {
      total: list.length,
      withCredit: list.filter((c) => c.current_outstanding_balance > 0).length,
      outstanding: list.reduce((s, c) => s + c.current_outstanding_balance, 0),
      totalLimit: list.reduce((s, c) => s + c.credit_limit, 0),
    };
  }, [customers]);

  const filtered = useMemo(
    () =>
      (customers ?? []).filter((c) => {
        const matches = c.full_name.toLowerCase().includes(query) || (c.phone ?? '').includes(query);
        if (!matches) return false;
        if (filter === 'credit') return c.current_outstanding_balance > 0;
        if (filter === 'high') return utilization(c) >= 80;
        return true;
      }),
    [customers, query, filter]
  );

  const toPayload = (v: CustomerForm) => ({
    full_name: v.full_name,
    phone: v.phone || undefined,
    address: v.address || undefined,
    credit_limit: v.credit_limit,
  });

  if (!shopId || isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="Could not load customers." onRetry={refetch} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Credit limits, outstanding balances and customer records."
        icon={Users}
        actions={
          <Button onClick={() => setDialog('create')}>
            <Plus /> Add customer
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Customers" value={stats.total.toLocaleString('en-IN')} icon={Users} iconBg="bg-brand-soft" iconColor="text-brand" />
        <StatCard title="With credit" value={stats.withCredit.toLocaleString('en-IN')} icon={CreditCard} iconBg="bg-warning-soft" iconColor="text-warning" />
        <StatCard title="Outstanding" value={formatCurrency(stats.outstanding)} icon={Wallet} iconBg="bg-danger-soft" iconColor="text-danger" />
        <StatCard title="Total credit limit" value={formatCurrency(stats.totalLimit)} icon={CreditCard} iconBg="bg-success-soft" iconColor="text-success" />
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or phone"
              aria-label="Search customers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="bg-slate-100 p-0.5 rounded-lg flex gap-1" role="tablist">
            {(
              [
                ['all', 'All'],
                ['credit', 'Has credit'],
                ['high', '80%+ of limit'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                  filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                )}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={customers?.length ? 'No matching customers' : 'No customers yet'}
            description={customers?.length ? 'Try a different search or filter.' : 'Add your first customer to start tracking credit sales.'}
            action={
              !customers?.length && (
                <Button size="sm" onClick={() => setDialog('create')}>
                  <Plus /> Add customer
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Customer</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Phone</th>
                  <th className="text-right px-5 py-3">Credit limit</th>
                  <th className="text-left px-5 py-3 hidden sm:table-cell">Usage</th>
                  <th className="text-right px-5 py-3">Outstanding</th>
                  <th className="text-left px-5 py-3 hidden lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedId(c.id)}
                    tabIndex={0}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-brand-soft text-brand text-xs font-bold">
                            {c.full_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-slate-800 truncate max-w-48" title={c.full_name}>
                          {c.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{c.phone || '—'}</td>
                    <td className="px-5 py-3 text-right text-slate-700">{formatCurrency(c.credit_limit)}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <UsageBadge customer={c} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.current_outstanding_balance > 0 ? (
                        <span className="font-semibold text-danger">{formatCurrency(c.current_outstanding_balance)}</span>
                      ) : (
                        <span className="text-success font-medium">Cleared</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden lg:table-cell">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-100 text-xs text-muted-foreground">
          Showing {filtered.length} of {customers?.length ?? 0} customers
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-brand-soft text-brand text-lg font-bold">
                      {selected.full_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="text-lg truncate">{selected.full_name}</SheetTitle>
                    <SheetDescription asChild>
                      <div className="mt-1">
                        <UsageBadge customer={selected} />
                      </div>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 p-4">
                <div className="space-y-2 text-sm text-slate-700">
                  <p className="flex items-center gap-3">
                    <Phone className="size-4 text-slate-400" /> {selected.phone || 'No phone'}
                  </p>
                  <p className="flex items-center gap-3">
                    <MapPin className="size-4 text-slate-400" /> {selected.address || 'No address'}
                  </p>
                  <p className="flex items-center gap-3">
                    <Calendar className="size-4 text-slate-400" /> Customer since {formatDate(selected.created_at)}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-3 tabular">
                  {[
                    ['Credit limit', formatCurrency(selected.credit_limit), 'text-slate-800'],
                    ['Outstanding', formatCurrency(selected.current_outstanding_balance), 'text-danger'],
                    ['Available credit', formatCurrency(Math.max(0, selected.credit_limit - selected.current_outstanding_balance)), 'text-success'],
                    ['Limit used', `${utilization(selected)}%`, 'text-slate-800'],
                  ].map(([label, value, cls]) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3">
                      <dt className="text-xs text-muted-foreground mb-1">{label}</dt>
                      <dd className={cn('text-lg font-bold', cls)}>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialog('edit')}>
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-danger border-red-200 hover:bg-danger-soft"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Deactivate
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CustomerDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        initial={dialog === 'edit' ? selected : null}
        pending={createCustomer.isPending || updateCustomer.isPending}
        onSubmit={(v) =>
          dialog === 'edit' && selected
            ? updateCustomer.mutateAsync({ customerId: selected.id, payload: toPayload(v) })
            : createCustomer.mutateAsync(toPayload(v))
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Deactivate customer?"
        description={`${selected?.full_name ?? 'This customer'} will be hidden from lists. Their transactions and credit history are kept.`}
        confirmLabel="Deactivate"
        pending={deleteCustomer.isPending}
        onConfirm={() => {
          if (selected) deleteCustomer.mutate(selected.id);
          setConfirmDelete(false);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
