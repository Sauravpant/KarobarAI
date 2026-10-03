import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '@/services/customer.service';
import { qk, STALE } from '@/lib/queryKeys';
import type { CreateCustomerPayload, Customer, UpdateCustomerPayload } from '@/types';

export function useCustomers(shopId: string) {
  return useQuery({
    queryKey: qk.customerList(shopId),
    queryFn: () => getCustomers(shopId),
    enabled: !!shopId,
    staleTime: STALE.normal,
  });
}

function useInvalidateCustomers(shopId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.customers(shopId) }),
      qc.invalidateQueries({ queryKey: qk.creditRisk(shopId) }),
      qc.invalidateQueries({ queryKey: qk.dashboard(shopId) }),
    ]);
}

export function useCreateCustomer(shopId: string) {
  const invalidate = useInvalidateCustomers(shopId);
  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => createCustomer(shopId, payload),
    meta: { errorMessage: 'Failed to add customer' },
    onSuccess: async () => {
      await invalidate();
      toast.success('Customer added');
    },
  });
}

export function useUpdateCustomer(shopId: string) {
  const invalidate = useInvalidateCustomers(shopId);
  return useMutation({
    mutationFn: ({ customerId, payload }: { customerId: string; payload: UpdateCustomerPayload }) =>
      updateCustomer(shopId, customerId, payload),
    meta: { errorMessage: 'Failed to update customer' },
    onSuccess: async () => {
      await invalidate();
      toast.success('Customer updated');
    },
  });
}

export function useDeleteCustomer(shopId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateCustomers(shopId);
  return useMutation({
    mutationFn: (customerId: string) => deleteCustomer(shopId, customerId),
    meta: { errorMessage: 'Failed to deactivate customer' },
    onMutate: async (customerId) => {
      await qc.cancelQueries({ queryKey: qk.customerList(shopId) });
      const previous = qc.getQueryData<Customer[]>(qk.customerList(shopId));
      qc.setQueryData<Customer[]>(qk.customerList(shopId), (old) =>
        old?.filter((c) => c.id !== customerId)
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.customerList(shopId), ctx.previous);
    },
    onSuccess: () => {
      toast.success('Customer deactivated');
    },
    onSettled: () => invalidate(),
  });
}
