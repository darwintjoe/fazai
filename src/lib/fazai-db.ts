import Dexie, { type Table } from 'dexie';

export interface User {
  id: string;
  pin: string;
  name: string;
  role: 'admin' | 'user';
  isSystem?: boolean;
  createdAt: Date;
}

export interface AccountCategory {
  id: string;          // e.g. "cat-cashbank"
  group: 'BS' | 'PL'; // Balance Sheet or Profit & Loss
  order: number;       // display order within group
  name: string;
  nameId?: string;
  nameZh?: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  nameId?: string;
  nameZh?: string;
  type: 'asset' | 'cashBank' | 'liability' | 'equity' | 'income' | 'expense';
  categoryId: string;  // references AccountCategory.id
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
  accountCategories!: Table<AccountCategory, string>;
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
      const accCash = await db.accounts.get('acc-cash');
      if (accCash) {
        await db.accounts.update('acc-cash', { name: 'Cash', nameId: 'Kas', nameZh: '现金' });
      }
      const accBank = await db.accounts.get('acc-bank');
      if (accBank) {
        await db.accounts.update('acc-bank', { name: 'Bank', nameId: 'Bank', nameZh: '银行' });
      }
      const existingQris = await db.accounts.get('acc-qris');
      if (!existingQris) {
        await db.accounts.add({
          id: 'acc-qris', code: '1-1300', name: 'QRIS', nameId: 'QRIS', nameZh: 'QRIS',
          type: 'cashBank', categoryId: 'cat-cashbank', parentId: 'acc-cashbank-root',
          isSystem: true, isActive: true, createdAt: new Date(),
        });
      }
      const existingCC = await db.accounts.get('acc-credit-card');
      if (!existingCC) {
        await db.accounts.add({
          id: 'acc-credit-card', code: '1-1400', name: 'Credit Card', nameId: 'Kartu Kredit', nameZh: '信用卡',
          type: 'cashBank', categoryId: 'cat-cashbank', parentId: 'acc-cashbank-root',
          isSystem: true, isActive: true, createdAt: new Date(),
        });
      }
    });
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
    // v6: Account Categories + categoryId on accounts
    this.version(6).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, categoryId, isActive, parentId',
      accountCategories: 'id, group, order, isActive',
      transactions: 'id, date, type, createdBy, description, counterparty',
      accountMonthlySummaries: 'id, accountId, year, month, [accountId+year+month]',
      archivedTransactions: 'id, date, type, createdBy, archivedAt',
      settings: 'key',
      posConnections: 'id, apiKey, isActive',
      posSales: 'id, connectionId, posSaleId, reportDate, saleDate, transactionId',
      posImports: 'id, connectionId, importedAt',
    }).upgrade(async () => {
      const catCount = await db.accountCategories.count();
      if (catCount === 0) {
        await db.accountCategories.bulkAdd(DEFAULT_CATEGORIES);
      }
      const allAccounts = await db.accounts.toArray();
      for (const acc of allAccounts) {
        if ((acc as any).categoryId) continue;
        const catId = guessCategoryId(acc);
        if (catId) {
          await db.accounts.update(acc.id, { categoryId: catId } as any);
        }
      }
    });
  }
}

export const db = new FazaiDB();

// ============================================
// Default Categories
// ============================================

export const DEFAULT_CATEGORIES: AccountCategory[] = [
  // BS
  { id: 'cat-cashbank', group: 'BS', order: 1, name: 'Cash & Bank', nameId: 'Kas & Bank', nameZh: '现金与银行', isSystem: true, isActive: true },
  { id: 'cat-ar', group: 'BS', order: 2, name: 'Accounts Receivable', nameId: 'Piutang Usaha', nameZh: '应收账款', isSystem: true, isActive: true },
  { id: 'cat-inventory', group: 'BS', order: 3, name: 'Inventory', nameId: 'Persediaan', nameZh: '库存', isSystem: true, isActive: true },
  { id: 'cat-fixedasset', group: 'BS', order: 4, name: 'Fixed Asset', nameId: 'Aset Tetap', nameZh: '固定资产', isSystem: true, isActive: true },
  { id: 'cat-accumdepr', group: 'BS', order: 5, name: 'Accumulated Depreciation', nameId: 'Akumulasi Depresiasi', nameZh: '累计折旧', isSystem: true, isActive: true },
  { id: 'cat-ap', group: 'BS', order: 6, name: 'Accounts Payable', nameId: 'Utang Usaha', nameZh: '应付账款', isSystem: true, isActive: true },
  { id: 'cat-taxpayable', group: 'BS', order: 7, name: 'Tax Payable', nameId: 'Pajak Harus Dibayar', nameZh: '应付税款', isSystem: true, isActive: true },
  { id: 'cat-taxreceivable', group: 'BS', order: 8, name: 'Tax Receivable', nameId: 'Pajak Dibayar Dimuka', nameZh: '应收税款', isSystem: true, isActive: true },
  { id: 'cat-otherliability', group: 'BS', order: 9, name: 'Other Liabilities', nameId: 'Kewajiban Lainnya', nameZh: '其他负债', isSystem: true, isActive: true },
  { id: 'cat-equity', group: 'BS', order: 10, name: 'Equity', nameId: 'Modal', nameZh: '权益', isSystem: true, isActive: true },
  // PL
  { id: 'cat-income', group: 'PL', order: 1, name: 'Income', nameId: 'Pendapatan', nameZh: '收入', isSystem: true, isActive: true },
  { id: 'cat-cogs', group: 'PL', order: 2, name: 'Cost of Goods Sold', nameId: 'Harga Pokok Penjualan', nameZh: '销售成本', isSystem: true, isActive: true },
  { id: 'cat-expenses', group: 'PL', order: 3, name: 'Operating Expenses', nameId: 'Biaya Operasional', nameZh: '运营费用', isSystem: true, isActive: true },
  { id: 'cat-rent', group: 'PL', order: 4, name: 'Rent', nameId: 'Sewa', nameZh: '租金', isSystem: true, isActive: true },
  { id: 'cat-depreciation-expense', group: 'PL', order: 5, name: 'Depreciation Expense', nameId: 'Biaya Depresiasi', nameZh: '折旧费用', isSystem: true, isActive: true },
  { id: 'cat-other-income', group: 'PL', order: 6, name: 'Other Income', nameId: 'Pendapatan Lainnya', nameZh: '其他收入', isSystem: true, isActive: true },
  { id: 'cat-other-expense', group: 'PL', order: 7, name: 'Other Expense', nameId: 'Pengeluaran Lainnya', nameZh: '其他支出', isSystem: true, isActive: true },
  { id: 'cat-tax-expense', group: 'PL', order: 8, name: 'Tax Expense', nameId: 'Beban Pajak', nameZh: '税费', isSystem: true, isActive: true },
];

function guessCategoryId(acc: Account): string | null {
  if (!acc.parentId) return null;
  if (acc.type === 'cashBank') return 'cat-cashbank';
  if (acc.type === 'asset') {
    if (acc.code.startsWith('1-2')) return 'cat-ar';
    if (acc.code.startsWith('1-3')) return 'cat-inventory';
    if (acc.code.startsWith('1-5')) return 'cat-accumdepr';
    if (acc.code.startsWith('1-6')) return 'cat-taxreceivable';
    return 'cat-fixedasset';
  }
  if (acc.type === 'liability') {
    if (acc.code.startsWith('2-2')) return 'cat-taxpayable';
    return 'cat-otherliability';
  }
  if (acc.type === 'equity') return 'cat-equity';
  if (acc.type === 'income') {
    if (acc.id === 'acc-other-income') return 'cat-other-income';
    return 'cat-income';
  }
  if (acc.type === 'expense') {
    if (acc.id === 'acc-rent' || acc.name === 'Rent') return 'cat-rent';
    if (acc.id === 'acc-other-expense') return 'cat-other-expense';
    return 'cat-expenses';
  }
  return null;
}

const DEFAULT_USERS: User[] = [
  { id: 'admin-1', pin: '000000', name: 'Admin', role: 'admin', isSystem: true, createdAt: new Date() },
  { id: 'user-1', pin: '111111', name: 'User', role: 'user', isSystem: true, createdAt: new Date() },
];

const DEFAULT_ACCOUNTS: Account[] = [
  // BS — Cash & Bank
  { id: 'acc-cashbank-root', code: '1-1000', name: 'Cash & Bank', nameId: 'Kas & Bank', nameZh: '现金与银行', type: 'cashBank', categoryId: 'cat-cashbank', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-cash', code: '1-1100', name: 'Cash', nameId: 'Kas', nameZh: '现金', type: 'cashBank', categoryId: 'cat-cashbank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-bank', code: '1-1200', name: 'Bank', nameId: 'Bank', nameZh: '银行', type: 'cashBank', categoryId: 'cat-cashbank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-qris', code: '1-1300', name: 'QRIS', nameId: 'QRIS', nameZh: 'QRIS', type: 'cashBank', categoryId: 'cat-cashbank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-credit-card', code: '1-1400', name: 'Credit Card', nameId: 'Kartu Kredit', nameZh: '信用卡', type: 'cashBank', categoryId: 'cat-cashbank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Accounts Receivable
  { id: 'acc-trade-receivables', code: '1-2100', name: 'Trade Receivables', nameId: 'Piutang Dagang', nameZh: '应收账款', type: 'asset', categoryId: 'cat-ar', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Inventory
  { id: 'acc-merchandise-inventory', code: '1-3100', name: 'Merchandise Inventory', nameId: 'Persediaan Barang', nameZh: '商品库存', type: 'asset', categoryId: 'cat-inventory', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Fixed Asset
  { id: 'acc-equipment', code: '1-4100', name: 'Equipment', nameId: 'Peralatan', nameZh: '设备', type: 'asset', categoryId: 'cat-fixedasset', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-furniture', code: '1-4200', name: 'Furniture & Vehicles', nameId: 'Furniture & Kendaraan', nameZh: '家具与车辆', type: 'asset', categoryId: 'cat-fixedasset', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Accumulated Depreciation
  { id: 'acc-accumdepr-equipment', code: '1-5100', name: 'Acc. Dep. - Equipment', nameId: 'Akum. Dep. - Peralatan', nameZh: '累计折旧 - 设备', type: 'asset', categoryId: 'cat-accumdepr', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-accumdepr-furniture', code: '1-5200', name: 'Acc. Dep. - Furniture', nameId: 'Akum. Dep. - Furniture', nameZh: '累计折旧 - 家具', type: 'asset', categoryId: 'cat-accumdepr', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Accounts Payable
  { id: 'acc-trade-payables', code: '2-1100', name: 'Trade Payables', nameId: 'Utang Dagang', nameZh: '应付账款', type: 'liability', categoryId: 'cat-ap', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Tax Payable
  { id: 'acc-vat-payable', code: '2-2100', name: 'VAT Payable', nameId: 'PPN Keluaran', nameZh: '应付增值税', type: 'liability', categoryId: 'cat-taxpayable', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-wht-payable', code: '2-2200', name: 'Withholding Tax Payable', nameId: 'PPh 23/26', nameZh: '应付预扣税', type: 'liability', categoryId: 'cat-taxpayable', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Tax Receivable
  { id: 'acc-vat-receivable', code: '1-6100', name: 'VAT Receivable', nameId: 'PPN Masukan', nameZh: '应收增值税', type: 'asset', categoryId: 'cat-taxreceivable', isSystem: true, isActive: true, createdAt: new Date() },
  // BS — Equity
  { id: 'acc-equity-root', code: '3-0000', name: 'Equity', nameId: 'Modal', nameZh: '权益', type: 'equity', categoryId: 'cat-equity', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-opening-balance', code: '3-1000', name: 'Opening Balance', nameId: 'Saldo Awal', nameZh: '期初余额', type: 'equity', categoryId: 'cat-equity', parentId: 'acc-equity-root', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Income
  { id: 'acc-income-root', code: '4-0000', name: 'Income', nameId: 'Pendapatan', nameZh: '收入', type: 'income', categoryId: 'cat-income', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-sales', code: '4-1000', name: 'Sales', nameId: 'Penjualan', nameZh: '销售', type: 'income', categoryId: 'cat-income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-salary', code: '4-2000', name: 'Salary', nameId: 'Gaji', nameZh: '工资', type: 'income', categoryId: 'cat-income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-freelance', code: '4-3000', name: 'Freelance', nameId: 'Freelance', nameZh: '自由职业', type: 'income', categoryId: 'cat-income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-interest', code: '4-4000', name: 'Interest Income', nameId: 'Bunga', nameZh: '利息收入', type: 'income', categoryId: 'cat-income', parentId: 'acc-income-root', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Cost of Goods Sold
  { id: 'acc-cogs', code: '5-0100', name: 'Cost of Goods Sold', nameId: 'Harga Pokok Penjualan', nameZh: '销售成本', type: 'expense', categoryId: 'cat-cogs', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Operating Expenses
  { id: 'acc-expense-root', code: '5-1000', name: 'Operating Expenses', nameId: 'Biaya Operasional', nameZh: '运营费用', type: 'expense', categoryId: 'cat-expenses', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-food', code: '5-1100', name: 'Food & Beverages', nameId: 'Makanan & Minuman', nameZh: '餐饮', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-transport', code: '5-1200', name: 'Transportation', nameId: 'Transportasi', nameZh: '交通', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-utilities', code: '5-1300', name: 'Utilities', nameId: 'Utilitas', nameZh: '公用事业', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-entertainment', code: '5-1500', name: 'Entertainment', nameId: 'Hiburan', nameZh: '娱乐', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-healthcare', code: '5-1600', name: 'Healthcare', nameId: 'Kesehatan', nameZh: '医疗', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-shopping', code: '5-1700', name: 'Shopping', nameId: 'Belanja', nameZh: '购物', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-education', code: '5-1800', name: 'Education', nameId: 'Pendidikan', nameZh: '教育', type: 'expense', categoryId: 'cat-expenses', parentId: 'acc-expense-root', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Rent
  { id: 'acc-rent', code: '5-2100', name: 'Rent', nameId: 'Sewa', nameZh: '租金', type: 'expense', categoryId: 'cat-rent', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Depreciation Expense
  { id: 'acc-depreciation', code: '5-3100', name: 'Depreciation Expense', nameId: 'Biaya Depresiasi', nameZh: '折旧费用', type: 'expense', categoryId: 'cat-depreciation-expense', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Other Income
  { id: 'acc-other-income', code: '4-9000', name: 'Other Income', nameId: 'Pendapatan Lainnya', nameZh: '其他收入', type: 'income', categoryId: 'cat-other-income', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Other Expense
  { id: 'acc-other-expense', code: '5-9000', name: 'Other Expense', nameId: 'Pengeluaran Lainnya', nameZh: '其他支出', type: 'expense', categoryId: 'cat-other-expense', isSystem: true, isActive: true, createdAt: new Date() },
  // PL — Tax Expense
  { id: 'acc-income-tax', code: '5-4100', name: 'Income Tax Expense', nameId: 'Beban Pajak Penghasilan', nameZh: '所得税费用', type: 'expense', categoryId: 'cat-tax-expense', isSystem: true, isActive: true, createdAt: new Date() },
];

export async function seedDatabase() {
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkAdd(DEFAULT_USERS);
  }

  const catCount = await db.accountCategories.count();
  if (catCount === 0) {
    await db.accountCategories.bulkAdd(DEFAULT_CATEGORIES);
  }

  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    await db.accounts.bulkAdd(DEFAULT_ACCOUNTS);
  }

  // Seed AI provider defaults (only if not already configured)
  const existingProvider = await db.settings.get('ai-provider');
  if (!existingProvider) {
    await db.settings.bulkPut([
      { key: 'ai-provider', value: 'zai' },
      { key: 'ai-model', value: 'z.ai/glm-4.7-flash' },
      { key: 'ai-api-key', value: '' },
      { key: 'ai-endpoint', value: '' },
    ]);
  }
}

export async function exportAllData() {
  const users = await db.users.toArray();
  const accounts = await db.accounts.toArray();
  const accountCategories = await db.accountCategories.toArray();
  const transactions = await db.transactions.toArray();
  const summaries = await db.accountMonthlySummaries.toArray();
  const archivedTransactions = await db.archivedTransactions.toArray();
  const settings = await db.settings.toArray();
  const posConnections = await db.posConnections.toArray();
  const posSales = await db.posSales.toArray();
  const posImports = await db.posImports.toArray();
  return { users, accounts, accountCategories, transactions, accountMonthlySummaries: summaries, archivedTransactions, settings, posConnections, posSales, posImports, exportedAt: new Date().toISOString(), version: 6 };
}

export type ExportData = Awaited<ReturnType<typeof exportAllData>>;

export async function importAllData(data: ExportData) {
  await db.transaction('rw', [db.users, db.accounts, db.accountCategories, db.transactions, db.accountMonthlySummaries, db.archivedTransactions, db.settings, db.posConnections, db.posSales, db.posImports], async () => {
    await db.users.clear();
    await db.accounts.clear();
    await db.accountCategories.clear();
    await db.transactions.clear();
    await db.accountMonthlySummaries.clear();
    await db.archivedTransactions.clear();
    await db.settings.clear();
    await db.posConnections.clear();
    await db.posSales.clear();
    await db.posImports.clear();

    if (data.accountCategories?.length) await db.accountCategories.bulkAdd(data.accountCategories);
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
    await db.posSales.clear();
    await db.posImports.clear();
  });
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const user = await db.users.where('pin').equals(pin).first();
  return !!user && user.role === 'admin';
}

export async function factoryReset(): Promise<void> {
  await db.transaction('rw', [db.users, db.accounts, db.accountCategories, db.transactions, db.accountMonthlySummaries, db.archivedTransactions, db.settings, db.posConnections, db.posSales, db.posImports], async () => {
    await db.users.clear();
    await db.accounts.clear();
    await db.accountCategories.clear();
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
