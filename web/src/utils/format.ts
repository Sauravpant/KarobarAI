// en-IN gives lakh/crore grouping (1,00,000), which is what Nepali shopkeepers read
const npr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatCurrency(amount: number): string {
  return `Rs. ${npr.format(Math.round(amount))}`;
}

/** Short axis labels: 1.2K, 3.4L, 1.1Cr */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${(amount / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(amount / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
  return String(Math.round(amount));
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3 hours ago", "yesterday". Pair with title={formatDateTime(x)} for the exact time. */
export function formatRelative(value: string | Date): string {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** Percent change, or undefined when there's no baseline to compare against. */
export function pctChange(current: number, previous: number): number | undefined {
  return previous > 0 ? ((current - previous) / previous) * 100 : undefined;
}
