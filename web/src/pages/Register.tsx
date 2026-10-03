import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AuthShell } from '@/layouts/AuthShell';
import { useRegisterMutation } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';

// Mirrors backend UserRegisterRequest (phone optional). Password length is a client-side floor.
const registerSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
  email: z.email('Enter a valid email address'),
  phone: z.string().trim().optional(),
  password: z.string().min(6, 'At least 6 characters'),
});
type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const registerUser = useRegisterMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((d) => registerUser.mutate({ ...d, phone: d.phone || undefined }));

  return (
    <AuthShell title="Create your account" subtitle="Get your shop set up in a couple of minutes.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" autoComplete="name" className="h-11" aria-invalid={!!errors.full_name} {...register('full_name')} />
          {errors.full_name && <p className="text-xs text-danger">{errors.full_name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" className="h-11" aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">
            Phone <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="98XXXXXXXX" className="h-11" {...register('phone')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
        </div>

        <Button type="submit" size="lg" className="w-full mt-1" disabled={registerUser.isPending}>
          {registerUser.isPending && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="text-brand font-semibold hover:underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
