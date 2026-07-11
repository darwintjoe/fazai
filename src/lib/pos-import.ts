/**
 * POS → FAZAI import engine.
 *
 * FAZAI is local-first (data lives in the browser's IndexedDB via Dexie), so a
 * POS "pushes" by exporting a JSON file that the user imports here.
 *
 * The merchant report method (how the POS reports sales to FAZAI) determines how
 * sales become ledger transactions:
 *
 *   - immediate         : the POS sends a file each time a sale closes. FAZAI
 *                         posts ONE income transaction per sale (2 legs:
 *                         Dr cash/bank, Cr sales).
 *   - daily-individual  : the POS sends the day's log (each transaction
 *                         detailed). FAZAI posts ONE income transaction per
 *                         sale (2 legs) — identical ledger output to immediate;
 *                         the difference is only the POS's reporting cadence.
 *   - daily-total       : the POS sums the day and sends a single transaction.
 *                         FAZAI posts ONE multi-entry transaction per day with
 *                         a debit leg per payment method and a single credit to
 *                         sales (e.g. Dr Cash 50000, Dr QRIS 30000, Cr Sales 80000).
 *
 * All writes go through createIncomeTransaction / createMultiEntryTransaction
 * so the double-entry ledger stays balanced and monthly summaries stay correct.
 */

import { v4 as uuid } from 'uuid';
import { db, type PosConnection, type PosReportMethod } from './fazai-db';
import { createIncomeTransaction, createMultiEntryTransaction } from './ledger-engine';

export const POS_IMPORT_FORMAT = 'fazai-pos-import';
export const POS_IMPORT_VERSION = 1;

/** A sale as it appears in the POS export file. */
export interface PosImportSale {
  saleId: string;
  datetime: string;          // ISO 8601
  amount: number;            // positive number
  paymentMethod: string;     // POS-specific key, e.g. "cash", "qris"
  counterparty?: string;
  description?: string;
}

/** Shape of the file the POS produces. */
export interface PosImportFile {
  format: string;            // must === POS_IMPORT_FORMAT
  version: number;           // must === POS_IMPORT_VERSION
  apiKey: string;
  connectionId?: string;
  posProvider?: string;
  exportedAt?: string;
  currency?: string;
  sales: PosImportSale[];
}

/** Result returned to the UI after an import run. */
export interface PosImportResult {
  ok: boolean;
  error?: string;            // top-level failure (bad file, no connection, …)
  connectionId?: string;
  connectionName?: string;
  reportMethod?: PosReportMethod;
  saleCount: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  /** Per-error detail, capped for display. */
  errors: PosImportSaleError[];
}

export interface PosImportSaleError {
  saleId?: string;
  reason: string;
}

/** Generate a new local pairing/scoping token for a connection. */
export function generatePosApiKey(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `faz_pos_${hex}`;
}

/** Default payment-method map offered when creating a new connection. */
export const DEFAULT_PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'acc-cash',
  bank_transfer: 'acc-bank',
  qris: 'acc-qris',
  card: 'acc-credit-card',
};

export const DEFAULT_INCOME_ACCOUNT_ID = 'acc-sales';

/** Parse + structurally validate a file. Throws on hard failure. */
export function parsePosImportFile(raw: string): PosImportFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('File contents are not a JSON object.');
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== POS_IMPORT_FORMAT) {
    throw new Error(`Not a FAZAI POS import file (expected format "${POS_IMPORT_FORMAT}").`);
  }
  if (obj.version !== POS_IMPORT_VERSION) {
    throw new Error(`Unsupported import version ${String(obj.version)} (expected ${POS_IMPORT_VERSION}).`);
  }
  if (typeof obj.apiKey !== 'string' || !obj.apiKey) {
    throw new Error('Import file is missing an apiKey.');
  }
  if (!Array.isArray(obj.sales)) {
    throw new Error('Import file has no "sales" array.');
  }
  const sales = (obj.sales as unknown[]).map((s, i) => {
    const r = (s ?? {}) as Record<string, unknown>;
    return {
      saleId: r.saleId != null ? String(r.saleId) : '',
      datetime: typeof r.datetime === 'string' ? r.datetime : '',
      amount: typeof r.amount === 'number' ? r.amount : Number(r.amount) || 0,
      paymentMethod: r.paymentMethod != null ? String(r.paymentMethod) : '',
      counterparty: typeof r.counterparty === 'string' ? r.counterparty : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
    } as PosImportSale;
  });
  return {
    format: obj.format as string,
    version: obj.version as number,
    apiKey: obj.apiKey as string,
    connectionId: typeof obj.connectionId === 'string' ? obj.connectionId : undefined,
    posProvider: typeof obj.posProvider === 'string' ? obj.posProvider : undefined,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined,
    currency: typeof obj.currency === 'string' ? obj.currency : undefined,
    sales,
  };
}

/** Build a sample export for a connection so users/POS devs can see the contract. */
export function buildSampleImportFile(connection: Pick<PosConnection, 'apiKey' | 'id' | 'posProvider' | 'reportMethod'>): PosImportFile {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  // For daily-total, show a multi-payment-method day so devs see the shape.
  const paymentMethods =
    connection.reportMethod === 'daily-total'
      ? ['cash', 'qris']
      : ['cash'];
  const sales: PosImportSale[] = [];
  let n = 1;
  for (const pm of paymentMethods) {
    sales.push({
      saleId: `POS-${String(n++).padStart(4, '0')}`,
      datetime: iso(now),
      amount: pm === 'qris' ? 18000 : 25000,
      paymentMethod: pm,
      counterparty: 'Table 5',
      description: '2 × Es Kopi Susu',
    });
  }
  return {
    format: POS_IMPORT_FORMAT,
    version: POS_IMPORT_VERSION,
    apiKey: connection.apiKey,
    connectionId: connection.id,
    posProvider: connection.posProvider,
    exportedAt: iso(now),
    currency: 'IDR',
    sales,
  };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Normalize any sale datetime to local midnight of its day. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---------------------------------------------------------------------------
// Pure planning pass (DB-free, unit-tested)
// ---------------------------------------------------------------------------

/**
 * A posting group: resolves to ONE ledger transaction.
 *
 *  - per-sale groups (immediate / daily-individual) carry 2 balanced legs and
 *    are posted via createIncomeTransaction.
 *  - daily-total groups carry N debit legs (one per payment method) + 1 credit
 *    leg (total → sales) and are posted via createMultiEntryTransaction.
 */
export interface PendingPost {
  kind: 'per-sale' | 'daily-total';
  saleIds: string[];          // POS sale ids rolled into this post
  sales: PosImportSale[];     // the underlying sales (for posSales rows)
  paymentMethod: string;      // dominant/representative method (per-sale) or 'mixed'
  date: Date;
  counterparty: string;
  description: string;
  /** For per-sale posts. */
  amount?: number;
  opponentAccountId?: string;
  incomeAccountId?: string;
  /** For daily-total posts: per-method totals + sales, plus the credit total. */
  byMethod?: { paymentMethod: string; opponentAccountId: string; amount: number }[];
  total?: number;
}

/** Result of the pure planning pass (no DB). */
export interface PosImportPlan {
  posts: PendingPost[];
  skippedCount: number;
  errorCount: number;
  errors: PosImportSaleError[];
}

/** A validated sale ready for grouping. */
interface ValidSale {
  sale: PosImportSale;
  date: Date;
  day: string;
  opponentAccountId: string;
}

/**
 * Pure planning pass. Validates + dedups sales, then groups them into posting
 * batches according to the report method. Exported so it is unit-testable
 * without IndexedDB. The caller (runPosImport) then posts each batch and
 * persists posSales rows.
 *
 * @param sales             sales from the parsed file
 * @param connection        connection config (report method + payment map)
 * @param existingSaleIds   already-imported sale ids (immediate / daily-individual)
 * @param existingDays      already-imported day keys (daily-total)
 */
export function planPosPosts(
  sales: PosImportSale[],
  connection: Pick<PosConnection, 'name' | 'reportMethod' | 'paymentMethodMap' | 'defaultIncomeAccountId'>,
  existingSaleIds: ReadonlySet<string>,
  existingDays: ReadonlySet<string>,
): PosImportPlan {
  const map = connection.paymentMethodMap || {};
  const incomeAccountId = connection.defaultIncomeAccountId || DEFAULT_INCOME_ACCOUNT_ID;
  const method = connection.reportMethod;
  const errors: PosImportSaleError[] = [];
  let skippedCount = 0;
  let errorCount = 0;

  const seenInRun = new Set<string>();
  const valid: ValidSale[] = [];

  // --- validate + dedup each sale ---
  for (const sale of sales) {
    if (!sale.saleId) {
      errorCount++;
      errors.push({ reason: 'Sale is missing saleId — skipped.' });
      continue;
    }
    if (seenInRun.has(sale.saleId)) {
      skippedCount++;
      continue;
    }
    if (!Number.isFinite(sale.amount) || sale.amount <= 0) {
      errorCount++;
      errors.push({ saleId: sale.saleId, reason: `Invalid amount (${sale.amount}).` });
      seenInRun.add(sale.saleId);
      continue;
    }
    const opponentAccountId = map[sale.paymentMethod];
    if (!opponentAccountId) {
      errorCount++;
      errors.push({
        saleId: sale.saleId,
        reason: `No FAZAI account mapped for payment method "${sale.paymentMethod}".`,
      });
      seenInRun.add(sale.saleId);
      continue;
    }
    let saleDate: Date;
    try {
      saleDate = sale.datetime ? new Date(sale.datetime) : new Date();
      if (isNaN(saleDate.getTime())) throw new Error('bad date');
    } catch {
      errorCount++;
      errors.push({ saleId: sale.saleId, reason: `Invalid datetime "${sale.datetime}".` });
      seenInRun.add(sale.saleId);
      continue;
    }
    seenInRun.add(sale.saleId);
    valid.push({ sale, date: saleDate, day: dayKey(saleDate), opponentAccountId });
  }

  // --- immediate & daily-individual: one income tx per sale ---
  if (method === 'immediate' || method === 'daily-individual') {
    const posts: PendingPost[] = [];
    for (const v of valid) {
      if (existingSaleIds.has(v.sale.saleId)) {
        skippedCount++;
        continue;
      }
      const useDay = method === 'daily-individual';
      const date = useDay ? startOfDay(v.date) : v.date;
      const counterparty = v.sale.counterparty?.trim() || connection.name;
      const baseDesc = v.sale.description?.trim();
      posts.push({
        kind: 'per-sale',
        saleIds: [v.sale.saleId],
        sales: [v.sale],
        paymentMethod: v.sale.paymentMethod,
        date,
        counterparty,
        description: baseDesc || (useDay ? `POS Sale ${v.sale.saleId} (${v.day})` : `POS Sale ${v.sale.saleId}`),
        amount: v.sale.amount,
        opponentAccountId: v.opponentAccountId,
        incomeAccountId,
      });
    }
    return { posts, skippedCount, errorCount, errors };
  }

  // --- daily-total: ONE multi-entry tx per day ---
  // Group validated sales by day; dedup whole days already imported.
  const byDay = new Map<string, ValidSale[]>();
  for (const v of valid) {
    if (existingDays.has(v.day)) continue; // whole-day already imported → skip its sales
    const arr = byDay.get(v.day);
    if (arr) arr.push(v);
    else byDay.set(v.day, [v]);
  }
  // Count skipped sales that fell into already-imported days.
  for (const v of valid) {
    if (existingDays.has(v.day)) skippedCount++;
  }

  const posts: PendingPost[] = [];
  for (const [day, daySales] of byDay) {
    // Sum per payment method within the day.
    const perMethod = new Map<string, { opponentAccountId: string; amount: number; sales: PosImportSale[] }>();
    for (const v of daySales) {
      const cur = perMethod.get(v.sale.paymentMethod);
      if (cur) {
        cur.amount += v.sale.amount;
        cur.sales.push(v.sale);
      } else {
        perMethod.set(v.sale.paymentMethod, {
          opponentAccountId: v.opponentAccountId,
          amount: v.sale.amount,
          sales: [v.sale],
        });
      }
    }
    const total = Array.from(perMethod.values()).reduce((a, x) => a + x.amount, 0);
    if (total <= 0) continue;
    const dayDate = startOfDay(daySales[0].date);
    posts.push({
      kind: 'daily-total',
      saleIds: daySales.map((v) => v.sale.saleId),
      sales: daySales.map((v) => v.sale),
      paymentMethod: perMethod.size > 1 ? 'mixed' : daySales[0].sale.paymentMethod,
      date: dayDate,
      counterparty: 'Daily POS Sales',
      description: `Daily POS Sales — ${day}`,
      byMethod: Array.from(perMethod.entries()).map(([paymentMethod, x]) => ({
        paymentMethod,
        opponentAccountId: x.opponentAccountId,
        amount: x.amount,
      })),
      total,
      incomeAccountId,
    });
  }

  return { posts, skippedCount, errorCount, errors };
}

// ---------------------------------------------------------------------------
// Import runner (DB I/O)
// ---------------------------------------------------------------------------

/**
 * Run an import. Resolves the connection by apiKey, plans posts via the pure
 * planner, then posts each batch through the ledger engine and records posSales
 * + an audit row. Never throws on per-sale problems — they are collected into
 * `errors` and counted. Only hard, whole-file failures set `ok:false`.
 */
export async function runPosImport(
  file: PosImportFile,
  userId: string,
): Promise<PosImportResult> {
  // 1. Resolve connection by apiKey (connectionId is a hint only).
  let connection: PosConnection | undefined;
  if (file.connectionId) {
    connection = await db.posConnections.get(file.connectionId);
  }
  if (!connection || connection.apiKey !== file.apiKey) {
    connection = await db.posConnections.where('apiKey').equals(file.apiKey).first();
  }
  if (!connection) {
    return fail(file.sales.length, 'No POS connection matches this file\'s apiKey.');
  }
  if (!connection.isActive) {
    return fail(file.sales.length, `Connection "${connection.name}" is inactive.`, connection);
  }

  // 2. Load existing idempotency keys for this connection.
  const existing = await db.posSales.where('connectionId').equals(connection.id).toArray();
  const existingSaleIds = new Set(existing.map((s) => s.posSaleId).filter(Boolean) as string[]);
  const existingDays = new Set(existing.map((s) => s.reportDate).filter(Boolean) as string[]);

  // 3. Pure planning pass.
  const plan = planPosPosts(file.sales, connection, existingSaleIds, existingDays);
  const { posts, skippedCount, errors } = plan;
  const reportMethod = connection.reportMethod;
  let createdCount = 0;
  let errorCount = plan.errorCount;

  // 4. Post each batch through the ledger engine and record posSales rows.
  const posSaleRows: Array<{
    id: string;
    connectionId: string;
    posSaleId?: string;
    reportDate?: string;
    saleDate: Date;
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    importedAt: Date;
  }> = [];

  for (const post of posts) {
    try {
      let txId: string;
      if (post.kind === 'per-sale') {
        const tx = await createIncomeTransaction({
          amount: post.amount!,
          counterparty: post.counterparty,
          incomeAccountId: post.incomeAccountId!,
          opponentAccountId: post.opponentAccountId!,
          description: post.description,
          date: post.date,
          userId,
        });
        txId = tx.id;
      } else {
        // daily-total: one multi-entry transaction with a debit leg per payment
        // method and a single credit leg to sales. Balanced by construction:
        // Σ debit legs === total === credit leg.
        const entries = [
          ...post.byMethod!.map((m) => ({ accountId: m.opponentAccountId, debit: m.amount, credit: 0 })),
          { accountId: post.incomeAccountId!, debit: 0, credit: post.total! },
        ];
        const tx = await createMultiEntryTransaction({
          entries,
          description: post.description,
          date: post.date,
          userId,
        });
        txId = tx.id;
      }
      createdCount++;
      const importedAt = new Date();
      if (post.kind === 'per-sale') {
        posSaleRows.push({
          id: `${connection.id}:${post.saleIds[0]}`,
          connectionId: connection.id,
          posSaleId: post.saleIds[0],
          saleDate: post.date,
          amount: post.amount!,
          paymentMethod: post.paymentMethod,
          transactionId: txId,
          importedAt,
        });
      } else {
        posSaleRows.push({
          id: `${connection.id}:day:${dayKey(post.date)}`,
          connectionId: connection.id,
          reportDate: dayKey(post.date),
          saleDate: post.date,
          amount: post.total!,
          paymentMethod: 'mixed',
          transactionId: txId,
          importedAt,
        });
      }
    } catch (err) {
      errorCount += post.sales.length;
      const msg = err instanceof Error ? err.message : String(err);
      for (const s of post.sales) {
        errors.push({ saleId: s.saleId, reason: `Failed to post sale: ${msg}` });
      }
    }
  }

  // 5. Persist posSales + audit row.
  if (posSaleRows.length > 0) {
    await db.posSales.bulkPut(posSaleRows);
  }
  await db.posImports.add({
    id: uuid(),
    connectionId: connection.id,
    importedAt: new Date(),
    reportMethod,
    saleCount: file.sales.length,
    createdCount,
    skippedCount,
    errorCount,
  });

  return {
    ok: true,
    connectionId: connection.id,
    connectionName: connection.name,
    reportMethod,
    saleCount: file.sales.length,
    createdCount,
    skippedCount,
    errorCount,
    errors: errors.slice(0, 50),
  };
}

function fail(saleCount: number, error: string, connection?: PosConnection): PosImportResult {
  return {
    ok: false,
    error,
    connectionId: connection?.id,
    connectionName: connection?.name,
    saleCount,
    createdCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };
}
