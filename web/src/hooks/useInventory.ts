import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getProducts,
  getLowStockProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
} from '@/services/inventory.service';
import { qk, STALE } from '@/lib/queryKeys';
import type { CreateProductPayload, Product, UpdateProductPayload, StockAdjustPayload } from '@/types';

export function useProducts(shopId: string) {
  return useQuery({
    queryKey: qk.productList(shopId),
    queryFn: () => getProducts(shopId),
    enabled: !!shopId,
    staleTime: STALE.live,
  });
}

export function useLowStockProducts(shopId: string) {
  return useQuery({
    queryKey: qk.lowStock(shopId),
    queryFn: () => getLowStockProducts(shopId),
    enabled: !!shopId,
    staleTime: STALE.live,
    refetchOnWindowFocus: true,
  });
}

/** Everything a product or stock change can affect. */
function useInvalidateProducts(shopId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.products(shopId) }),
      qc.invalidateQueries({ queryKey: qk.dashboard(shopId) }),
      qc.invalidateQueries({ queryKey: qk.demandForecast(shopId) }),
    ]);
}

export function useCreateProduct(shopId: string) {
  const invalidate = useInvalidateProducts(shopId);
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => createProduct(shopId, payload),
    meta: { errorMessage: 'Failed to create product' },
    onSuccess: async () => {
      await invalidate();
      toast.success('Product created');
    },
  });
}

export function useUpdateProduct(shopId: string) {
  const invalidate = useInvalidateProducts(shopId);
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: UpdateProductPayload }) =>
      updateProduct(shopId, productId, payload),
    meta: { errorMessage: 'Failed to update product' },
    onSuccess: async () => {
      await invalidate();
      toast.success('Product updated');
    },
  });
}

export function useDeleteProduct(shopId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateProducts(shopId);
  return useMutation({
    mutationFn: (productId: string) => deleteProduct(shopId, productId),
    meta: { errorMessage: 'Failed to deactivate product' },
    // Optimistic: drop it from the list right away, roll back on error
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: qk.productList(shopId) });
      const previous = qc.getQueryData<Product[]>(qk.productList(shopId));
      qc.setQueryData<Product[]>(qk.productList(shopId), (old) =>
        old?.filter((p) => p.id !== productId)
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.productList(shopId), ctx.previous);
    },
    onSuccess: () => {
      toast.success('Product deactivated');
    },
    onSettled: () => invalidate(),
  });
}

function useStockAdjust(shopId: string, direction: 'in' | 'out') {
  const qc = useQueryClient();
  const invalidate = useInvalidateProducts(shopId);
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: StockAdjustPayload }) =>
      direction === 'in' ? stockIn(shopId, productId, payload) : stockOut(shopId, productId, payload),
    meta: { errorMessage: direction === 'in' ? 'Failed to add stock' : 'Failed to remove stock' },
    onMutate: async ({ productId, payload }) => {
      await qc.cancelQueries({ queryKey: qk.productList(shopId) });
      const previous = qc.getQueryData<Product[]>(qk.productList(shopId));
      const delta = direction === 'in' ? payload.quantity : -payload.quantity;
      qc.setQueryData<Product[]>(qk.productList(shopId), (old) =>
        old?.map((p) => (p.id === productId ? { ...p, stock_quantity: p.stock_quantity + delta } : p))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.productList(shopId), ctx.previous);
    },
    onSuccess: (updated) => {
      toast.success(`Stock ${direction === 'in' ? 'added' : 'removed'}. New total: ${updated.stock_quantity}`);
    },
    onSettled: () => invalidate(),
  });
}

export const useStockIn = (shopId: string) => useStockAdjust(shopId, 'in');
export const useStockOut = (shopId: string) => useStockAdjust(shopId, 'out');
