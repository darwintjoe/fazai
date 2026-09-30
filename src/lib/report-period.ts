import { startOfMonthFor, endOfMonthFor, isCurrentMonth, formatMonthYear } from './format';

// Month math helpers shared by all reports
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return { year: y, month: m };
}

export function monthsInclusive(fromYear: number, fromMonth: number, toYear: number, toMonth: number): number {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

// Previous equal-length range for period reports (PL, CF, Ledger)
export function getPreviousRange(
  fromYear: number, fromMonth: number, toYear: number, toMonth: number,
): { fromYear: number; fromMonth: number; toYear: number; toMonth: number } {
  const len = monthsInclusive(fromYear, fromMonth, toYear, toMonth);
  const prevTo = shiftMonth(toYear, toMonth, -len);
  const prevFrom = shiftMonth(fromYear, fromMonth, -len);
  return { fromYear: prevFrom.year, fromMonth: prevFrom.month, toYear: prevTo.year, toMonth: prevTo.month };
}

// Previous as-of for point-in-time reports (BS): prior month-end
export function getPreviousAsof(year: number, month: number): { year: number; month: number } {
  return shiftMonth(year, month, -1);
}

export type Granularity = 'monthly' | 'quarterly' | 'yearly';

export interface PeriodSlice {
  key: string;
  label: string;
  fromDate: Date;
  toDate: Date;
}

export function buildPeriods(
  fromYear: number, fromMonth: number, toYear: number, toMonth: number,
  granularity: Granularity, lang = 'en',
): PeriodSlice[] {
  const out: PeriodSlice[] = [];
  if (granularity === 'monthly') {
    let y = fromYear, m = fromMonth;
    let guard = 0;
    while ((y < toYear || (y === toYear && m <= toMonth)) && guard < 36) {
      guard++;
      const fromDate = startOfMonthFor(y, m);
      const toDate = isCurrentMonth(y, m) ? new Date() : endOfMonthFor(y, m);
      out.push({
        key: `${y}-${m}`,
        label: formatMonthYear(y, m, lang).split(' ').map((s, i) => (i === 0 ? s.slice(0, 3) : s)).join(' '),
        fromDate, toDate,
      });
      const n = shiftMonth(y, m, 1);
      y = n.year; m = n.month;
    }
    return out;
  }
  if (granularity === 'yearly') {
    for (let y = fromYear; y <= toYear && out.length < 10; y++) {
      const m0 = y === fromYear ? fromMonth : 0;
      const m1 = y === toYear ? toMonth : 11;
      const fromDate = startOfMonthFor(y, m0);
      const last = shiftMonth(y, m1, 0);
      const toDate = isCurrentMonth(last.year, last.month) ? new Date() : endOfMonthFor(last.year, last.month);
      out.push({ key: `${y}`, label: `${y}`, fromDate, toDate });
    }
    return out;
  }
  // quarterly: bucket months into calendar quarters
  const startQ = Math.floor(fromMonth / 3);
  const endQ = Math.floor(toMonth / 3);
  let y = fromYear, q = startQ;
  let guard = 0;
  while ((y < toYear || (y === toYear && q <= endQ)) && guard < 12) {
    guard++;
    const qm0 = q * 3;
    const qm1 = qm0 + 2;
    const effM0 = y === fromYear ? Math.max(qm0, fromMonth) : qm0;
    const effM1 = y === toYear ? Math.min(qm1, toMonth) : qm1;
    const fromDate = startOfMonthFor(y, effM0);
    const toDate = isCurrentMonth(y, effM1) ? new Date() : endOfMonthFor(y, effM1);
    out.push({ key: `${y}-Q${q + 1}`, label: `Q${q + 1} ${y}`, fromDate, toDate });
    q++;
    if (q > 3) { q = 0; y++; }
  }
  return out;
}

export function calcChange(current: number, previous: number): { diff: number; pct: number | null } {
  const diff = current - previous;
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : null;
  return { diff, pct };
}

export function formatPct(pct: number | null): string {
  if (pct === null || !isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
