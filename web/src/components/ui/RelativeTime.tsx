import { formatDateTime, formatRelative } from '@/utils/format';

/** "3 hours ago", with the exact date and time on hover. */
export function RelativeTime({ value, className }: { value: string; className?: string }) {
  return (
    <time dateTime={value} title={formatDateTime(value)} className={className}>
      {formatRelative(value)}
    </time>
  );
}
