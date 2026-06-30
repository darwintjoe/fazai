import Dexie, { type Table } from 'dexie';

export interface User {
  id: string;
  pin: string;
  name: string;
  role: 'admin' | 'user';
  isSystem?: boolean;
  createdAt: Date;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  nameId?: string;
  nameZh?: string;
  type: 'asset' | 'cashBank' | 'liability' | 'equity' | 'income' | 'expense';
  parentId?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface Entry {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
}

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  counterparty: string;
  type: 'income' | 'expense' | 'custom';
  createdBy: string;
  createdAt: Date;
  entries: Entry[];
  // Audit fields (optional; absent on records created before this feature)
  isDeleted?: boolean;       // soft-delete flag — excluded from all financial totals
  deletedAt?: Date | null;   // timestamp of soft-deletion, shown on the history card
  isEdited?: boolean;        // set true when a transaction has been edited
  editedAt?: Date | null;    // timestamp of the most recent edit
}

export interface ArchivedTransaction extends Transaction {
  archivedAt: Date;
}

export interface AccountMonthlySummary {
  id: string;           // "acc-xxx-2026-4" (accountId-year-month)
  accountId: string;
  year: number;         // 2026
  month: number;        // 0-11
  totalDebit: number;   // sum of all debits for this account this month
  totalCredit: number;  // sum of all credits
  lastCalculated: Date;
}

export interface Setting {
  key: string;
  value: string;
}

// ============================================
// POS Integration
// ============================================

/** How the POS reports sales to FAZAI (the "merchant report method"). */
export type PosReportMethod = 'immediate' | 'daily-individual' | 'daily-total';

/**
 * A linked POS app. The apiKey is a local pairing/scoping token: the POS must
 * include it in every export so FAZAI can route the file to this connection and
 * apply its payment-method map + report method. (If a server push endpoint is
 * ever added, this same key becomes the bearer credential.)
 */
export interface PosConnection {
  id: string;
  apiKey: string;            // "faz_pos_<random>"
  name: string;              // human label, e.g. "Moka — Front Counter"
  posProvider?: string;      // e.g. "Moka", "iSeller", "Olsera"
  reportMethod: PosReportMethod;
  /** POS payment-method key → FAZAI cash/bank account id, e.g. { "qris": "acc-qris" } */
  paymentMethodMap: Record<string, string>;
  defaultIncomeAccountId: string; // default "acc-sales"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Idempotency record. Keyed two ways depending on the report method:
 *  - immediate / daily-individual: keyed by `${connectionId}:${posSaleId}` —
 *    one row per sale.
 *  - daily-total: keyed by `${connectionId}:day:${dayKey}` — one row per day,
 *    so re-summing the same day is skipped.
 */
export interface PosSale {
  id: string;                // see class docs above
  connectionId: string;
  posSaleId?: string;        // the POS's own sale id (immediate / daily-individual)
  reportDate?: string;       // "YYYY-MM-DD" day key (daily-total idempotency)
  saleDate: Date;
  amount: number;
  paymentMethod: string;
  transactionId?: string;    // the FAZAI Transaction.id this sale was rolled into
  importedAt: Date;
}

/** Audit log of each import run. */
export interface PosImport {
  id: string;
  connectionId: string;
  importedAt: Date;
  reportMethod: PosReportMethod;
  saleCount: number;         // sales in the file
  createdCount: number;      // FAZAI transactions created
  skippedCount: number;      // already-imported sales/days
  errorCount: number;        // sales that could not be posted
}

class FazaiDB extends Dexie {
  users!: Table<User, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  accountMonthlySummaries!: Table<AccountMonthlySummary, string>;
  archivedTransactions!: Table<ArchivedTransaction, string>;
  settings!: Table<Setting, string>;
  posConnections!: Table<PosConnection, string>;
  posSales!: Table<PosSale, string>;
  posImports!: Table<PosImport, string>;

  constructor() {
    super('fazai-db');
    this.version(1).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, isActive, parentId',
      transactions: 'id, date, type, createdBy, description, counterparty',
      settings: 'key',
    });
    this.version(2).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, isActive, parentId',
      transactions: 'id, date, type, createdBy, description, counterparty',
      settings: 'key',
    }).upgrade(async () => {
      // Empty upgrade - preparing for v3
    });
    this.version(3).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, isActive, parentId',
      transactions: 'id, date, type, createdBy, description, counterparty',
      accountMonthlySummaries: 'id, accountId, year, month, [accountId+year+month]',
      archivedTransactions: 'id, date, type, createdBy, archivedAt',
      settings: 'key',
    }).upgrade(async () => {
      // Migration to v3: will be handled by rollover on startup
    });
    this.version(4).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, isActive, parentId',
      transactions: 'id, date, type, createdBy, description, counterparty',
      accountMonthlySummaries: 'id, accountId, year, month, [accountId+year+month]',
      archivedTransactions: 'id, date, type, createdBy, archivedAt',
      settings: 'key',
    }).upgrade(async () => {
      // v4: Rename Cash on Hand -> Cash, Bank Account -> Bank; Add QRIS & Credit Card
      const accCash = await db.accounts.get('acc-cash');
      if (accCash) {
        await db.accounts.update('acc-cash', {
          name: 'Cash',
          nameId: 'Kas',
          nameZh: '现金',
        });
      }
      const accBank = await db.accounts.get('acc-bank');
      if (accBank) {
        await db.accounts.update('acc-bank', {
          name: 'Bank',
          nameId: 'Bank',
          nameZh: '银行',
        });
      }
      // Add QRIS and Credit Card if they don't exist
      const existingQris = await db.accounts.get('acc-qris');
      if (!existingQris) {
        await db.accounts.add({
          id: 'acc-qris',
          code: '1-1300',
          name: 'QRIS',
          nameId: 'QRIS',
          nameZh: 'QRIS',
          type: 'cashBank',
          parentId: 'acc-cashbank-root',
          isSystem: true,
          isActive: true,
          createdAt: new Date(),
        });
      }
      const existingCC = await db.accounts.get('acc-credit-card');
      if (!existingCC) {
        await db.accounts.add({
          id: 'acc-credit-card',
          code: '1-1400',
          name: 'Credit Card',
          nameId: 'Kartu Kredit',
          nameZh: '信用卡',
          type: 'cashBank',
          parentId: 'acc-cashbank-root',
          isSystem: true,
          isActive: true,
          createdAt: new Date(),
        });
      }
    });
    // v5: POS integration — connection registry, sale/day idempotency, import audit log
    this.version(5).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, isActive, parentId',
      transactions: 'id, date, type, createdBy, description, counterparty',
      accountMonthlySummaries: 'id, accountId, year, month, [accountId+year+month]',
      archivedTransactions: 'id, date, type, createdBy, archivedAt',
      settings: 'key',
      posConnections: 'id, apiKey, isActive',
      posSales: 'id, connectionId, posSaleId, reportDate, saleDate, transactionId',
      posImports: 'id, connectionId, importedAt',
    });
  }
}

export const db = new FazaiDB();

const DEFAULT_USERS: User[] = [
  { id: 'admin-1', pin: '000000', name: 'Admin', role: 'admin', isSystem: true, createdAt: new Date() },
  { id: 'user-1', pin: '111111', name: 'User', role: 'user', isSystem: true, createdAt: new Date() },
];

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-asset-root', code: '1-0000', name: 'Assets', nameId: 'Aset', nameZh: '资产', type: 'asset', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-cashbank-root', code: '1-1000', name: 'Cash & Bank', nameId: 'Kas & Bank', nameZh: '现金与银行', type: 'cashBank', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-cash', code: '1-1100', name: 'Cash', nameId: 'Kas', nameZh: '现金', type: 'cashBank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-bank', code: '1-1200', name: 'Bank', nameId: 'Bank', nameZh: '银行', type: 'cashBank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-qris', code: '1-1300', name: 'QRIS', nameId: 'QRIS', nameZh: 'QRIS', type: 'cashBank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-credit-card', code: '1-1400', name: 'Credit Card', nameId: 'Kartu Kredit', nameZh: '信用卡', type: 'cashBank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },

  { id: 'acc-liability-root', code: '2-0000', name: 'Liabilities', nameId: 'Kewajiban', nameZh: '负债', type: 'liability', isSystem: true, isActive: true, createdAt: new Date() },

  { id: 'acc-equity-root', code: '3-0000', name: 'Equity', nameId: 'Modal', nameZh: '权益', type: 'equity', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-opening-balance', code: '3-1000', name: 'Opening Balance', nameId: 'Saldo Awal', nameZh: '期初余额', type: 'equity', parentId: 'acc-equity-root', isSystem: true, isActive: true, createdAt: new Date() },

  { id: 'acc-income-root', code: '4-0000', name: 'Income', nameId: 'Pendapatan', nameZh: '收入', type: 'income', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-salary', code: '4-1000', name: 'Salary', nameId: 'Gaji', nameZh: '工资', type: 'income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-freelance', code: '4-2000', name: 'Freelance', nameId: 'Freelance', nameZh: '自由职业', type: 'income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-sales', code: '4-3000', name: 'Sales', nameId: 'Penjualan', nameZh: '销售', type: 'income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-interest', code: '4-4000', name: 'Interest Income', nameId: 'Bunga', nameZh: '利息收入', type: 'income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-other-income', code: '4-9000', name: 'Other Income', nameId: 'Pendapatan Lainnya', nameZh: '其他收入', type: 'income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },

  { id: 'acc-expense-root', code: '5-0000', name: 'Expenses', nameId: 'Pengeluaran', nameZh: '支出', type: 'expense', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-food', code: '5-1000', name: 'Food & Beverages', nameId: 'Makanan & Minuman', nameZh: '餐饮', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-transport', code: '5-2000', name: 'Transportation', nameId: 'Transportasi', nameZh: '交通', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-utilities', code: '5-3000', name: 'Utilities', nameId: 'Utilitas', nameZh: '公用事业', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-rent', code: '5-4000', name: 'Rent', nameId: 'Sewa', nameZh: '租金', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-entertainment', code: '5-5000', name: 'Entertainment', nameId: 'Hiburan', nameZh: '娱乐', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-healthcare', code: '5-6000', name: 'Healthcare', nameId: 'Kesehatan', nameZh: '医疗', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-shopping', code: '5-7000', name: 'Shopping', nameId: 'Belanja', nameZh: '购物', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-education', code: '5-8000', name: 'Education', nameId: 'Pendidikan', nameZh: '教育', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-other-expense', code: '5-9000', name: 'Other Expense', nameId: 'Pengeluaran Lainnya', nameZh: '其他支出', type: 'expense', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
];

export async function seedDatabase() {
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkAdd(DEFAULT_USERS);
  }

  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    await db.accounts.bulkAdd(DEFAULT_ACCOUNTS);
  }

  // Seed AI provider defaults (only if not already configured)
  const existingProvider = await db.settings.get('ai-provider');
  if (!existingProvider) {
    await db.settings.bulkPut([
      { key: 'ai-provider', value: 'groq' },
      { key: 'ai-model', value: 'llama-3.1-8b-instant' },
      { key: 'ai-api-key', value: '' },
      { key: 'ai-endpoint', value: '' },
    ]);
  }

  // Seed OCR provider defaults (separate from chat — uses vision-capable model)
  const existingOcrProvider = await db.settings.get('ocr-provider');
  if (!existingOcrProvider) {
    await db.settings.bulkPut([
      { key: 'ocr-provider', value: 'groq' },
      { key: 'ocr-model', value: 'qwen/qwen3.6-27b' },
      { key: 'ocr-api-key', value: '' },
      { key: 'ocr-endpoint', value: '' },
    ]);
  }
}

export async function exportAllData() {
  const users = await db.users.toArray();
  const accounts = await db.accounts.toArray();
  const transactions = await db.transactions.toArray();
  const summaries = await db.accountMonthlySummaries.toArray();
  const archivedTransactions = await db.archivedTransactions.toArray();
  const settings = await db.settings.toArray();
  const posConnections = await db.posConnections.toArray();
  const posSales = await db.posSales.toArray();
  const posImports = await db.posImports.toArray();
  return { users, accounts, transactions, accountMonthlySummaries: summaries, archivedTransactions, settings, posConnections, posSales, posImports, exportedAt: new Date().toISOString(), version: 5 };
}

export type ExportData = Awaited<ReturnType<typeof exportAllData>>;

export async function importAllData(data: ExportData) {
  await db.transaction('rw', [db.users, db.accounts, db.transactions, db.accountMonthlySummaries, db.archivedTransactions, db.settings, db.posConnections, db.posSales, db.posImports], async () => {
    await db.users.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    await db.accountMonthlySummaries.clear();
    await db.archivedTransactions.clear();
    await db.settings.clear();
    await db.posConnections.clear();
    await db.posSales.clear();
    await db.posImports.clear();

    if (data.users?.length) await db.users.bulkAdd(data.users);
    if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
    if (data.accountMonthlySummaries?.length) await db.accountMonthlySummaries.bulkAdd(data.accountMonthlySummaries);
    if (data.archivedTransactions?.length) await db.archivedTransactions.bulkAdd(data.archivedTransactions);
    if (data.settings?.length) await db.settings.bulkAdd(data.settings);
    if (data.posConnections?.length) await db.posConnections.bulkAdd(data.posConnections);
    if (data.posSales?.length) await db.posSales.bulkAdd(data.posSales);
    if (data.posImports?.length) await db.posImports.bulkAdd(data.posImports);
  });
}

export async function deleteAllTransactions(): Promise<void> {
  await db.transaction('rw', [db.transactions, db.accountMonthlySummaries, db.archivedTransactions, db.posSales, db.posImports], async () => {
    await db.transactions.clear();
    await db.accountMonthlySummaries.clear();
    await db.archivedTransactions.clear();
    // POS sales/imports reference transactions and become meaningless once transactions are wiped.
    await db.posSales.clear();
    await db.posImports.clear();
  });
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const user = await db.users.where('pin').equals(pin).first();
  return !!user && user.role === 'admin';
}

export async function factoryReset(): Promise<void> {
  await db.transaction('rw', [db.users, db.accounts, db.transactions, db.accountMonthlySummaries, db.archivedTransactions, db.settings, db.posConnections, db.posSales, db.posImports], async () => {
    await db.users.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    await db.accountMonthlySummaries.clear();
    await db.archivedTransactions.clear();
    await db.settings.clear();
    await db.posConnections.clear();
    await db.posSales.clear();
    await db.posImports.clear();
  });
  await seedDatabase();
}
