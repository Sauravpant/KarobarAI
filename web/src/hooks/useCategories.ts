import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/category.service';
import { qk, STALE } from '@/lib/queryKeys';
import type { Category, CreateCategoryPayload, UpdateCategoryPayload } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: getCategories,
    staleTime: STALE.slow,
  });
}

// Categories are global on the backend, so refresh product lists and dashboards of every shop
const productOrDashboard = (q: Query) =>
  q.queryKey[0] === 'shops' && (q.queryKey[2] === 'products' || q.queryKey[2] === 'dashboard');

function useInvalidateCategories() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.categories }),
      qc.invalidateQueries({ predicate: productOrDashboard }),
    ]);
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => createCategory(payload),
    meta: { errorMessage: 'Failed to create category' },
    onSuccess: async () => {
      await invalidate();
      toast.success('Category created');
    },
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: string; payload: UpdateCategoryPayload }) =>
      updateCategory(categoryId, payload),
    meta: { errorMessage: 'Failed to update category' },
    onSuccess: async () => {
      await invalidate();
      toast.success('Category updated');
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (categoryId: string) => deleteCategory(categoryId),
    meta: { errorMessage: 'Failed to delete category' },
    onMutate: async (categoryId) => {
      await qc.cancelQueries({ queryKey: qk.categories });
      const previous = qc.getQueryData<Category[]>(qk.categories);
      qc.setQueryData<Category[]>(qk.categories, (old) => old?.filter((c) => c.id !== categoryId));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.categories, ctx.previous);
    },
    onSuccess: () => {
      toast.success('Category deleted');
    },
    onSettled: () => invalidate(),
  });
}
