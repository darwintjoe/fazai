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

export function formatDateShort(date: Date | string, lang: string = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeMap: Record<string, string> = {
    en: 'en-US',
    id: 'id-ID',
    zh: 'zh-CN',
  };
  const locale = localeMap[lang] || 'en-US';
  return d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfYear(): Date {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
