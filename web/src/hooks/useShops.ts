import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getShops, createShop, updateShop, deleteShop } from '@/services/shop.service';
import { qk, STALE } from '@/lib/queryKeys';
import { useAuth } from '@/providers/AuthProvider';
import type { CreateShopPayload, UpdateShopPayload } from '@/types';

export function useShops() {
  const { token } = useAuth();
  return useQuery({
    queryKey: qk.shops,
    queryFn: getShops,
    enabled: !!token,
    staleTime: STALE.slow,
  });
}

export function useCreateShop() {
  const qc = useQueryClient();
  const { setActiveShop } = useAuth();
  return useMutation({
    mutationFn: (payload: CreateShopPayload) => createShop(payload),
    meta: { errorMessage: 'Failed to create shop' },
    onSuccess: async (shop) => {
      setActiveShop(shop);
      await qc.invalidateQueries({ queryKey: qk.shops, exact: true });
      toast.success('Shop created');
    },
  });
}

export function useUpdateShop(shopId: string) {
  const qc = useQueryClient();
  const { setActiveShop, activeShop } = useAuth();
  return useMutation({
    mutationFn: (payload: UpdateShopPayload) => updateShop(shopId, payload),
    meta: { errorMessage: 'Failed to update shop' },
    onSuccess: async (updated) => {
      if (activeShop?.id === updated.id) setActiveShop(updated);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.shops, exact: true }),
        // location_type feeds the demand model; refresh everything for this shop
        qc.invalidateQueries({ queryKey: qk.shop(shopId) }),
      ]);
      toast.success('Shop updated');
    },
  });
}

export function useDeleteShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: string) => deleteShop(shopId),
    meta: { errorMessage: 'Failed to delete shop' },
    onSuccess: async (_data, shopId) => {
      qc.removeQueries({ queryKey: qk.shop(shopId) });
      await qc.invalidateQueries({ queryKey: qk.shops, exact: true });
      toast.success('Shop deleted');
    },
  });
}
