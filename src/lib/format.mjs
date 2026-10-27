export const number = (value, digits = 1) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
export const gw = value => value == null ? null : value / 1000;
export const signed = (value, digits = 2) => value == null ? '—' : `${value > 0 ? '+' : ''}${number(value, digits)}`;
export const dateLabel = (value, short = false) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) }).format(new Date(`${value}T12:00:00Z`));
export const publicationLabel = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : 'Not available';
export const hourLabel = hour => `${String(hour).padStart(2, '0')}:00`;
export const nextDay = value => new Date(new Date(`${value}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);

export function exportUrl(date, cutoff, month = false) {
  return `/api/export?${new URLSearchParams({ date, cutoff, scope: month ? 'month' : 'day' })}`;
}
