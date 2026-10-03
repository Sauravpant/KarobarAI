import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ApiUser, Shop } from '@/types';
import { storage } from '@/utils/storage';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: ApiUser | null;
  activeShop: Shop | null;
  login: (token: string, user: ApiUser) => void;
  logout: () => void;
  setActiveShop: (shop: Shop | null) => void;
  setUserProfile: (user: ApiUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<ApiUser | null>(() => storage.getUser<ApiUser>());
  const [activeShop, setActiveShopState] = useState<Shop | null>(() => storage.getShop<Shop>());

  const login = useCallback((newToken: string, newUser: ApiUser) => {
    storage.setToken(newToken);
    storage.setUser(newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const setUserProfile = useCallback((newUser: ApiUser) => {
    storage.setUser(newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    storage.clearSession();
    queryClient.clear();
    setToken(null);
    setUser(null);
    setActiveShopState(null);
  }, []);

  const setActiveShop = useCallback((shop: Shop | null) => {
    const prev = storage.getShop<Shop>();
    if (prev && prev.id !== shop?.id) {
      queryClient.removeQueries({ queryKey: ['shops', prev.id] });
    }
    storage.setShop(shop);
    setActiveShopState(shop);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        token,
        user,
        activeShop,
        login,
        logout,
        setActiveShop,
        setUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Active shop id, or '' before a shop is picked (hooks stay disabled on ''). */
// eslint-disable-next-line react-refresh/only-export-components
export const useShopId = () => useAuth().activeShop?.id ?? '';
