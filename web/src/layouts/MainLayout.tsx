import { useEffect, useState } from 'react';
import { Outlet, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Store,
  ChevronsUpDown,
  Plus,
  Tags,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { ROUTES, APP_NAME } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useMe, useLogout } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { useLowStockProducts } from '@/hooks/useInventory';
import { useCreditSales } from '@/hooks/useTransactions';
import { preload } from '@/routes/pages';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk, STALE } from '@/lib/queryKeys';
import { getDashboardData } from '@/services/dashboard.service';
import { getProducts } from '@/services/inventory.service';
import { getCustomers } from '@/services/customer.service';
import { getTransactionStats } from '@/services/transaction.service';
import { cn } from '@/lib/utils';

const NAV = [
  { title: 'Dashboard', icon: LayoutDashboard, href: ROUTES.DASHBOARD },
  { title: 'Transactions', icon: Receipt, href: ROUTES.TRANSACTIONS },
  { title: 'Inventory', icon: Package, href: ROUTES.INVENTORY },
  { title: 'Categories', icon: Tags, href: ROUTES.CATEGORIES },
  { title: 'Customers', icon: Users, href: ROUTES.CUSTOMERS },
  { title: 'Credit Risk', icon: ShieldAlert, href: ROUTES.CREDIT_RISK },
  { title: 'Demand Forecast', icon: TrendingUp, href: ROUTES.DEMAND_FORECASTING },
  { title: 'Reports', icon: BarChart3, href: ROUTES.REPORTS },
  { title: 'Alerts', icon: Bell, href: ROUTES.NOTIFICATIONS },
  { title: 'Settings', icon: Settings, href: ROUTES.SETTINGS },
];

function Logo() {
  return <img src="/karobar_ai_logo.png" alt={APP_NAME} className="h-10 w-auto" />;
}

/** Warm the page's main query on hover; skipped if cached data is still fresh. */
function prefetchData(qc: QueryClient, shopId: string, href: string) {
  if (!shopId) return;
  const opts = { staleTime: STALE.live };
  if (href === ROUTES.DASHBOARD) void qc.prefetchQuery({ queryKey: qk.dashboard(shopId), queryFn: () => getDashboardData(shopId), ...opts });
  if (href === ROUTES.INVENTORY || href === ROUTES.DEMAND_FORECASTING)
    void qc.prefetchQuery({ queryKey: qk.productList(shopId), queryFn: () => getProducts(shopId), ...opts });
  if (href === ROUTES.CUSTOMERS || href === ROUTES.CREDIT_RISK)
    void qc.prefetchQuery({ queryKey: qk.customerList(shopId), queryFn: () => getCustomers(shopId), staleTime: STALE.normal });
  if (href === ROUTES.TRANSACTIONS)
    void qc.prefetchQuery({ queryKey: qk.transactionStats(shopId), queryFn: () => getTransactionStats(shopId), ...opts });
}

function NavItems({ onNavigate, shopId }: { onNavigate?: () => void; shopId: string }) {
  const qc = useQueryClient();
  const warm = (href: string) => {
    preload(href);
    prefetchData(qc, shopId, href);
  };
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-0.5 scrollbar-hide" aria-label="Main">
      {NAV.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          onMouseEnter={() => warm(item.href)}
          onFocus={() => warm(item.href)}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors',
              isActive ? 'bg-brand-soft text-brand nav-active-indicator' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('size-4.5 shrink-0', isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600')} />
              <span className="truncate">{item.title}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function MainLayout() {
  const { isAuthenticated, activeShop, user, setActiveShop, setUserProfile } = useAuth();
  const location = useLocation();
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const shopId = activeShop?.id ?? '';

  // All hooks before any early return
  const { data: me } = useMe();
  const { data: shops } = useShops();
  const { data: lowStock } = useLowStockProducts(shopId);
  const { data: overdue } = useCreditSales(shopId, 'overdue');

  useEffect(() => {
    if (me) setUserProfile(me);
  }, [me, setUserProfile]);

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (!activeShop && location.pathname !== ROUTES.SHOP_SETUP) return <Navigate to={ROUTES.SHOP_SETUP} replace />;

  const initials =
    user?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';
  const alertCount = (lowStock?.length ?? 0) + (overdue?.length ?? 0);
  const currentPage = NAV.find((n) => location.pathname.startsWith(n.href))?.title;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:p-2 focus:bg-white focus:rounded">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-white flex-col shrink-0 border-r border-border">
        <div className="h-16 flex items-center px-5 shrink-0 border-b border-slate-100">
          <Logo />
        </div>
        <NavItems shopId={shopId} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0 flex flex-col">
          <SheetTitle className="h-16 flex items-center px-5 border-b border-slate-100">
            <Logo />
          </SheetTitle>
          <NavItems shopId={shopId} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </Button>
            {currentPage && <span className="font-semibold text-slate-700 truncate">{currentPage}</span>}
          </div>

          <div className="flex items-center gap-2">
            {activeShop && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 px-2.5 max-w-52">
                    <Store className="size-4 text-brand" />
                    <span className="truncate">{activeShop.shop_name}</span>
                    <ChevronsUpDown className="size-3.5 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[10px] tracking-widest text-slate-400 uppercase">Your shops</DropdownMenuLabel>
                  {shops?.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => setActiveShop(s)}
                      className={cn('justify-between', activeShop.id === s.id && 'text-brand font-semibold')}
                    >
                      <span className="truncate">{s.shop_name}</span>
                      {activeShop.id === s.id && <span className="size-1.5 bg-brand rounded-full shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={ROUTES.SHOP_SETUP} className="text-brand font-semibold">
                      <Plus className="size-4" /> Add shop
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to={ROUTES.NOTIFICATIONS} aria-label={`Alerts${alertCount ? ` (${alertCount})` : ''}`}>
                <Bell className="size-4.5" />
                {alertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40" aria-label="Account menu">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-linear-to-br from-brand-accent to-brand text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold truncate">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground font-normal truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={ROUTES.SETTINGS}>
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-danger focus:text-danger">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
