import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login, register, getMe, logout as logoutApi } from '@/services/auth.service';
import { getShops } from '@/services/shop.service';
import { useAuth } from '@/providers/AuthProvider';
import { qk, STALE } from '@/lib/queryKeys';
import type { LoginPayload, RegisterPayload } from '@/types';
import { ROUTES } from '@/constants/routes';

export function useLoginMutation() {
  const { login: storeLogin, setActiveShop } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    meta: { errorMessage: 'Invalid email or password' },
    onSuccess: async (data) => {
      storeLogin(data.token.access_token, data.user);
      toast.success('Welcome back!');
      const shops = await getShops().catch(() => []);
      if (shops.length > 0) {
        setActiveShop(shops[0]);
        navigate(ROUTES.DASHBOARD);
      } else {
        navigate(ROUTES.SHOP_SETUP);
      }
    },
  });
}

export function useRegisterMutation() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    meta: { errorMessage: 'Registration failed. The email may already be in use.' },
    onSuccess: () => {
      toast.success('Account created. Please sign in.');
      navigate(ROUTES.LOGIN);
    },
  });
}

export function useMe() {
  const { token } = useAuth();
  return useQuery({
    queryKey: qk.me,
    queryFn: getMe,
    enabled: !!token,
    staleTime: STALE.slow,
  });
}

export function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return async () => {
    // Backend logout is stateless (JWT); clear locally even if the call fails
    await logoutApi().catch(() => undefined);
    logout();
    navigate(ROUTES.LOGIN);
  };
}
