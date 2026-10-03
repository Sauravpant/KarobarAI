import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, AlertTriangle, XCircle, Banknote, Package, Loader2, ArrowDownToLine, ArrowUpFromLine, Pencil, Search } from 'lucide-react';
import { useShopId } from '@/providers/AuthProvider';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useStockIn,
  useStockOut,
  useDeleteProduct,
} from '@/hooks/useInventory';
import { useCategories } from '@/hooks/useCategories';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ROUTES } from '@/constants/routes';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState, EmptyState } from '@/components/ui/StateComponents';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StockBadge, stockStatus } from '@/components/ui/StatusBadge';
import { ProductDialog } from '@/components/inventory/ProductDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/format';

type Tab = 'all' | 'low' | 'out';
const TABS: [Tab, string][] = [
  ['all', 'All products'],
  ['low', 'Low stock'],
  ['out', 'Out of stock'],
];

export default function Inventory() {
  const shopId = useShopId();
  const { data: products, isLoading, isError, refetch } = useProducts(shopId);
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct(shopId);
  const updateProduct = useUpdateProduct(shopId);
  const stockIn = useStockIn(shopId);
  const stockOut = useStockOut(shopId);
  const deleteProduct = useDeleteProduct(shopId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search).toLowerCase();
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [stockQty, setStockQty] = useState(1);
  const [stockReason, setStockReason] = useState('');

  const categoryName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);

  const stats = useMemo(() => {
    const list = products ?? [];
    return {
      total: list.length,
      low: list.filter((p) => stockStatus(p) === 'low').length,
      out: list.filter((p) => stockStatus(p) === 'out').length,
      value: list.reduce((s, p) => s + p.stock_quantity * p.cost_price, 0),
    };
  }, [products]);

  // Same rule as the backend's /low-stock (stock <= reorder level), applied to the
  // full list so the tab stays in sync with optimistic stock updates
  const filtered = useMemo(
    () =>
      (products ?? []).filter((p) => {
        const s = stockStatus(p);
        if (tab === 'low' && s === 'in') return false;
        if (tab === 'out' && s !== 'out') return false;
        return p.product_name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
      }),
    [products, tab, query]
  );

  const selected = products?.find((p) => p.id === selectedId) ?? null;
  const qtyValid = Number.isInteger(stockQty) && stockQty > 0;
  const adjust = (direction: 'in' | 'out') => {
    if (!selected) return;
    const vars = { productId: selected.id, payload: { quantity: stockQty, reason: stockReason || undefined } };
    (direction === 'in' ? stockIn : stockOut).mutate(vars, { onSuccess: () => setStockReason('') });
  };

  if (!shopId || isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="Could not load products." onRetry={refetch} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Stock levels, pricing and your product catalog."
        icon={Package}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={ROUTES.CATEGORIES}>Categories</Link>
            </Button>
            <Button onClick={() => setDialog('create')}>
              <Plus /> Add product
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Products" value={stats.total.toLocaleString('en-IN')} icon={Package} />
        <StatCard title="Low stock" value={stats.low.toLocaleString('en-IN')} icon={AlertTriangle} iconBg="bg-warning-soft" iconColor="text-warning" />
        <StatCard title="Out of stock" value={stats.out.toLocaleString('en-IN')} icon={XCircle} iconBg="bg-danger-soft" iconColor="text-danger" />
        <StatCard title="Stock value" value={formatCurrency(stats.value)} subtitle="At cost price" icon={Banknote} iconBg="bg-success-soft" iconColor="text-success" />
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="bg-slate-100 p-0.5 rounded-lg flex gap-1" role="tablist" aria-label="Stock filter">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                  tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {label}
                {key !== 'all' && <span className="ml-1 tabular text-slate-500">{key === 'low' ? stats.low + stats.out : stats.out}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name or SKU"
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={products?.length ? 'No matching products' : 'No products yet'}
            description={products?.length ? 'Try a different search or filter.' : 'Add your first product to start tracking stock.'}
            action={
              !products?.length && (
                <Button size="sm" onClick={() => setDialog('create')}>
                  <Plus /> Add product
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Category</th>
                  <th className="text-right px-5 py-3">Stock</th>
                  <th className="text-right px-5 py-3 hidden lg:table-cell">Reorder at</th>
                  <th className="text-right px-5 py-3 hidden sm:table-cell">Cost</th>
                  <th className="text-right px-5 py-3">Price</th>
                  <th className="text-left px-5 py-3 hidden sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(p.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedId(p.id)}
                    className="cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800 truncate max-w-56" title={p.product_name}>
                        {p.product_name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{p.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{categoryName.get(p.category_id) ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {p.stock_quantity.toLocaleString('en-IN')} <span className="text-slate-500 font-normal">{p.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 hidden lg:table-cell">{p.reorder_level}</td>
                    <td className="px-5 py-3 text-right text-slate-500 hidden sm:table-cell">{formatCurrency(p.cost_price)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(p.selling_price)}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <StockBadge product={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-muted-foreground">
          Showing {filtered.length} of {products?.length ?? 0} products
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="border-b border-slate-100">
                <SheetTitle className="text-lg pr-6">{selected.product_name}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{selected.sku}</span>
                    <StockBadge product={selected} />
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 space-y-6">
                <dl className="grid grid-cols-2 gap-3 tabular">
                  {[
                    ['Category', categoryName.get(selected.category_id) ?? '—'],
                    ['In stock', `${selected.stock_quantity.toLocaleString('en-IN')} ${selected.unit}`],
                    ['Cost price', formatCurrency(selected.cost_price)],
                    ['Selling price', formatCurrency(selected.selling_price)],
                    ['Reorder at', String(selected.reorder_level)],
                    ['Flags', [selected.is_staple && 'Staple', selected.is_perishable && 'Perishable'].filter(Boolean).join(', ') || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3 min-w-0">
                      <dt className="text-xs text-muted-foreground mb-1">{label}</dt>
                      <dd className="text-sm font-semibold text-slate-800 truncate">{value}</dd>
                    </div>
                  ))}
                </dl>

                <fieldset className="space-y-3 border-t border-slate-100 pt-5">
                  <legend className="font-semibold text-sm text-slate-800">Adjust stock</legend>
                  <div className="grid grid-cols-[6rem_1fr] gap-2">
                    <div>
                      <Label htmlFor="stock-qty" className="sr-only">Quantity</Label>
                      <Input
                        id="stock-qty"
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={Number.isNaN(stockQty) ? '' : stockQty}
                        aria-invalid={!qtyValid}
                        onChange={(e) => setStockQty(e.target.valueAsNumber)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="stock-reason" className="sr-only">Reason</Label>
                      <Input id="stock-reason" placeholder="Reason (optional)" value={stockReason} onChange={(e) => setStockReason(e.target.value)} />
                    </div>
                  </div>
                  {!qtyValid && <p className="text-xs text-danger">Enter a whole number above 0.</p>}
                  {qtyValid && stockQty > selected.stock_quantity && (
                    <p className="text-xs text-muted-foreground">Stock out is limited to the {selected.stock_quantity} in stock.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="bg-success hover:bg-success/90 shadow-none" disabled={stockIn.isPending || !qtyValid} onClick={() => adjust('in')}>
                      {stockIn.isPending ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />} Stock in
                    </Button>
                    <Button
                      variant="outline"
                      disabled={stockOut.isPending || !qtyValid || stockQty > selected.stock_quantity}
                      onClick={() => adjust('out')}
                    >
                      {stockOut.isPending ? <Loader2 className="animate-spin" /> : <ArrowUpFromLine />} Stock out
                    </Button>
                  </div>
                </fieldset>

                <div className="flex gap-2 border-t border-slate-100 pt-5">
                  <Button variant="outline" className="flex-1" onClick={() => setDialog('edit')}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="outline" className="flex-1 text-danger border-red-200 hover:bg-danger-soft" onClick={() => setConfirmDeactivate(true)}>
                    Deactivate
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ProductDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        product={dialog === 'edit' ? selected : null}
        categories={categories ?? []}
        pending={createProduct.isPending || updateProduct.isPending}
        onSubmit={(payload) => {
          if (dialog === 'edit' && selected) {
            // Backend update doesn't accept stock_quantity
            const { stock_quantity: _ignored, ...rest } = payload;
            void _ignored;
            return updateProduct.mutateAsync({ productId: selected.id, payload: rest });
          }
          return createProduct.mutateAsync(payload);
        }}
      />

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate product?"
        description={`${selected?.product_name ?? 'This product'} will be hidden from inventory and sales. Past transactions are kept.`}
        confirmLabel="Deactivate"
        pending={deleteProduct.isPending}
        onConfirm={() => {
          if (selected) deleteProduct.mutate(selected.id);
          setConfirmDeactivate(false);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
