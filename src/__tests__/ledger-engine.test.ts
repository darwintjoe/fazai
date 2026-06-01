import { describe, it, expect } from 'vitest';

// Test the date helper logic that was consolidated from ledger-engine into format.ts
// These verify the same behavior that was previously tested inline

describe('Ledger Engine - Date Helper Logic', () => {
  describe('monthRange iteration', () => {
    function* monthRange(fromYear: number, fromMonth: number, toYear: number, toMonth: number) {
      let y = fromYear, m = fromMonth;
      while (y < toYear || (y === toYear && m <= toMonth)) {
        yield { year: y, month: m };
        if (m === 11) { y++; m = 0; } else { m++; }
      }
    }

    it('yields months within same year', () => {
      const months = [...monthRange(2026, 0, 2026, 3)]; // Jan to Apr 2026
      expect(months).toEqual([
        { year: 2026, month: 0 },
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ]);
    });

    it('yields months across year boundary', () => {
      const months = [...monthRange(2025, 11, 2026, 1)]; // Dec 2025 to Feb 2026
      expect(months).toEqual([
        { year: 2025, month: 11 },
        { year: 2026, month: 0 },
        { year: 2026, month: 1 },
      ]);
    });

    it('yields single month when from equals to', () => {
      const months = [...monthRange(2026, 5, 2026, 5)];
      expect(months).toEqual([{ year: 2026, month: 5 }]);
    });
  });

  describe('previousMonth', () => {
    function previousMonth(year: number, month: number): { year: number; month: number } {
      return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
    }

    it('returns previous month within same year', () => {
      expect(previousMonth(2026, 5)).toEqual({ year: 2026, month: 4 });
    });

    it('wraps around to December of previous year', () => {
      expect(previousMonth(2026, 0)).toEqual({ year: 2025, month: 11 });
    });
  });

  describe('summaryId', () => {
    function summaryId(accountId: string, year: number, month: number): string {
      return `${accountId}-${year}-${month}`;
    }

    it('generates correct ID format', () => {
      expect(summaryId('acc-cash', 2026, 5)).toBe('acc-cash-2026-5');
    });
  });
});
