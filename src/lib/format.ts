export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/,/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

export function formatDate(date: Date | string, lang: string = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeMap: Record<string, string> = {
    en: 'en-US',
    id: 'id-ID',
    zh: 'zh-CN',
  };
  const locale = localeMap[lang] || 'en-US';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonthFor(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

export function endOfMonthFor(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

export function startOfYearFor(year: number): Date {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

export function isCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month;
}

export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatMonthYear(year: number, month: number, lang: string = 'en'): string {
  const localeMap: Record<string, string> = { en: 'en-US', id: 'id-ID', zh: 'zh-CN' };
  const locale = localeMap[lang] || 'en-US';
  const d = new Date(year, month, 1);
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
}
