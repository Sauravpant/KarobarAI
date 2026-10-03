import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="inline-flex items-center justify-center size-8 rounded-lg bg-brand-soft text-brand shrink-0">
              <Icon className="size-4" />
            </span>
          )}
          <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
        </div>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
