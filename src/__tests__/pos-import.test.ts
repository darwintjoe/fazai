import { describe, it, expect } from 'vitest';
import {
  parsePosImportFile,
  planPosPosts,
  generatePosApiKey,
  buildSampleImportFile,
  POS_IMPORT_FORMAT,
  POS_IMPORT_VERSION,
  type PosImportSale,
} from '@/lib/pos-import';

// These are pure-logic tests (no IndexedDB) — they mirror the style of
// ledger-engine.test.ts / format.test.ts. The DB-writing path in runPosImport
// delegates to planPosPosts, which is what we exercise here.

function sale(saleId: string, opts: Partial<PosImportSale> = {}): PosImportSale {
  return {
    saleId,
    datetime: opts.datetime ?? localIso(2026, 5, 1, 10),
    amount: opts.amount ?? 10000,
    paymentMethod: opts.paymentMethod ?? 'cash',
    counterparty: opts.counterparty,
    description: opts.description,
  };
}

/**
 * Build an ISO string from LOCAL date components at a given local hour.
 * Using local time (then converting to ISO) makes the test timezone-independent:
 * the engine normalizes to the local calendar day, so a local-noon timestamp
 * always lands on the intended local day regardless of the host's UTC offset.
 * (Args are monthIndex: 0-11, matching Date.)
 */
function localIso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour, 0, 0).toISOString();
}

const CONN = {
  name: 'Moka — Front',
  reportMethod: 'immediate' as const,
  paymentMethodMap: {
    cash: 'acc-cash',
    qris: 'acc-qris',
    bank_transfer: 'acc-bank',
  },
  defaultIncomeAccountId: 'acc-sales',
};

const EMPTY = new Set<string>();

describe('parsePosImportFile', () => {
  it('parses a well-formed file', () => {
    const raw = JSON.stringify({
      format: POS_IMPORT_FORMAT,
      version: POS_IMPORT_VERSION,
      apiKey: 'faz_pos_abc',
      sales: [{ saleId: 'S1', datetime: '2026-06-01T00:00:00.000Z', amount: 5000, paymentMethod: 'cash' }],
    });
    const file = parsePosImportFile(raw);
    expect(file.apiKey).toBe('faz_pos_abc');
    expect(file.sales).toHaveLength(1);
    expect(file.sales[0].amount).toBe(5000);
  });

  it('rejects non-JSON', () => {
    expect(() => parsePosImportFile('not json')).toThrow('not valid JSON');
  });

  it('rejects wrong format token', () => {
    const raw = JSON.stringify({ format: 'something-else', version: 1, apiKey: 'x', sales: [] });
    expect(() => parsePosImportFile(raw)).toThrow('Not a FAZAI POS import file');
  });

  it('rejects wrong version', () => {
    const raw = JSON.stringify({ format: POS_IMPORT_FORMAT, version: 99, apiKey: 'x', sales: [] });
    expect(() => parsePosImportFile(raw)).toThrow('Unsupported import version');
  });

  it('rejects missing apiKey', () => {
    const raw = JSON.stringify({ format: POS_IMPORT_FORMAT, version: POS_IMPORT_VERSION, sales: [] });
    expect(() => parsePosImportFile(raw)).toThrow('missing an apiKey');
  });

  it('rejects missing sales array', () => {
    const raw = JSON.stringify({ format: POS_IMPORT_FORMAT, version: POS_IMPORT_VERSION, apiKey: 'x' });
    expect(() => parsePosImportFile(raw)).toThrow('no "sales" array');
  });

  it('coerces loose sale fields into the typed shape', () => {
    const raw = JSON.stringify({
      format: POS_IMPORT_FORMAT,
      version: POS_IMPORT_VERSION,
      apiKey: 'x',
      sales: [{ saleId: 123, amount: '7000', paymentMethod: 'qris', datetime: '2026-06-01T00:00:00.000Z' }],
    });
    const file = parsePosImportFile(raw);
    expect(file.sales[0].saleId).toBe('123');
    expect(file.sales[0].amount).toBe(7000);
    expect(file.sales[0].paymentMethod).toBe('qris');
  });
});

describe('planPosPosts — immediate & daily-individual (one income tx per sale)', () => {
  it('immediate: one post per sale, dated at sale time', () => {
    const plan = planPosPosts(
      [
        sale('S1', { amount: 5000, paymentMethod: 'cash', datetime: localIso(2026, 5, 1, 9) }),
        sale('S2', { amount: 8000, paymentMethod: 'qris', datetime: localIso(2026, 5, 1, 11) }),
      ],
      CONN,
      EMPTY,
      EMPTY,
    );
    expect(plan.posts).toHaveLength(2);
    expect(plan.posts.every((p) => p.kind === 'per-sale')).toBe(true);
    expect(plan.posts[0].amount).toBe(5000);
    expect(plan.posts[1].amount).toBe(8000);
    expect(plan.errorCount).toBe(0);
    expect(plan.skippedCount).toBe(0);
  });

  it('daily-individual: one post per sale, normalized to the day', () => {
    const conn = { ...CONN, reportMethod: 'daily-individual' as const };
    const plan = planPosPosts(
      [
        sale('S1', { datetime: localIso(2026, 5, 1, 9) }),
        sale('S2', { datetime: localIso(2026, 5, 1, 21) }),
      ],
      conn,
      EMPTY,
      EMPTY,
    );
    expect(plan.posts).toHaveLength(2);
    expect(plan.posts.every((p) => p.kind === 'per-sale')).toBe(true);
    const d0 = plan.posts[0].date;
    const d1 = plan.posts[1].date;
    expect(d0.getHours()).toBe(0); // normalized to local midnight
    expect(d1.getHours()).toBe(0);
    expect(d0.toDateString()).toBe(d1.toDateString());
  });

  it('every per-sale post carries a balanced single positive amount', () => {
    const plan = planPosPosts(
      [sale('S1', { amount: 12345.67 }), sale('S2', { amount: 0.5 })],
      CONN,
      EMPTY,
      EMPTY,
    );
    for (const p of plan.posts) {
      expect(p.amount!).toBeGreaterThan(0);
      expect(Number.isFinite(p.amount!)).toBe(true);
    }
  });
});

describe('planPosPosts — daily-total (ONE multi-entry tx per day)', () => {
  it('produces ONE daily-total post per day, with a debit leg per payment method and a single credit', () => {
    const conn = { ...CONN, reportMethod: 'daily-total' as const };
    const plan = planPosPosts(
      [
        sale('S1', { amount: 5000, paymentMethod: 'cash', datetime: localIso(2026, 5, 1, 9) }),
        sale('S2', { amount: 3000, paymentMethod: 'cash', datetime: localIso(2026, 5, 1, 21) }),
        sale('S3', { amount: 7000, paymentMethod: 'qris', datetime: localIso(2026, 5, 1, 9) }),
        sale('S4', { amount: 2000, paymentMethod: 'cash', datetime: localIso(2026, 5, 2, 9) }),
      ],
      conn,
      EMPTY,
      EMPTY,
    );
    // 2 posts: one per day (2026-06-01, 2026-06-02)
    expect(plan.posts).toHaveLength(2);
    expect(plan.posts.every((p) => p.kind === 'daily-total')).toBe(true);

    const day1 = plan.posts.find((p) => p.date.getDate() === 1 && p.date.getMonth() === 5)!;
    // debit legs: cash (5000+3000=8000) and qris (7000) → credit 15000
    expect(day1.byMethod).toHaveLength(2);
    const cashLeg = day1.byMethod!.find((m) => m.paymentMethod === 'cash')!;
    const qrisLeg = day1.byMethod!.find((m) => m.paymentMethod === 'qris')!;
    expect(cashLeg.amount).toBe(8000);
    expect(qrisLeg.amount).toBe(7000);
    expect(day1.total).toBe(15000);
    // rolls every sale of the day
    expect(day1.saleIds).toHaveLength(3);

    const day2 = plan.posts.find((p) => p.date.getDate() === 2 && p.date.getMonth() === 5)!;
    expect(day2.byMethod).toHaveLength(1);
    expect(day2.total).toBe(2000);
  });

  it('the daily-total entry is balanced: Σ debit legs === credit total', () => {
    const conn = { ...CONN, reportMethod: 'daily-total' as const };
    const plan = planPosPosts(
      [
        sale('S1', { amount: 10000, paymentMethod: 'cash' }),
        sale('S2', { amount: 4000, paymentMethod: 'qris' }),
        sale('S3', { amount: 6000, paymentMethod: 'bank_transfer' }),
      ],
      conn,
      EMPTY,
      EMPTY,
    );
    expect(plan.posts).toHaveLength(1);
    const post = plan.posts[0];
    const debitSum = post.byMethod!.reduce((a, m) => a + m.amount, 0);
    expect(debitSum).toBe(post.total); // the engine posts debit legs + a single credit === total
  });

  it('keeps different payment methods in separate debit legs, not separate transactions', () => {
    const conn = { ...CONN, reportMethod: 'daily-total' as const };
    const plan = planPosPosts(
      [
        sale('S1', { amount: 1000, paymentMethod: 'cash' }),
        sale('S2', { amount: 2000, paymentMethod: 'qris' }),
      ],
      conn,
      EMPTY,
      EMPTY,
    );
    // Still ONE transaction — two debit legs inside it.
    expect(plan.posts).toHaveLength(1);
    expect(plan.posts[0].byMethod).toHaveLength(2);
  });
});

describe('planPosPosts — dedup & validation', () => {
  it('skips sales already imported (idempotency, immediate/daily-individual)', () => {
    const plan = planPosPosts([sale('S1'), sale('S2'), sale('S3')], CONN, new Set(['S1', 'S2']), EMPTY);
    expect(plan.posts.map((p) => p.saleIds)).toEqual([['S3']]);
    expect(plan.skippedCount).toBe(2);
  });

  it('skips a whole day already imported (daily-total)', () => {
    const conn = { ...CONN, reportMethod: 'daily-total' as const };
    const plan = planPosPosts(
      [sale('S1', { datetime: localIso(2026, 5, 1, 9) }), sale('S2', { datetime: localIso(2026, 5, 1, 21) })],
      conn,
      EMPTY,
      new Set(['2026-06-01']),
    );
    expect(plan.posts).toHaveLength(0);
    expect(plan.skippedCount).toBe(2);
  });

  it('skips duplicate saleIds within the same run', () => {
    const plan = planPosPosts([sale('S1'), sale('S1'), sale('S2')], CONN, EMPTY, EMPTY);
    expect(plan.posts.map((p) => p.saleIds)).toEqual([['S1'], ['S2']]);
    expect(plan.skippedCount).toBe(1);
  });

  it('errors on invalid amount without silently dropping or posting', () => {
    const plan = planPosPosts(
      [sale('S1', { amount: 0 }), sale('S2', { amount: -5 }), sale('S3', { amount: NaN }), sale('S4', { amount: 5000 })],
      CONN,
      EMPTY,
      EMPTY,
    );
    expect(plan.posts).toHaveLength(1);
    expect(plan.errorCount).toBe(3);
    expect(plan.errors).toHaveLength(3);
  });

  it('errors on unmapped payment method instead of defaulting', () => {
    const plan = planPosPosts([sale('S1', { paymentMethod: 'bitcoin' })], CONN, EMPTY, EMPTY);
    expect(plan.posts).toHaveLength(0);
    expect(plan.errorCount).toBe(1);
    expect(plan.errors[0].reason).toContain('bitcoin');
  });

  it('errors on missing saleId', () => {
    const plan = planPosPosts([sale(''), sale('S2')], CONN, EMPTY, EMPTY);
    expect(plan.posts).toHaveLength(1);
    expect(plan.errorCount).toBe(1);
  });

  it('errors on invalid datetime', () => {
    const plan = planPosPosts([sale('S1', { datetime: 'not-a-date' })], CONN, EMPTY, EMPTY);
    expect(plan.posts).toHaveLength(0);
    expect(plan.errorCount).toBe(1);
    expect(plan.errors[0].reason).toContain('Invalid datetime');
  });
});

describe('generatePosApiKey', () => {
  it('produces a prefixed, sufficiently long, unique token', () => {
    const k1 = generatePosApiKey();
    const k2 = generatePosApiKey();
    expect(k1.startsWith('faz_pos_')).toBe(true);
    expect(k2.startsWith('faz_pos_')).toBe(true);
    expect(k1).not.toBe(k2);
    expect(k1.length).toBeGreaterThanOrEqual(40);
  });
});

describe('buildSampleImportFile', () => {
  it('produces a valid, parseable contract for a connection', () => {
    const sample = buildSampleImportFile({ id: 'pos-1', apiKey: 'faz_pos_abc', posProvider: 'Moka', reportMethod: 'immediate' });
    expect(sample.format).toBe(POS_IMPORT_FORMAT);
    expect(sample.version).toBe(POS_IMPORT_VERSION);
    expect(sample.apiKey).toBe('faz_pos_abc');
    expect(sample.sales.length).toBeGreaterThan(0);
    expect(() => parsePosImportFile(JSON.stringify(sample))).not.toThrow();
  });

  it('daily-total sample exposes multiple payment methods in one day', () => {
    const sample = buildSampleImportFile({ id: 'pos-1', apiKey: 'faz_pos_abc', reportMethod: 'daily-total' });
    const methods = new Set(sample.sales.map((s) => s.paymentMethod));
    expect(methods.size).toBeGreaterThan(1);
  });
});
