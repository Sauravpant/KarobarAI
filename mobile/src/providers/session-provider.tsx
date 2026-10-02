import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setAuthToken, setUnauthorizedHandler } from '@/api/client';
import { authApi } from '@/api/endpoints';
import type { RegisterPayload, Shop, User } from '@/types/api';

const TOKEN_KEY = 'karobar.token';
const USER_KEY = 'karobar.user';
const SHOP_KEY = 'karobar.shop';

interface SessionState {
  isLoading: boolean;
  token: string | null;
  user: User | null;
  activeShop: Shop | null;
}

interface SessionContextValue extends SessionState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  selectShop: (shop: Shop) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await SecureStore.deleteItemAsync(key);
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({
    isLoading: true,
    token: null,
    user: null,
    activeShop: null,
  });

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setState({ isLoading: false, token: null, user: null, activeShop: null });
    queryClient.clear();
    await Promise.all([TOKEN_KEY, USER_KEY, SHOP_KEY].map((k) => SecureStore.deleteItemAsync(k)));
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user, activeShop] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        readJson<User>(USER_KEY),
        readJson<Shop>(SHOP_KEY),
      ]);
      if (cancelled) return;
      setAuthToken(token);
      setState({ isLoading: false, token, user, activeShop });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user, token } = await authApi.login(email, password);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token.access_token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    setAuthToken(token.access_token);
    setState({ isLoading: false, token: token.access_token, user, activeShop: null });
  }, []);

  // Backend /auth/register returns no token, so sign in with the same credentials right after.
  const signUp = useCallback(
    async (payload: RegisterPayload) => {
      await authApi.register(payload);
      try {
        await signIn(payload.email, payload.password);
      } catch {
        // Retrying register would now 409, so point the user at login instead.
        throw new Error('Account created, but automatic sign-in failed. Please sign in.');
      }
    },
    [signIn],
  );

  const selectShop = useCallback(async (shop: Shop) => {
    await SecureStore.setItemAsync(SHOP_KEY, JSON.stringify(shop));
    setState((prev) => ({ ...prev, activeShop: shop }));
  }, []);

  const value = useMemo(
    () => ({ ...state, signIn, signUp, signOut, selectShop }),
    [state, signIn, signUp, signOut, selectShop],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

/** For screens rendered behind the shop guard. */
export function useActiveShop(): Shop {
  const { activeShop } = useSession();
  if (!activeShop) throw new Error('useActiveShop called without an active shop');
  return activeShop;
}
