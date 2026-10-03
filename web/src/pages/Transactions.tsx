import { useMemo, useState, useEffect, useRef } from "react";
import { useShopId } from "@/providers/AuthProvider";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  useInfiniteTransactions,
  useTransactionStats,
  useCreateTransaction,
  useUpdateCreditSale,
  useCreditSales,
  useTransaction,
} from "@/hooks/useTransactions";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useInventory";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Clock,
  Search,
  Plus,
  Receipt,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditStatusBadge, PaymentBadge } from "@/components/ui/StatusBadge";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";
import type {
  CreateTransactionPayload,
  CreditStatus,
  PaymentType,
  Transaction,
  TransactionType,
} from "@/types";

function paymentLabel(type: PaymentType) {
  return type === "cash" ? "Cash" : type === "qr" ? "QR" : "Credit";
}

const txStatus = (tx: Transaction) => tx.credit_sale?.status ?? "completed";

type CartLine = {
  product_id: string;
  quantity: number;
  name: string;
  price: number;
};

export default function Transactions() {
  const shopId = useShopId();

  const [search, setSearch] = useState("");
  const deferredSearch = useDebouncedValue(search, 350);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [creditFilter, setCreditFilter] = useState<CreditStatus | "all">("all");

  const paymentFilter =
    activeTab === "cash" ? "cash"
    : activeTab === "qr" ? "qr"
    : activeTab === "credit" ? "credit"
    : undefined;

  const {
    data: infiniteData,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteTransactions(shopId, {
    payment_type: paymentFilter as PaymentType | undefined,
    search: deferredSearch.trim() || undefined,
    limit: 25,
  });

  const { data: statsData } = useTransactionStats(shopId);
  const { data: customers } = useCustomers(shopId);
  const { data: products } = useProducts(shopId);
  const { data: unpaidCredits } = useCreditSales(shopId, "unpaid");
  const { data: overdueCredits } = useCreditSales(shopId, "overdue");
  const { data: paidCredits } = useCreditSales(shopId, "paid");
  const { data: detailTx } = useTransaction(shopId, selectedId ?? "");
  const createTx = useCreateTransaction(shopId);
  const updateCredit = useUpdateCreditSale(shopId);

  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!observerRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [txType, setTxType] = useState<TransactionType>("sale");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productPick, setProductPick] = useState("");

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    (customers ?? []).forEach((c) => map.set(c.id, c.full_name));
    return map;
  }, [customers]);

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    (products ?? []).forEach((p) => map.set(p.id, p.product_name));
    return map;
  }, [products]);

  const transactions = useMemo(() => {
    return infiniteData?.pages.flatMap((page) => page.items) ?? [];
  }, [infiniteData]);

  const totalMatching = infiniteData?.pages[0]?.total ?? 0;

  const stats = useMemo(() => {
    if (statsData) {
      return {
        todaySales: statsData.today_sales,
        totalSales: statsData.total_sales,
        creditSales: statsData.credit_sales,
        pending: statsData.pending_credit,
        count: statsData.total_count,
      };
    }
    return null;
  }, [statsData]);

  const filtered = transactions;

  const selected = detailTx ?? transactions.find((t) => t.id === selectedId);
  const cartSubtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const cartTotal = cartSubtotal - discount;
  const stockOf = (productId: string) => products?.find((p) => p.id === productId)?.stock_quantity ?? 0;
  // Sales can't exceed stock (backend rejects it); purchases add stock so any quantity is fine
  // Same rule the backend enforces: credit only while owed + this sale <= credit_limit
  const creditCustomer =
    txType === "sale" && paymentType === "credit" ? customers?.find((c) => c.id === customerId) : undefined;
  const availableCredit = creditCustomer
    ? Math.max(0, creditCustomer.credit_limit - creditCustomer.current_outstanding_balance)
    : null;
  const cartError =
    txType === "sale"
      ? cart.find((l) => l.quantity > stockOf(l.product_id))
        ? "A quantity is more than what's in stock."
        : discount > cartSubtotal
          ? "Discount is larger than the subtotal."
          : availableCredit !== null && cartTotal > availableCredit
            ? `Over the credit limit: ${creditCustomer?.full_name} can take ${formatCurrency(availableCredit)} more on credit.`
            : null
      : null;

  const addProductToCart = () => {
    const product = products?.find((p) => p.id === productPick);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product_id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          quantity: 1,
          name: product.product_name,
          // Backend prices sale items at selling_price; purchases at cost_price
          price: txType === "sale" ? product.selling_price : product.cost_price,
        },
      ];
    });
    setProductPick("");
  };

  const resetSaleForm = () => {
    setTxType("sale");
    setPaymentType("cash");
    setCustomerId("");
    setDueDate("");
    setDiscount(0);
    setNotes("");
    setCart([]);
    setProductPick("");
  };

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || cartError) return;
    const payload: CreateTransactionPayload = {
      transaction_type: txType,
      payment_type: paymentType,
      discount: discount || undefined,
      notes: notes || undefined,
      items: cart.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
      })),
      customer_id: customerId || undefined,
      due_date: paymentType === "credit" ? dueDate : undefined,
    };
    await createTx.mutateAsync(payload);
    setSaleOpen(false);
    resetSaleForm();
  };

  if (!shopId || isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="Could not load transactions." onRetry={refetch} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Sales and purchases, with cash, QR and credit (khata) payments."
        icon={Receipt}
        actions={
          <Button onClick={() => setSaleOpen(true)}>
            <Plus /> New transaction
          </Button>
        }
      />

      {stats && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.todaySales)}
          icon={TrendingUp}
          iconBg="bg-emerald-50/80"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="All Sales"
          value={formatCurrency(stats.totalSales)}
          icon={ShoppingCart}
          iconBg="bg-red-50/80"
          iconColor="text-brand"
        />
        <StatCard
          title="Credit Sales"
          value={formatCurrency(stats.creditSales)}
          icon={CreditCard}
          iconBg="bg-red-50/80"
          iconColor="text-brand"
        />
        <StatCard
          title="Pending Credit"
          value={formatCurrency(stats.pending)}
          icon={Clock}
          iconBg="bg-amber-50/80"
          iconColor="text-amber-600"
        />
      </div>}

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-slate-100/50">
        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between gap-4 flex-wrap bg-slate-50/20">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto overflow-x-auto">
            <TabsList className="h-9 border border-slate-200/40 p-0.5 rounded-lg bg-slate-100/80">
              <TabsTrigger value="all" className="text-xs font-semibold px-3 py-1 cursor-pointer">All</TabsTrigger>
              <TabsTrigger value="cash" className="text-xs font-semibold px-3 py-1 cursor-pointer">Cash</TabsTrigger>
              <TabsTrigger value="qr" className="text-xs font-semibold px-3 py-1 cursor-pointer">QR</TabsTrigger>
              <TabsTrigger value="credit" className="text-xs font-semibold px-3 py-1 cursor-pointer">Credit Sales</TabsTrigger>
              <TabsTrigger value="khata" className="text-xs font-semibold px-3 py-1 cursor-pointer">Khata</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search transactions"
              aria-label="Search transactions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-60 bg-white border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-brand"
            />
          </div>
        </div>

        {activeTab === "khata" ?
          <div className="p-0 space-y-0">
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex gap-2">
              {(["all", "unpaid", "overdue", "paid"] as const).map((s) => (
                <button
                  key={s}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer border",
                    creditFilter === s ?
                      "bg-white border-slate-300 text-slate-900 shadow-xs"
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  )}
                  onClick={() => setCreditFilter(s)}>
                  {s === "all" ? "All Open" : s}
                </button>
              ))}
            </div>
            {(() => {
              const rows =
                creditFilter === "unpaid" ? (unpaidCredits ?? [])
                : creditFilter === "overdue" ? (overdueCredits ?? [])
                : creditFilter === "paid" ? (paidCredits ?? [])
                : [...(unpaidCredits ?? []), ...(overdueCredits ?? [])];
              if (!rows.length) {
                return (
                  <EmptyState
                    title="No open credit sales"
                    description="Unpaid and overdue khata entries will appear here."
                  />
                );
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200/60">
                        <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Due
                        </th>
                        <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {formatCurrency(Number(sale.credit_amount))}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                            {formatDate(sale.due_date)}
                          </td>
                          <td className="px-6 py-4">
                            <CreditStatusBadge status={sale.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            {sale.status !== "paid" && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all"
                                disabled={updateCredit.isPending}
                                onClick={() =>
                                  updateCredit.mutate({
                                    creditSaleId: sale.id,
                                    payload: { status: "paid" },
                                  })
                                }>
                                Mark Paid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        : filtered.length === 0 ?
          <EmptyState
            title={search || paymentFilter ? "No matching transactions" : "No transactions yet"}
            description={search || paymentFilter ? "Try a different search or tab." : "Record a sale to start tracking revenue."}
          />
        : <div className="overflow-auto max-h-[65vh]">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200/60">
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/50 transition-colors duration-150 cursor-pointer group"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedId(t.id)}
                    onClick={() => setSelectedId(t.id)}>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      #{t.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 tracking-tight group-hover:text-brand transition-colors">
                      {t.customer_id ?
                        (customerMap.get(t.customer_id) ?? "Customer")
                      : "Walk-in"}
                    </td>
                    <td className="px-6 py-4">
                      <PaymentBadge type={t.payment_type} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 capitalize">{t.transaction_type}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-800">
                      {formatCurrency(Number(t.total_amount))}
                    </td>
                    <td className="px-6 py-4">
                      <CreditStatusBadge status={txStatus(t)} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                      <RelativeTime value={t.created_at} />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
            {hasNextPage && (
              <div
                ref={observerRef}
                className="py-4 flex justify-center items-center text-sm text-slate-500 gap-2 border-t border-slate-100 bg-slate-50/20"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-brand" />
                    <span>Loading more transactions...</span>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Load more
                  </Button>
                )}
              </div>
            )}
          </div>
        }

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center text-xs font-semibold text-slate-500">
          <p>
            Showing {transactions.length} of {totalMatching} transactions
          </p>
          {!hasNextPage && transactions.length > 0 && (
            <span className="text-slate-500 font-medium">All loaded</span>
          )}
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4 border-b border-slate-100">
                <SheetTitle className="font-bold text-slate-900">
                  {selected.transaction_type === "purchase" ? "Purchase" : "Sale"} #{selected.id.slice(0, 8)}
                </SheetTitle>
                <CreditStatusBadge status={txStatus(selected)} />
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-semibold text-slate-800">
                      {selected.customer_id ?
                        (customerMap.get(selected.customer_id) ?? "Customer")
                      : "Walk-in"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Method</span>
                    <span className="font-semibold text-slate-800">
                      {paymentLabel(selected.payment_type)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Date</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(selected.created_at)}
                    </span>
                  </div>
                  {selected.notes && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Notes</span>
                      <span className="font-semibold text-slate-800">
                        {selected.notes}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Items
                  </h3>
                  {selected.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm border-b border-slate-50 py-2">
                      <span className="text-slate-700">
                        {productMap.get(item.product_id) ??
                          item.product_id.slice(0, 8)}{" "}
                        × {item.quantity}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                  ))}
                  {selected.discount > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Discount</span>
                      <span>-{formatCurrency(selected.discount)}</span>
                    </div>
                  )}
                  {selected.credit_sale && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Credit due</span>
                      <span>{formatDate(selected.credit_sale.due_date)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2">
                    <span className="font-bold text-slate-800">Total</span>
                    <span className="font-bold text-red-600 text-lg">
                      {formatCurrency(Number(selected.total_amount))}
                    </span>
                  </div>
                </div>

                {selected.credit_sale &&
                  selected.credit_sale.status !== "paid" && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={updateCredit.isPending}
                      onClick={() =>
                        updateCredit.mutate({
                          creditSaleId: selected.credit_sale!.id,
                          payload: { status: "paid" },
                        })
                      }>
                      {updateCredit.isPending ?
                        <Loader2 className="w-4 h-4 animate-spin" />
                      : "Mark Credit as Paid"}
                    </Button>
                  )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={saleOpen}
        onOpenChange={(open) => {
          setSaleOpen(open);
          if (!open) resetSaleForm();
        }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSale} className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transaction type">
              {(["sale", "purchase"] as TransactionType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={txType === type}
                  variant={txType === type ? "default" : "outline"}
                  onClick={() => {
                    setTxType(type);
                    setCart([]);
                  }}>
                  {type === "sale" ? "Sale" : "Purchase (stock in)"}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
              {(["cash", "qr", "credit"] as PaymentType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={paymentType === type}
                  variant={paymentType === type ? "secondary" : "outline"}
                  className={paymentType === type ? "ring-2 ring-brand/40" : ""}
                  onClick={() => setPaymentType(type)}>
                  {paymentLabel(type)}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-customer">
                Customer{" "}
                {paymentType === "credit" ? "(required)" : "(optional)"}
              </Label>
              <select
                id="tx-customer"
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={customerId}
                required={paymentType === "credit"}
                onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Walk-in customer</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>

            {creditCustomer && (
              <p className="text-xs text-muted-foreground -mt-2">
                Owes {formatCurrency(creditCustomer.current_outstanding_balance)} of{" "}
                {formatCurrency(creditCustomer.credit_limit)} limit ·{" "}
                <span className={availableCredit ? "text-success font-medium" : "text-danger font-medium"}>
                  {formatCurrency(availableCredit ?? 0)} available
                </span>
              </p>
            )}

            {paymentType === "credit" && (
              <div className="space-y-2">
                <Label htmlFor="tx-due">Due date</Label>
                <Input
                  id="tx-due"
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tx-product">Add product</Label>
              <div className="flex gap-2">
                <select
                  id="tx-product"
                  className="flex-1 min-w-0 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={productPick}
                  onChange={(e) => setProductPick(e.target.value)}>
                  <option value="">Select product...</option>
                  {(products ?? [])
                    .filter((p) => txType === "purchase" || p.stock_quantity > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} ({p.stock_quantity} {p.unit}) ·{" "}
                        {formatCurrency(txType === "sale" ? p.selling_price : p.cost_price)}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addProductToCart}>
                  Add
                </Button>
              </div>
            </div>

            {cart.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3">
                {cart.map((line) => (
                  <div
                    key={line.product_id}
                    className="flex items-center gap-2 text-sm">
                    <span className="flex-1 font-medium text-slate-800">
                      {line.name}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      max={txType === "sale" ? stockOf(line.product_id) : undefined}
                      aria-label={`Quantity of ${line.name}`}
                      aria-invalid={txType === "sale" && line.quantity > stockOf(line.product_id)}
                      className="w-16 h-8"
                      value={line.quantity}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((l) =>
                            l.product_id === line.product_id ?
                              { ...l, quantity: Number(e.target.value) || 1 }
                            : l,
                          ),
                        )
                      }
                    />
                    <span className="w-20 text-right font-semibold">
                      {formatCurrency(line.price * line.quantity)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${line.name}`}
                      className="text-red-500 h-8 w-8 p-0"
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((l) => l.product_id !== line.product_id),
                        )
                      }>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tx-discount">Discount</Label>
                <Input
                  id="tx-discount"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Total</p>
                <div className="h-10 flex items-center font-bold text-red-600 text-lg">
                  {formatCurrency(Math.max(0, cartTotal))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-notes">Notes</Label>
              <Input id="tx-notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {cartError && <p className="text-sm text-danger" role="alert">{cartError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaleOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTx.isPending || cart.length === 0 || !!cartError}>
                {createTx.isPending && <Loader2 className="animate-spin" />}
                {txType === "sale" ? "Record sale" : "Record purchase"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
