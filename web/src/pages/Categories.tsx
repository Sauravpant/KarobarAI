import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, Tags } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useInventory';
import { useShopId } from '@/providers/AuthProvider';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState, EmptyState } from '@/components/ui/StateComponents';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Category } from '@/types';

// Mirrors backend CategoryCreateRequest
const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
});
type CategoryForm = z.infer<typeof categorySchema>;

export default function Categories() {
  const shopId = useShopId();
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const { data: products } = useProducts(shopId);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    values: editing ? { name: editing.name, description: editing.description ?? '' } : { name: '', description: '' },
  });
  const pending = createCategory.isPending || updateCategory.isPending;

  // Products in this shop per category (categories themselves are global)
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products ?? []) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    return m;
  }, [products]);

  const openDialog = (c: Category | null) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const onSubmit = form.handleSubmit(async ({ name, description }) => {
    const payload = { name, description: description || undefined };
    if (editing) await updateCategory.mutateAsync({ categoryId: editing.id, payload });
    else await createCategory.mutateAsync(payload);
    setDialogOpen(false);
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="Could not load categories." onRetry={refetch} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Product categories used across your inventory."
        icon={Tags}
        actions={
          <Button onClick={() => openDialog(null)}>
            <Plus /> Add category
          </Button>
        }
      />

      {!categories?.length ? (
        <EmptyState
          title="No categories yet"
          description="Create categories before adding products."
          action={
            <Button size="sm" onClick={() => openDialog(null)}>
              <Plus /> Add category
            </Button>
          }
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Description</th>
                <th className="text-right px-5 py-3">Products</th>
                <th className="px-5 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-800">{c.name}</td>
                  <td className="px-5 py-3 text-slate-500 max-w-md truncate hidden sm:table-cell" title={c.description ?? undefined}>
                    {c.description || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular text-slate-600">{counts.get(c.id) ?? 0}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => openDialog(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-danger hover:bg-danger-soft hover:text-danger"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit category' : 'Add category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-danger">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Input id="cat-desc" placeholder="Optional" {...form.register('description')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        description={
          deleting && counts.get(deleting.id)
            ? `${counts.get(deleting.id)} product(s) in this shop use this category. The backend may refuse the delete.`
            : 'This category will be removed.'
        }
        pending={deleteCategory.isPending}
        onConfirm={() => {
          if (deleting) deleteCategory.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
