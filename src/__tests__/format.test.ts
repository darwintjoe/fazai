import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  parseFormattedNumber,
  formatDate,
  today,
  startOfMonthFor,
  endOfMonthFor,
  startOfYearFor,
  isCurrentMonth,
  MONTH_LABELS,
  formatMonthYear,
} from '@/lib/format';

describe('formatNumber', () => {
  it('formats positive numbers with commas', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats negative numbers', () => {
    expect(formatNumber(-5000)).toBe('-5,000');
  });

  it('formats decimals', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56');
  });
});

describe('parseFormattedNumber', () => {
  it('parses comma-formatted numbers', () => {
    expect(parseFormattedNumber('1,000')).toBe(1000);
    expect(parseFormattedNumber('1,000,000')).toBe(1000000);
  });

  it('parses plain numbers', () => {
    expect(parseFormattedNumber('500')).toBe(500);
  });

  it('returns 0 for invalid input', () => {
    expect(parseFormattedNumber('abc')).toBe(0);
    expect(parseFormattedNumber('')).toBe(0);
  });
});

describe('formatDate', () => {
  it('formats date in English by default', () => {
    const result = formatDate(new Date(2026, 0, 15));
    expect(result).toContain('2026');
    expect(result).toContain('Jan');
  });

  it('formats date in Indonesian', () => {
    const result = formatDate(new Date(2026, 0, 15), 'id');
    expect(result).toContain('2026');
  });
});

describe('today', () => {
  it('returns a date with zeroed time', () => {
    const result = today();
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('startOfMonthFor', () => {
  it('returns first day of given month at midnight', () => {
    const result = startOfMonthFor(2026, 5); // June 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });
});

describe('endOfMonthFor', () => {
  it('returns last day of given month at 23:59:59.999', () => {
    const result = endOfMonthFor(2026, 0); // January 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(31);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
  });

  it('handles February in non-leap year', () => {
    const result = endOfMonthFor(2025, 1); // Feb 2025
    expect(result.getDate()).toBe(28);
  });

  it('handles February in leap year', () => {
    const result = endOfMonthFor(2028, 1); // Feb 2028
    expect(result.getDate()).toBe(29);
  });
});

describe('startOfYearFor', () => {
  it('returns Jan 1 of given year at midnight', () => {
    const result = startOfYearFor(2026);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });
});

describe('isCurrentMonth', () => {
  it('returns true for current month and year', () => {
    const now = new Date();
    expect(isCurrentMonth(now.getFullYear(), now.getMonth())).toBe(true);
  });

  it('returns false for different month', () => {
    const now = new Date();
    const differentMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    expect(isCurrentMonth(now.getFullYear(), differentMonth)).toBe(false);
  });
});

describe('MONTH_LABELS', () => {
  it('has 12 months', () => {
    expect(MONTH_LABELS).toHaveLength(12);
  });

  it('starts with January', () => {
    expect(MONTH_LABELS[0]).toBe('January');
  });
});

describe('formatMonthYear', () => {
  it('formats month and year in English', () => {
    const result = formatMonthYear(2026, 0);
    expect(result).toContain('2026');
    expect(result).toContain('January');
  });

  it('formats month and year in Indonesian', () => {
    const result = formatMonthYear(2026, 0, 'id');
    expect(result).toContain('2026');
  });
});
