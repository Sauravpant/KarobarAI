import { Badge } from '@/components/ui/badge';
import type { CreditStatus, PaymentType, Product } from '@/types';

export type StockStatus = 'in' | 'low' | 'out';

export function stockStatus(p: Pick<Product, 'stock_quantity' | 'reorder_level'>): StockStatus {
  if (p.stock_quantity <= 0) return 'out';
  if (p.stock_quantity <= p.reorder_level) return 'low';
  return 'in';
}

export function StockBadge({ product }: { product: Pick<Product, 'stock_quantity' | 'reorder_level'> }) {
  const s = stockStatus(product);
  if (s === 'out') return <Badge variant="destructive">Out of stock</Badge>;
  if (s === 'low') return <Badge variant="warning">Low stock</Badge>;
  return <Badge variant="success">In stock</Badge>;
}

/** Credit sale status; a transaction without a credit sale is simply completed. */
export function CreditStatusBadge({ status }: { status: CreditStatus | 'completed' }) {
  if (status === 'overdue') return <Badge variant="destructive">Overdue</Badge>;
  if (status === 'unpaid') return <Badge variant="warning">Unpaid</Badge>;
  return <Badge variant="success">{status === 'paid' ? 'Paid' : 'Completed'}</Badge>;
}

const PAYMENT_LABEL: Record<PaymentType, string> = { cash: 'Cash', qr: 'QR', credit: 'Credit' };

export function PaymentBadge({ type }: { type: PaymentType }) {
  return <Badge variant={type === 'credit' ? 'warning' : 'secondary'}>{PAYMENT_LABEL[type]}</Badge>;
}

/** Model output: is_risk from the credit model, with the probability as context. */
export function RiskBadge({ isRisk, probability }: { isRisk: boolean; probability?: number }) {
  const pct = probability === undefined ? '' : ` · ${(probability * 100).toFixed(0)}%`;
  return isRisk ? (
    <Badge variant="destructive">High risk{pct}</Badge>
  ) : (
    <Badge variant="success">Low risk{pct}</Badge>
  );
}
