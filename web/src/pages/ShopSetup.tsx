import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Loader2, Store, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateShop } from '@/hooks/useShops';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';

// Mirrors backend ShopCreateRequest
const shopSchema = z.object({
  shop_name: z.string().trim().min(1, 'Shop name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  location_type: z.enum(['urban', 'semi_urban', 'rural'], { message: 'Pick a location type' }),
});
type ShopFormValues = z.infer<typeof shopSchema>;

const LOCATIONS = [
  ['urban', 'Urban'],
  ['semi_urban', 'Semi-urban'],
  ['rural', 'Rural'],
] as const;

export default function ShopSetup() {
  const navigate = useNavigate();
  const createShop = useCreateShop();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
    defaultValues: { shop_name: '', address: '', location_type: 'urban' },
  });
  const selected = useWatch({ control, name: 'location_type' });

  const onSubmit = handleSubmit(async (data) => {
    await createShop.mutateAsync(data);
    navigate(ROUTES.DASHBOARD);
  });

  return (
    <div className="w-full min-h-full flex flex-col items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center gap-2">
          <div className="size-12 bg-brand-soft rounded-full flex items-center justify-center text-brand mb-2">
            <Store className="size-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Set up your shop</h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            Location type is used by the demand forecasting model, so pick the closest match.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shop profile</CardTitle>
            <CardDescription>Details of your kirana shop.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="shop_name" className="flex items-center gap-1.5">
                  <Store className="size-4 text-slate-400" /> Shop name
                </Label>
                <Input id="shop_name" aria-invalid={!!errors.shop_name} {...register('shop_name')} />
                {errors.shop_name && <p className="text-xs text-danger">{errors.shop_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-slate-400" /> Address
                </Label>
                <Input id="address" placeholder="e.g. Baneshwor, Kathmandu" aria-invalid={!!errors.address} {...register('address')} />
                {errors.address && <p className="text-xs text-danger">{errors.address.message}</p>}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <Navigation className="size-4 text-slate-400" /> Location type
                </legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {LOCATIONS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected === value}
                      onClick={() => setValue('location_type', value, { shouldValidate: true })}
                      className={cn(
                        'py-2.5 px-3 text-sm font-medium border rounded-lg transition-colors',
                        selected === value
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-border text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {errors.location_type && <p className="text-xs text-danger">{errors.location_type.message}</p>}
              </fieldset>

              <Button type="submit" size="lg" className="w-full mt-2" disabled={createShop.isPending}>
                {createShop.isPending && <Loader2 className="animate-spin" />}
                Create shop
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
