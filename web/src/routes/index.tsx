import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { Pages } from '@/routes/pages';

const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: page(<Pages.MainLayout />),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: page(<Pages.Dashboard />) },
      { path: 'inventory', element: page(<Pages.Inventory />) },
      { path: 'categories', element: page(<Pages.Categories />) },
      { path: 'credit-risk', element: page(<Pages.CreditRisk />) },
      { path: 'customers', element: page(<Pages.Customers />) },
      { path: 'transactions', element: page(<Pages.Transactions />) },
      { path: 'demand-forecasting', element: page(<Pages.DemandForecast />) },
      { path: 'reports', element: page(<Pages.Reports />) },
      { path: 'notifications', element: page(<Pages.Notifications />) },
      { path: 'settings', element: page(<Pages.Settings />) },
      { path: 'shop-setup', element: page(<Pages.ShopSetup />) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: 'login', element: page(<Pages.Login />) },
      { path: 'register', element: page(<Pages.Register />) },
    ],
  },
  {
    path: '*',
    element: (
      <div className="flex flex-col items-center justify-center min-h-screen text-center bg-background">
        <p className="text-8xl font-black text-slate-200 mb-4">404</p>
        <p className="text-slate-500 font-medium text-lg">Page not found</p>
        <a href="/" className="mt-6 text-brand font-medium hover:underline">
          Return home
        </a>
      </div>
    ),
  },
]);
