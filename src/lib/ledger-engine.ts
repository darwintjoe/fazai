import { db, type Account, type Transaction, type Entry } from './fazai-db';
import { getAccountName } from './i18n';
import type { Lang } from './i18n';
import { v4 as uuid } from 'uuid';

// Create an income transaction (double-entry)
export async function createIncomeTransaction(params: {
  amount: number;
  counterparty: string;
  incomeAccountId: string;
  opponentAccountId: string;
  description: string;
  date: Date;
  userId: string;
}): Promise<Transaction> {
  const { amount, counterparty, incomeAccountId, opponentAccountId, description, date, userId } = params;

  const transaction: Transaction = {
    id: uuid(),
    date,
    description,
    counterparty,
    type: 'income',
    createdBy: userId,
    createdAt: new Date(),
    entries: [
      { id: uuid(), accountId: opponentAccountId, debit: amount, credit: 0 },  // Debit Cash/Bank
      { id: uuid(), accountId: incomeAccountId, debit: 0, credit: amount },     // Credit Income
    ],
  };

  await db.transactions.add(transaction);
  return transaction;
}

// Create an expense transaction (double-entry)
export async function createExpenseTransaction(params: {
  amount: number;
  counterparty: string;
  expenseAccountId: string;
  opponentAccountId: string;
  description: string;
  date: Date;
  userId: string;
}): Promise<Transaction> {
  const { amount, counterparty, expenseAccountId, opponentAccountId, description, date, userId } = params;

  const transaction: Transaction = {
    id: uuid(),
    date,
    description,
    counterparty,
    type: 'expense',
    createdBy: userId,
    createdAt: new Date(),
    entries: [
      { id: uuid(), accountId: expenseAccountId, debit: amount, credit: 0 },   // Debit Expense
      { id: uuid(), accountId: opponentAccountId, debit: 0, credit: amount },   // Credit Cash/Bank
    ],
  };

  await db.transactions.add(transaction);
  return transaction;
}

// Create a custom double-entry transaction (admin)
export async function createCustomTransaction(params: {
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  description: string;
  date: Date;
  userId: string;
}): Promise<Transaction> {
  const { debitAccountId, creditAccountId, amount, description, date, userId } = params;

  const transaction: Transaction = {
    id: uuid(),
    date,
    description,
    counterparty: '',
    type: 'custom',
    createdBy: userId,
    createdAt: new Date(),
    entries: [
      { id: uuid(), accountId: debitAccountId, debit: amount, credit: 0 },
      { id: uuid(), accountId: creditAccountId, debit: 0, credit: amount },
    ],
  };

  await db.transactions.add(transaction);
  return transaction;
}

// Create an opening balance transaction
export async function createOpeningBalanceTransaction(params: {
  accountId: string;
  amount: number;
  date: Date;
  userId: string;
}): Promise<Transaction> {
  const { accountId, amount, date, userId } = params;
  // Opening balance: debit the asset/cashBank account, credit opening balance equity
  const account = await db.accounts.get(accountId);
  if (!account) throw new Error('Account not found');

  const isDebitNormal = account.type === 'asset' || account.type === 'cashBank' || account.type === 'expense';

  const transaction: Transaction = {
    id: uuid(),
    date,
    description: 'Opening Balance',
    counterparty: '',
    type: 'custom',
    createdBy: userId,
    createdAt: new Date(),
    entries: isDebitNormal
      ? [
          { id: uuid(), accountId, debit: amount, credit: 0 },
          { id: uuid(), accountId: 'acc-opening-balance', debit: 0, credit: amount },
        ]
      : [
          { id: uuid(), accountId, debit: 0, credit: amount },
          { id: uuid(), accountId: 'acc-opening-balance', debit: amount, credit: 0 },
        ],
  };
  await db.transactions.add(transaction);
  return transaction;
}

// Delete a transaction
export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
}

// Calculate account balances from transactions
export async function getAccountBalances(fromDate?: Date, toDate?: Date): Promise<Map<string, { debit: number; credit: number }>> {
  let transactions = await db.transactions.toArray();

  if (fromDate) {
    transactions = transactions.filter(tx => new Date(tx.date) >= fromDate);
  }
  if (toDate) {
    transactions = transactions.filter(tx => new Date(tx.date) <= toDate);
  }

  const balances = new Map<string, { debit: number; credit: number }>();

  for (const tx of transactions) {
    for (const entry of tx.entries) {
      const existing = balances.get(entry.accountId) || { debit: 0, credit: 0 };
      existing.debit += entry.debit;
      existing.credit += entry.credit;
      balances.set(entry.accountId, existing);
    }
  }

  return balances;
}

// Trial Balance
export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export async function generateTrialBalance(asOfDate: Date, lang: Lang = 'en'): Promise<TrialBalanceRow[]> {
  const accounts = await db.accounts.filter(a => a.isActive).toArray();

  // For BS accounts: cumulative to asOfDate
  const bsBalances = await getAccountBalances(undefined, asOfDate);
  // For Income/Expense: YTD (from start of year to asOfDate)
  const yearStart = new Date(asOfDate.getFullYear(), 0, 1);
  const ytdBalances = await getAccountBalances(yearStart, asOfDate);

  const rows: TrialBalanceRow[] = [];

  for (const account of accounts) {
    const isIncomeExpense = account.type === 'income' || account.type === 'expense';
    const bal = isIncomeExpense ? ytdBalances.get(account.id) : bsBalances.get(account.id);
    if (!bal || (bal.debit === 0 && bal.credit === 0)) continue;

    const netDebit = bal.debit - bal.credit;
    const netCredit = bal.credit - bal.debit;

    rows.push({
      accountId: account.id,
      accountCode: account.code,
      accountName: getAccountName(account, lang),
      debit: netDebit > 0 ? netDebit : 0,
      credit: netCredit > 0 ? netCredit : 0,
    });
  }

  return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

// Balance Sheet
export interface BalanceSheetSection {
  label: string;
  items: { accountCode: string; accountName: string; amount: number }[];
  total: number;
}

export interface BalanceSheet {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  retainedEarnings: number;
  totalLiabilitiesAndEquity: number;
}

export async function generateBalanceSheet(toDate: Date, lang: Lang = 'en'): Promise<BalanceSheet> {
  const [accounts, balances] = await Promise.all([
    db.accounts.filter(a => a.isActive).toArray(),
    getAccountBalances(undefined, toDate),
  ]);

  const getAccountLabel = (acc: Account) => getAccountName(acc, lang);

  // Assets (include both 'asset' and 'cashBank' types)
  const assetItems: BalanceSheetSection['items'] = [];
  let assetTotal = 0;

  for (const acc of accounts.filter(a => a.type === 'asset' || a.type === 'cashBank')) {
    const bal = balances.get(acc.id);
    if (!bal || (bal.debit === 0 && bal.credit === 0 && !acc.parentId)) continue;
    if (acc.parentId) {
      const net = bal ? bal.debit - bal.credit : 0;
      if (net !== 0) {
        assetItems.push({ accountCode: acc.code, accountName: getAccountLabel(acc), amount: net });
        assetTotal += net;
      }
    }
  }

  // Liabilities
  const liabilityItems: BalanceSheetSection['items'] = [];
  let liabilityTotal = 0;

  for (const acc of accounts.filter(a => a.type === 'liability')) {
    const bal = balances.get(acc.id);
    if (!bal || (bal.debit === 0 && bal.credit === 0 && !acc.parentId)) continue;
    if (acc.parentId) {
      const net = bal ? bal.credit - bal.debit : 0;
      if (net !== 0) {
        liabilityItems.push({ accountCode: acc.code, accountName: getAccountLabel(acc), amount: net });
        liabilityTotal += net;
      }
    }
  }

  // Equity (Retained Earnings = Total Income - Total Expenses)
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const acc of accounts.filter(a => a.type === 'income')) {
    const bal = balances.get(acc.id);
    if (bal) totalIncome += bal.credit - bal.debit;
  }

  for (const acc of accounts.filter(a => a.type === 'expense')) {
    const bal = balances.get(acc.id);
    if (bal) totalExpenses += bal.debit - bal.credit;
  }

  const retainedEarnings = totalIncome - totalExpenses;

  // Equity accounts
  const equityItems: BalanceSheetSection['items'] = [];
  let equityTotal = 0;

  for (const acc of accounts.filter(a => a.type === 'equity')) {
    const bal = balances.get(acc.id);
    if (!bal || (bal.debit === 0 && bal.credit === 0 && !acc.parentId)) continue;
    if (acc.parentId) {
      const net = bal ? bal.credit - bal.debit : 0;
      if (net !== 0) {
        equityItems.push({ accountCode: acc.code, accountName: getAccountLabel(acc), amount: net });
        equityTotal += net;
      }
    }
  }

  // Add retained earnings
  equityItems.push({
    accountCode: '',
    accountName: lang === 'id' ? 'Laba Ditahan' : lang === 'zh' ? '留存收益' : 'Retained Earnings',
    amount: retainedEarnings,
  });
  equityTotal += retainedEarnings;

  const totalLiabilitiesAndEquity = liabilityTotal + equityTotal;

  return {
    assets: { label: lang === 'id' ? 'Aset' : lang === 'zh' ? '资产' : 'Assets', items: assetItems, total: assetTotal },
    liabilities: { label: lang === 'id' ? 'Kewajiban' : lang === 'zh' ? '负债' : 'Liabilities', items: liabilityItems, total: liabilityTotal },
    equity: { label: lang === 'id' ? 'Modal' : lang === 'zh' ? '权益' : 'Equity', items: equityItems, total: equityTotal },
    retainedEarnings,
    totalLiabilitiesAndEquity,
  };
}

// Profit & Loss
export interface ProfitLossSection {
  items: { accountCode: string; accountName: string; amount: number }[];
  total: number;
}

export interface ProfitLoss {
  income: ProfitLossSection;
  expenses: ProfitLossSection;
  netProfit: number;
}

export async function generateProfitLoss(fromDate: Date, toDate: Date, lang: Lang = 'en'): Promise<ProfitLoss> {
  const [accounts, balances] = await Promise.all([
    db.accounts.filter(a => a.isActive).toArray(),
    getAccountBalances(fromDate, toDate),
  ]);

  const incomeItems: ProfitLossSection['items'] = [];
  let totalIncome = 0;

  for (const acc of accounts.filter(a => a.type === 'income' && a.parentId)) {
    const bal = balances.get(acc.id);
    const net = bal ? bal.credit - bal.debit : 0;
    if (net !== 0) {
      incomeItems.push({ accountCode: acc.code, accountName: getAccountName(acc, lang), amount: net });
      totalIncome += net;
    }
  }

  const expenseItems: ProfitLossSection['items'] = [];
  let totalExpenses = 0;

  for (const acc of accounts.filter(a => a.type === 'expense' && a.parentId)) {
    const bal = balances.get(acc.id);
    const net = bal ? bal.debit - bal.credit : 0;
    if (net !== 0) {
      expenseItems.push({ accountCode: acc.code, accountName: getAccountName(acc, lang), amount: net });
      totalExpenses += net;
    }
  }

  return {
    income: { items: incomeItems, total: totalIncome },
    expenses: { items: expenseItems, total: totalExpenses },
    netProfit: totalIncome - totalExpenses,
  };
}

// Cash Flow
export interface CashFlowItem {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface CashFlow {
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  totalInflows: number;
  totalOutflows: number;
  netChange: number;
  beginningBalance: number;
  endingBalance: number;
}

export async function generateCashFlow(fromDate: Date, toDate: Date, lang: Lang = 'en'): Promise<CashFlow> {
  const [accounts, balances, allBalances] = await Promise.all([
    db.accounts.filter(a => a.isActive).toArray(),
    getAccountBalances(fromDate, toDate),
    getAccountBalances(undefined, undefined),
  ]);

  const cashAccountIds = accounts.filter(a => (a.type === 'asset' || a.type === 'cashBank') && a.parentId).map(a => a.id);

  // Beginning balance (before fromDate)
  const beforeBalances = await getAccountBalances(undefined, new Date(fromDate.getTime() - 1));
  let beginningBalance = 0;
  for (const id of cashAccountIds) {
    const bal = beforeBalances.get(id);
    if (bal) beginningBalance += bal.debit - bal.credit;
  }

  // Cash inflows from income accounts (credits to income accounts)
  const inflows: CashFlowItem[] = [];
  let totalInflows = 0;

  for (const acc of accounts.filter(a => a.type === 'income' && a.parentId)) {
    const bal = balances.get(acc.id);
    const net = bal ? bal.credit - bal.debit : 0;
    if (net > 0) {
      inflows.push({ accountCode: acc.code, accountName: getAccountName(acc, lang), amount: net });
      totalInflows += net;
    }
  }

  // Cash outflows from expense accounts (debits to expense accounts)
  const outflows: CashFlowItem[] = [];
  let totalOutflows = 0;

  for (const acc of accounts.filter(a => a.type === 'expense' && a.parentId)) {
    const bal = balances.get(acc.id);
    const net = bal ? bal.debit - bal.credit : 0;
    if (net > 0) {
      outflows.push({ accountCode: acc.code, accountName: getAccountName(acc, lang), amount: net });
      totalOutflows += net;
    }
  }

  // Opening Balance equity — credits to acc-opening-balance represent cash/bank inflows
  const openingBalAcc = accounts.find(a => a.id === 'acc-opening-balance');
  if (openingBalAcc) {
    const obBal = balances.get('acc-opening-balance');
    if (obBal) {
      const obNet = obBal.credit - obBal.debit;
      if (obNet > 0) {
        inflows.push({ accountCode: openingBalAcc.code, accountName: getAccountName(openingBalAcc, lang), amount: obNet });
        totalInflows += obNet;
      } else if (obNet < 0) {
        outflows.push({ accountCode: openingBalAcc.code, accountName: getAccountName(openingBalAcc, lang), amount: Math.abs(obNet) });
        totalOutflows += Math.abs(obNet);
      }
    }
  }

  const netChange = totalInflows - totalOutflows;

  // Ending balance
  let endingBalance = 0;
  for (const id of cashAccountIds) {
    const bal = allBalances.get(id);
    if (bal) endingBalance += bal.debit - bal.credit;
  }

  return {
    inflows,
    outflows,
    totalInflows,
    totalOutflows,
    netChange,
    beginningBalance,
    endingBalance,
  };
}

// Ledger (per account)
export interface LedgerEntry {
  date: Date;
  description: string;
  counterparty: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function generateLedger(accountId: string, fromDate?: Date, toDate?: Date, lang: Lang = 'en'): Promise<LedgerEntry[]> {
  let transactions = await db.transactions.orderBy('date').toArray();

  if (fromDate) {
    transactions = transactions.filter(tx => new Date(tx.date) >= fromDate);
  }
  if (toDate) {
    transactions = transactions.filter(tx => new Date(tx.date) <= toDate);
  }

  const entries: LedgerEntry[] = [];
  let runningBalance = 0;

  const account = await db.accounts.get(accountId);
  const isDebitNormal = account?.type === 'asset' || account?.type === 'cashBank' || account?.type === 'expense';

  // Calculate beginning balance
  if (fromDate) {
    const allTx = await db.transactions.orderBy('date').toArray();
    const beforeTx = allTx.filter(tx => new Date(tx.date) < fromDate);
    for (const tx of beforeTx) {
      for (const entry of tx.entries) {
        if (entry.accountId === accountId) {
          if (isDebitNormal) {
            runningBalance += entry.debit - entry.credit;
          } else {
            runningBalance += entry.credit - entry.debit;
          }
        }
      }
    }
  }

  for (const tx of transactions) {
    for (const entry of tx.entries) {
      if (entry.accountId === accountId) {
        if (isDebitNormal) {
          runningBalance += entry.debit - entry.credit;
        } else {
          runningBalance += entry.credit - entry.debit;
        }
        entries.push({
          date: tx.date,
          description: tx.description,
          counterparty: tx.counterparty,
          debit: entry.debit,
          credit: entry.credit,
          balance: runningBalance,
        });
      }
    }
  }

  return entries;
}

// Get dashboard summary - derives from account movements (NOT tx.type)
export async function getDashboardSummary() {
  const transactions = await db.transactions.toArray();
  const accounts = await db.accounts.toArray();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let totalBalance = 0;
  let todayIncome = 0;
  let todayExpense = 0;

  // Cash/Bank accounts = asset or cashBank type with parentId
  const cashAccountIds = accounts
    .filter(a => (a.type === 'asset' || a.type === 'cashBank') && a.parentId)
    .map(a => a.id);

  // Income accounts
  const incomeAccountIds = accounts.filter(a => a.type === 'income').map(a => a.id);
  // Expense accounts
  const expenseAccountIds = accounts.filter(a => a.type === 'expense').map(a => a.id);

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    for (const entry of tx.entries) {
      // Total balance (all time)
      if (cashAccountIds.includes(entry.accountId)) {
        totalBalance += entry.debit - entry.credit;
      }

      // Today's income: credits to income accounts
      if (txDate >= todayStart && incomeAccountIds.includes(entry.accountId) && entry.credit > 0) {
        todayIncome += entry.credit;
      }
      // Today's expense: debits to expense accounts
      if (txDate >= todayStart && expenseAccountIds.includes(entry.accountId) && entry.debit > 0) {
        todayExpense += entry.debit;
      }
    }
  }

  const recentTransactions = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return { totalBalance, todayIncome, todayExpense, recentTransactions };
}

// Create a multi-entry custom transaction (admin - spreadsheet-like)
export async function createMultiEntryTransaction(params: {
  entries: { accountId: string; debit: number; credit: number }[];
  description: string;
  date: Date;
  userId: string;
}): Promise<Transaction> {
  const { entries, description, date, userId } = params;

  const transaction: Transaction = {
    id: uuid(),
    date,
    description,
    counterparty: '',
    type: 'custom',
    createdBy: userId,
    createdAt: new Date(),
    entries: entries
      .filter(e => e.debit > 0 || e.credit > 0)
      .map(e => ({ id: uuid(), accountId: e.accountId, debit: e.debit, credit: e.credit })),
  };

  await db.transactions.add(transaction);
  return transaction;
}

// Get the current balance for a single account (for display in account list)
export async function getAccountBalance(accountId: string): Promise<number> {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;

  const balances = await getAccountBalances(undefined, undefined);
  const bal = balances.get(accountId);
  if (!bal) return 0;

  const isDebitNormal = account.type === 'asset' || account.type === 'cashBank' || account.type === 'expense';
  return isDebitNormal ? bal.debit - bal.credit : bal.credit - bal.debit;
}
