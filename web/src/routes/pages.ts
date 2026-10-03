import { lazy } from 'react';
import { ROUTES } from '@/constants/routes';

// One import() per page so routes can lazy-load and the nav can preload on hover
export const loaders = {
  [ROUTES.DASHBOARD]: () => import('@/pages/Dashboard'),
  [ROUTES.INVENTORY]: () => import('@/pages/Inventory'),
  [ROUTES.CATEGORIES]: () => import('@/pages/Categories'),
  [ROUTES.CREDIT_RISK]: () => import('@/pages/CreditRisk'),
  [ROUTES.CUSTOMERS]: () => import('@/pages/Customers'),
  [ROUTES.TRANSACTIONS]: () => import('@/pages/Transactions'),
  [ROUTES.DEMAND_FORECASTING]: () => import('@/pages/DemandForecast'),
  [ROUTES.REPORTS]: () => import('@/pages/Reports'),
  [ROUTES.NOTIFICATIONS]: () => import('@/pages/Notifications'),
  [ROUTES.SETTINGS]: () => import('@/pages/Settings'),
  [ROUTES.SHOP_SETUP]: () => import('@/pages/ShopSetup'),
  [ROUTES.LOGIN]: () => import('@/pages/Login'),
  [ROUTES.REGISTER]: () => import('@/pages/Register'),
} as const;

export const preload = (href: string) => loaders[href as keyof typeof loaders]?.();

export const Pages = {
  // Login/register don't need the app shell (sidebar, menus, sheets)
  MainLayout: lazy(() => import('@/layouts/MainLayout')),
  Dashboard: lazy(loaders[ROUTES.DASHBOARD]),
  Inventory: lazy(loaders[ROUTES.INVENTORY]),
  Categories: lazy(loaders[ROUTES.CATEGORIES]),
  CreditRisk: lazy(loaders[ROUTES.CREDIT_RISK]),
  Customers: lazy(loaders[ROUTES.CUSTOMERS]),
  Transactions: lazy(loaders[ROUTES.TRANSACTIONS]),
  DemandForecast: lazy(loaders[ROUTES.DEMAND_FORECASTING]),
  Reports: lazy(loaders[ROUTES.REPORTS]),
  Notifications: lazy(loaders[ROUTES.NOTIFICATIONS]),
  Settings: lazy(loaders[ROUTES.SETTINGS]),
  ShopSetup: lazy(loaders[ROUTES.SHOP_SETUP]),
  Login: lazy(loaders[ROUTES.LOGIN]),
  Register: lazy(loaders[ROUTES.REGISTER]),
};
