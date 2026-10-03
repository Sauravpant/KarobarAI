import { isoDateFromToday } from '@/lib/format';
import type {
  ExtractResult,
  MatchedItem,
  MatchedTransaction,
  PaymentType,
  VoiceAction,
  VoiceConfirmRequest,
} from '@/types/api';

/** Editable, client-side view of one extracted transaction. */
export interface DraftItem {
  key: string;
  productId: string | null;
  productName: string;
  spokenProduct: string;
  unit: string | null;
  stock: number | null;
  quantity: number;
  included: boolean;
}

export interface DraftTransaction {
  key: string;
  action: VoiceAction;
  items: DraftItem[];
  paymentType: PaymentType;
  customerId: string | null;
  spokenCustomer: string | null;
  dueInDays: number | null;
}

export const DUE_PRESETS = [7, 15, 30] as const;

const PAYMENT_TYPES: readonly PaymentType[] = ['cash', 'credit', 'qr'];

function toDraftItem(item: MatchedItem, key: string): DraftItem {
  return {
    key,
    productId: item.product_id,
    productName: item.product_name,
    spokenProduct: item.spoken_product,
    unit: item.unit,
    stock: item.stock_quantity,
    // Backend confirm requires a positive integer quantity.
    quantity: Math.max(1, Math.round(item.quantity)),
    included: item.product_id !== null,
  };
}

function toDraftTx(tx: MatchedTransaction, index: number): DraftTransaction {
  const payment = PAYMENT_TYPES.includes(tx.payment_type as PaymentType) ? (tx.payment_type as PaymentType) : 'cash';
  return {
    key: `tx-${index}`,
    action: tx.action,
    items: tx.items.map((item, i) => toDraftItem(item, `tx-${index}-${i}`)),
    paymentType: tx.action === 'sale' ? payment : 'cash',
    customerId: tx.customer_id,
    spokenCustomer: tx.customer_name,
    dueInDays: payment === 'credit' ? DUE_PRESETS[0] : null,
  };
}

/**
 * Prefer the model's per-transaction grouping. When it only returned a flat item list,
 * group the same way the backend does: all sales in one transaction, one per purchase.
 */
export function buildDrafts(result: ExtractResult): DraftTransaction[] {
  if (result.matched_transactions.length) return result.matched_transactions.map(toDraftTx);

  const sales = result.matched_items.filter((i) => i.action === 'sale');
  const purchases = result.matched_items.filter((i) => i.action === 'purchase');
  const grouped: MatchedTransaction[] = [
    ...(sales.length ? [{ action: 'sale' as const, items: sales }] : []),
    ...purchases.map((p) => ({ action: 'purchase' as const, items: [p] })),
  ].map((g) => ({ ...g, customer_name: null, customer_id: null, payment_type: 'cash', due_date: null, notes: null }));
  return grouped.map(toDraftTx);
}

/** Returns a user-facing problem with the draft, or null when it can be submitted. */
export function validateTransaction(tx: DraftTransaction): string | null {
  const active = tx.items.filter((i) => i.included);
  if (!active.length) return null; // skipped entirely
  if (tx.action === 'sale' && tx.paymentType === 'credit') {
    if (!tx.customerId) return 'Select a customer for this credit sale.';
    if (!tx.dueInDays) return 'Select a due date for this credit sale.';
  }
  return null;
}

export function buildConfirmPayload(drafts: DraftTransaction[]): VoiceConfirmRequest {
  const transactions = drafts
    .map((tx) => {
      const items = tx.items
        .filter((i): i is DraftItem & { productId: string } => i.included && i.productId !== null)
        .map((i) => ({ action: tx.action, product_id: i.productId, quantity: i.quantity, product_name: i.productName }));
      const credit = tx.action === 'sale' && tx.paymentType === 'credit';
      return {
        action: tx.action,
        items,
        payment_type: tx.action === 'sale' ? tx.paymentType : ('cash' as const),
        customer_id: credit ? tx.customerId : null,
        due_date: credit && tx.dueInDays ? isoDateFromToday(tx.dueInDays) : null,
      };
    })
    .filter((tx) => tx.items.length > 0);
  return { transactions };
}
