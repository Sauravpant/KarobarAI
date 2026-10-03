import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Category, CreateProductPayload, Product } from '@/types';

const money = z.coerce.number<number>().min(0, 'Cannot be negative');
const count = z.coerce.number<number>().int('Whole numbers only').min(0, 'Cannot be negative');

// Mirrors backend ProductCreateRequest; stock_quantity is only settable on create
const productSchema = z.object({
  product_name: z.string().trim().min(1, 'Name is required'),
  category_id: z.string().min(1, 'Pick a category'),
  sku: z.string().trim().min(1, 'SKU is required'),
  barcode: z.string().trim().optional(),
  unit: z.string().trim().min(1, 'Unit is required'),
  stock_quantity: count,
  cost_price: money,
  selling_price: money,
  reorder_level: count,
  is_staple: z.boolean(),
  is_perishable: z.boolean(),
});
export type ProductForm = z.infer<typeof productSchema>;

const blank: ProductForm = {
  product_name: '',
  category_id: '',
  sku: '',
  barcode: '',
  unit: 'pcs',
  stock_quantity: 0,
  cost_price: 0,
  selling_price: 0,
  reorder_level: 10,
  is_staple: false,
  is_perishable: false,
};

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = create */
  product: Product | null;
  categories: Category[];
  pending: boolean;
  onSubmit: (payload: CreateProductPayload) => Promise<unknown>;
}) {
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    values: product
      ? {
          product_name: product.product_name,
          category_id: product.category_id,
          sku: product.sku,
          barcode: product.barcode ?? '',
          unit: product.unit,
          stock_quantity: product.stock_quantity,
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          reorder_level: product.reorder_level,
          is_staple: product.is_staple,
          is_perishable: product.is_perishable,
        }
      : blank,
  });
  const e = form.formState.errors;
  const reg = form.register;

  const submit = form.handleSubmit(async (v) => {
    await onSubmit({ ...v, barcode: v.barcode || undefined });
    onOpenChange(false);
    form.reset(blank);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Stock is changed with Stock in / Stock out, not here.' : 'Opening stock can be 0 and added later.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</legend>
            <Field id="p-name" label="Product name" error={e.product_name?.message}>
              <Input id="p-name" aria-invalid={!!e.product_name} {...reg('product_name')} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="p-cat" label="Category" error={e.category_id?.message}>
                <select
                  id="p-cat"
                  aria-invalid={!!e.category_id}
                  className="w-full h-9 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  {...reg('category_id')}
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="p-unit" label="Unit" error={e.unit?.message} hint="e.g. pcs, kg, litre">
                <Input id="p-unit" aria-invalid={!!e.unit} {...reg('unit')} />
              </Field>
              <Field id="p-sku" label="SKU" error={e.sku?.message}>
                <Input id="p-sku" aria-invalid={!!e.sku} {...reg('sku')} />
              </Field>
              <Field id="p-barcode" label="Barcode">
                <Input id="p-barcode" placeholder="Optional" {...reg('barcode')} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pricing and stock</legend>
            <div className="grid grid-cols-2 gap-4">
              <Field id="p-cost" label="Cost price (Rs.)" error={e.cost_price?.message}>
                <Input id="p-cost" type="number" min={0} step="any" inputMode="decimal" aria-invalid={!!e.cost_price} {...reg('cost_price')} />
              </Field>
              <Field id="p-price" label="Selling price (Rs.)" error={e.selling_price?.message}>
                <Input id="p-price" type="number" min={0} step="any" inputMode="decimal" aria-invalid={!!e.selling_price} {...reg('selling_price')} />
              </Field>
              {!product && (
                <Field id="p-stock" label="Opening stock" error={e.stock_quantity?.message}>
                  <Input id="p-stock" type="number" min={0} step={1} inputMode="numeric" aria-invalid={!!e.stock_quantity} {...reg('stock_quantity')} />
                </Field>
              )}
              <Field id="p-reorder" label="Reorder level" error={e.reorder_level?.message} hint="Flagged low at or below this">
                <Input id="p-reorder" type="number" min={0} step={1} inputMode="numeric" aria-invalid={!!e.reorder_level} {...reg('reorder_level')} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-brand" {...reg('is_staple')} /> Staple item
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-brand" {...reg('is_perishable')} /> Perishable
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Staple and perishable flags feed the demand forecast.</p>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {product ? 'Save changes' : 'Add product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
