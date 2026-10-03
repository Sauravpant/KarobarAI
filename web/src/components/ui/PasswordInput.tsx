import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
