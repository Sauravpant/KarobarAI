const currency = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const formatCurrency = (value: number) => `Rs. ${currency.format(value)}`;

export const formatNumber = (value: number) => currency.format(value);

export const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const isoDateFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
