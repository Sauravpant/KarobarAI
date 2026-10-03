import { cn } from '@/lib/utils';
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  /** Percent change; omit when there is no comparison value. */
  trend?: number;
  trendLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon: Icon,
  iconColor = 'text-slate-500',
  iconBg = 'bg-slate-100',
  className,
}: StatCardProps) {
  const up = trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-border p-5 shadow-sm transition-shadow hover:shadow-md min-w-0',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
          <Icon className={cn('size-4.5', iconColor)} aria-hidden />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight tabular truncate" title={value}>
        {value}
      </p>
      {(trend !== undefined || subtitle) && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {trend !== undefined && (
            <span
              className={cn(
                'text-xs font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full tabular',
                up ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              )}
            >
              {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
              <span className="sr-only">{up ? 'Up' : 'Down'}</span>
              {Math.abs(trend).toFixed(0)}%{trendLabel && <span className="font-medium opacity-80"> {trendLabel}</span>}
            </span>
          )}
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
