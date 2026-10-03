import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Store, AlertTriangle, Save, LogOut, Loader2, Trash2, Settings as SettingsIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/providers/AuthProvider';
import { useUpdateShop, useDeleteShop, useShops } from '@/hooks/useShops';
import { useLogout } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Mirrors backend ShopUpdateRequest
const shopSchema = z.object({
  shop_name: z.string().trim().min(1, 'Shop name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  location_type: z.enum(['urban', 'semi_urban', 'rural']),
});
type ShopForm = z.infer<typeof shopSchema>;

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-start py-4 border-b border-slate-100 last:border-0">
      <div className="pt-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}

function Section({ title, description, icon: Icon, children }: { title: string; description: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="size-9 rounded-lg bg-brand-soft flex items-center justify-center">
          <Icon className="size-4 text-brand" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="px-5 py-1">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { user, activeShop, setActiveShop } = useAuth();
  const navigate = useNavigate();
  const logout = useLogout();
  const updateShop = useUpdateShop(activeShop?.id ?? '');
  const deleteShop = useDeleteShop();
  const { data: shops } = useShops();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<ShopForm>({
    resolver: zodResolver(shopSchema),
    values: activeShop
      ? { shop_name: activeShop.shop_name, address: activeShop.address, location_type: activeShop.location_type }
      : undefined,
  });
  const { errors, isDirty } = form.formState;

  const onSave = form.handleSubmit((data) => updateShop.mutateAsync(data));

  const onDelete = async () => {
    if (!activeShop) return;
    await deleteShop.mutateAsync(activeShop.id);
    setConfirmDelete(false);
    const next = (shops ?? []).find((s) => s.id !== activeShop.id) ?? null;
    setActiveShop(next);
    navigate(next ? ROUTES.DASHBOARD : ROUTES.SHOP_SETUP);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Your account and shop details." icon={SettingsIcon} />

      <Section title="Account" description="From your login. Editing isn't supported by the API." icon={User}>
        <Row label="Name">
          <Input value={user?.full_name ?? ''} disabled readOnly />
        </Row>
        <Row label="Email">
          <Input value={user?.email ?? ''} disabled readOnly />
        </Row>
        <Row label="Phone">
          <Input value={user?.phone ?? ''} placeholder="Not set" disabled readOnly />
        </Row>
      </Section>

      <Section title="Shop profile" description="Shown across the app and used by the demand model." icon={Store}>
        <form onSubmit={onSave} noValidate>
          <Row label="Shop name" htmlFor="s-name">
            <Input id="s-name" aria-invalid={!!errors.shop_name} {...form.register('shop_name')} />
            {errors.shop_name && <p className="text-xs text-danger mt-1">{errors.shop_name.message}</p>}
          </Row>
          <Row label="Address" htmlFor="s-address">
            <Input id="s-address" aria-invalid={!!errors.address} {...form.register('address')} />
            {errors.address && <p className="text-xs text-danger mt-1">{errors.address.message}</p>}
          </Row>
          <Row label="Location type" htmlFor="s-loc" hint="Affects demand forecasts.">
            <select
              id="s-loc"
              className="w-full border border-input bg-white rounded-lg h-9 px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
              {...form.register('location_type')}
            >
              <option value="urban">Urban</option>
              <option value="semi_urban">Semi-urban</option>
              <option value="rural">Rural</option>
            </select>
          </Row>
          <div className="flex justify-end py-4">
            <Button type="submit" disabled={updateShop.isPending || !activeShop || !isDirty}>
              {updateShop.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </div>
        </form>
      </Section>

      <section className="bg-surface rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-red-100 flex items-center gap-3 bg-danger-soft">
          <AlertTriangle className="size-5 text-danger" />
          <div>
            <h2 className="text-sm font-bold text-red-700">Session and shop</h2>
            <p className="text-xs text-red-600">Sign out, or permanently delete this shop.</p>
          </div>
        </div>
        <div className="px-5 divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Sign out</p>
              <p className="text-xs text-muted-foreground">Ends your session on this device.</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut /> Sign out
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-semibold text-danger">Delete shop</p>
              <p className="text-xs text-muted-foreground">Permanently deletes {activeShop?.shop_name ?? 'this shop'}.</p>
            </div>
            <Button variant="destructive" size="sm" disabled={!activeShop} onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete shop
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${activeShop?.shop_name ?? 'shop'}?`}
        description="This permanently deletes the shop. It can't be undone."
        confirmLabel="Delete shop"
        pending={deleteShop.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
}
