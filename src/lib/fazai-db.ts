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
}

export interface Setting {
  key: string;
  value: string;
}

class FazaiDB extends Dexie {
  users!: Table<User, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('fazai-db');
    this.version(1).stores({
      users: 'id, pin, name, role',
      accounts: 'id, code, name, type, isActive, parentId',
      transactions: 'id, date, type, createdBy, description, counterparty',
      settings: 'key',
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
  { id: 'acc-cash', code: '1-1100', name: 'Cash on Hand', nameId: 'Kas', nameZh: '库存现金', type: 'cashBank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },
  { id: 'acc-bank', code: '1-1200', name: 'Bank Account', nameId: 'Rekening Bank', nameZh: '银行账户', type: 'cashBank', parentId: 'acc-cashbank-root', isSystem: true, isActive: true, createdAt: new Date() },

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
}

export async function exportAllData() {
  const users = await db.users.toArray();
  const accounts = await db.accounts.toArray();
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.toArray();
  return { users, accounts, transactions, settings, exportedAt: new Date().toISOString(), version: 1 };
}

export type ExportData = Awaited<ReturnType<typeof exportAllData>>;

export async function importAllData(data: ExportData) {
  await db.transaction('rw', [db.users, db.accounts, db.transactions, db.settings], async () => {
    await db.users.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    await db.settings.clear();

    if (data.users?.length) await db.users.bulkAdd(data.users);
    if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
    if (data.settings?.length) await db.settings.bulkAdd(data.settings);
  });
}

export async function deleteAllTransactions(): Promise<void> {
  await db.transactions.clear();
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const user = await db.users.where('pin').equals(pin).first();
  return !!user && user.role === 'admin';
}

export async function factoryReset(): Promise<void> {
  await db.transaction('rw', [db.users, db.accounts, db.transactions, db.settings], async () => {
    await db.users.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    await db.settings.clear();
  });
  await seedDatabase();
}
