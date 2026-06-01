import Dexie from 'dexie';
import { db, type Account, type Transaction, type Entry, type AccountMonthlySummary, type ArchivedTransaction } from './fazai-db';
import { getAccountName } from './i18n';
import type { Lang } from './i18n';
import { v4 as uuid } from 'uuid';

// ============================================
// Date Helpers
// ============================================

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function isCurrentMonth(year: number, month: number): boolean {
  const { year: cy, month: cm } = getCurrentYearMonth();
  return year === cy && month === cm;
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

function* monthRange(fromYear: number, fromMonth: number, toYear: number, toMonth: number) {
  let y = fromYear, m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    yield { year: y, month: m };
    if (m === 11) { y++; m = 0; } else { m++; }
  }
}

function summaryId(accountId: string, year: number, month: number): string {
  return `${accountId}-${year}-${month}`;
}

// ============================================
// Monthly Summary Calculation
// ============================================

async function calculateMonthlySummary(accountId: string, year: number, month: number): Promise<AccountMonthlySummary | null> {
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);

  // Include both live and archived transactions for this month
  const [liveTx, archivedTx] = await Promise.all([
    db.transactions.where('date').between(from, to, true, true).toArray(),
    db.archivedTransactions.where('date').between(from, to, true, true).toArray(),
  ]);

  const allTx = [...liveTx, ...archivedTx];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const tx of allTx) {
    for (const entry of tx.entries) {
      if (entry.accountId === accountId) {
        totalDebit += entry.debit;
        totalCredit += entry.credit;
      }
    }
  }

  if (totalDebit === 0 && totalCredit === 0) return null;

  return {
    id: summaryId(accountId, year, month),
    accountId,
    year,
    month,
    totalDebit,
    totalCredit,
    lastCalculated: new Date(),
  };
}

async function recalculateMonthlySummary(accountId: string, year: number, month: number): Promise<void> {
  const result = await calculateMonthlySummary(accountId, year, month);
  const id = summaryId(accountId, year, month);
  if (result) {
    await db.accountMonthlySummaries.put(result);
  } else {
    await db.accountMonthlySummaries.delete(id);
  }
}

/** Rollover: ensure all past months have summaries calculated */
async function rolloverSummaries(): Promise<void> {
  const { year: curYear, month: curMonth } = getCurrentYearMonth();

  // Find the earliest transaction date across both tables
  const [firstLive, firstArchived] = await Promise.all([
    db.transactions.orderBy('date').first(),
    db.archivedTransactions.orderBy('date').first(),
  ]);

  const earliest = [firstLive, firstArchived]
    .filter(Boolean)
    .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime())[0];

  if (!earliest) return;

  const startYear = new Date(earliest.date).getFullYear();
  const startMonth = new Date(earliest.date).getMonth();
  const { year: endYear, month: endMonth } = previousMonth(curYear, curMonth);

  // Don't process if no past months to summarize
  if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) return;

  // Get existing summary IDs
  const existingIds = new Set((await db.accountMonthlySummaries.toArray()).map(s => s.id));

  // Get active accounts
  const accounts = await db.accounts.filter(a => a.isActive).toArray();

  // Calculate summaries for missing months
  for (const { year, month } of monthRange(startYear, startMonth, endYear, endMonth)) {
    for (const account of accounts) {
      const id = summaryId(account.id, year, month);
      if (!existingIds.has(id)) {
        const result = await calculateMonthlySummary(account.id, year, month);
        if (result) {
          await db.accountMonthlySummaries.put(result);
        }
      }
    }
  }
}

/** Archive transactions older than 6 months to cold storage */
async function archiveOldTransactions(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1, 0, 0, 0, 0);

  const oldTx = await db.transactions.where('date').below(cutoff).toArray();
  if (oldTx.length === 0) return;

  const archived: ArchivedTransaction[] = oldTx.map(tx => ({
    ...tx,
    archivedAt: new Date(),
  }));

  await db.transaction('rw', [db.transactions, db.archivedTransactions], async () => {
    await db.archivedTransactions.bulkAdd(archived);
    const ids = oldTx.map(tx => tx.id);
    await db.transactions.bulkDelete(ids);
  });
}

/** Run startup maintenance: rollover summaries, then archive, then re-rollover */
export async function runStartupMaintenance(): Promise<void> {
  try {
    await rolloverSummaries();
    await archiveOldTransactions();
    await rolloverSummaries(); // Re-rollover after archive to update summaries
  } catch (e) {
    console.error('Startup maintenance error:', e);
  }
}

// ============================================
// Account Balances (with monthly summary support)
// ============================================

/** Get account balances for a date range, using summaries for past months */
async function getAccountBalancesOptimized(fromDate: Date, toDate: Date): Promise<Map<string, { debit: number; credit: number }>> {
  const { year: curYear, month: curMonth } = getCurrentYearMonth();
  const fromYM = { year: fromDate.getFullYear(), month: fromDate.getMonth() };
  const toYM = { year: toDate.getFullYear(), month: toDate.getMonth() };

  const balances = new Map<string, { debit: number; credit: number }>();
  const addBalance = (accountId: string, debit: number, credit: number) => {
    if (debit === 0 && credit === 0) return;
    const existing = balances.get(accountId) || { debit: 0, credit: 0 };
    existing.debit += debit;
    existing.credit += credit;
    balances.set(accountId, existing);
  };

  // 1. Use summaries for past (non-current) months in the range
  for (const { year, month } of monthRange(fromYM.year, fromYM.month, toYM.year, toYM.month)) {
    if (isCurrentMonth(year, month)) continue; // Skip current month - use live tx

    const summaries = await db.accountMonthlySummaries
      .where('[accountId+year+month]')
      .between([Dexie.minKey, year, month], [Dexie.maxKey, year, month])
      .toArray();

    for (const s of summaries) {
      if (s.year === year && s.month === month) {
        addBalance(s.accountId, s.totalDebit, s.totalCredit);
      }
    }
  }

  // 2. For current month (if in range), use live transactions
  if ((curYear > fromYM.year || (curYear === fromYM.year && curMonth >= fromYM.month)) &&
      (curYear < toYM.year || (curYear === toYM.year && curMonth <= toYM.month))) {
    const curFrom = startOfMonth(curYear, curMonth);
    const effectiveFrom = fromDate > curFrom ? fromDate : curFrom;
    const effectiveTo = toDate < new Date() ? toDate : new Date();

    const liveTx = await db.transactions.where('date').between(effectiveFrom, effectiveTo, true, true).toArray();
    for (const tx of liveTx) {
      for (const entry of tx.entries) {
        addBalance(entry.accountId, entry.debit, entry.credit);
      }
    }
  }

  return balances;
}

/** Get cumulative account balances up to a date (for Balance Sheet, Trial Balance) */
async function getCumulativeBalances(toDate: Date): Promise<Map<string, { debit: number; credit: number }>> {
  const summaries = await db.accountMonthlySummaries.toArray();
  const balances = new Map<string, { debit: number; credit: number }>();
  const addBalance = (accountId: string, debit: number, credit: number) => {
    if (debit === 0 && credit === 0) return;
    const existing = balances.get(accountId) || { debit: 0, credit: 0 };
    existing.debit += debit;
    existing.credit += credit;
    balances.set(accountId, existing);
  };

  const { year: curYear, month: curMonth } = getCurrentYearMonth();

  // 1. Summaries for all past months up to toDate
  for (const s of summaries) {
    const summaryEnd = new Date(s.year, s.month + 1, 0); // last day of that month
    if (summaryEnd <= toDate && !isCurrentMonth(s.year, s.month)) {
      addBalance(s.accountId, s.totalDebit, s.totalCredit);
    }
  }

  // 2. Current month live transactions up to toDate
  const curFrom = startOfMonth(curYear, curMonth);
  if (toDate >= curFrom) {
    const effectiveTo = toDate < new Date() ? toDate : new Date();
    const liveTx = await db.transactions.where('date').between(curFrom, effectiveTo, true, true).toArray();
    for (const tx of liveTx) {
      for (const entry of tx.entries) {
        addBalance(entry.accountId, entry.debit, entry.credit);
      }
    }
  }

  return balances;
}

/** Get balances up to end of previous month (for beginning balance calculation) */
async function getBeginningBalances(toDate: Date): Promise<Map<string, { debit: number; credit: number }>> {
  const prev = previousMonth(toDate.getFullYear(), toDate.getMonth());
  return getCumulativeBalances(endOfMonth(prev.year, prev.month));
}

// ============================================
// Legacy compatibility (fallback for simple queries)
// ============================================

/** Calculate account balances from transactions (legacy - scans all) */
export async function getAccountBalances(fromDate?: Date, toDate?: Date): Promise<Map<string, { debit: number; credit: number }>> {
  // Use optimized path when possible
  if (fromDate && toDate) {
    return getAccountBalancesOptimized(fromDate, toDate);
  }
  if (!fromDate && toDate) {
    return getCumulativeBalances(toDate);
  }

  // Full scan fallback (for dashboard etc.)
  const transactions = await db.transactions.toArray();

  const filtered = transactions.filter(tx => {
    const d = new Date(tx.date);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  const balances = new Map<string, { debit: number; credit: number }>();
  for (const tx of filtered) {
    for (const entry of tx.entries) {
      const existing = balances.get(entry.accountId) || { debit: 0, credit: 0 };
      existing.debit += entry.debit;
      existing.credit += entry.credit;
      balances.set(entry.accountId, existing);
    }
  }

  return balances;
}

// ============================================
// Transaction Creation (with summary update)
// ============================================

/** Create an income transaction (double-entry) */
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
      { id: uuid(), accountId: opponentAccountId, debit: amount, credit: 0 },
      { id: uuid(), accountId: incomeAccountId, debit: 0, credit: amount },
    ],
  };

  await db.transactions.add(transaction);

  // Update monthly summary for the transaction's month
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  await Promise.all([
    recalculateMonthlySummary(incomeAccountId, year, month),
    recalculateMonthlySummary(opponentAccountId, year, month),
  ]);

  return transaction;
}

/** Create an expense transaction (double-entry) */
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
      { id: uuid(), accountId: expenseAccountId, debit: amount, credit: 0 },
      { id: uuid(), accountId: opponentAccountId, debit: 0, credit: amount },
    ],
  };

  await db.transactions.add(transaction);

  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  await Promise.all([
    recalculateMonthlySummary(expenseAccountId, year, month),
    recalculateMonthlySummary(opponentAccountId, year, month),
  ]);

  return transaction;
}

/** Create a custom double-entry transaction (admin) */
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

  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  await Promise.all([
    recalculateMonthlySummary(debitAccountId, year, month),
    recalculateMonthlySummary(creditAccountId, year, month),
  ]);

  return transaction;
}

/** Create an opening balance transaction */
export async function createOpeningBalanceTransaction(params: {
  accountId: string;
  amount: number;
  date: Date;
  userId: string;
}): Promise<Transaction> {
  const { accountId, amount, date, userId } = params;
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

  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  await Promise.all([
    recalculateMonthlySummary(accountId, year, month),
    recalculateMonthlySummary('acc-opening-balance', year, month),
  ]);

  return transaction;
}

/** Delete a transaction */
export async function deleteTransaction(id: string): Promise<void> {
  const tx = await db.transactions.get(id);
  if (!tx) return;

  await db.transactions.delete(id);

  // Recalculate summaries for affected accounts
  const year = new Date(tx.date).getFullYear();
  const month = new Date(tx.date).getMonth();
  const accountIds = [...new Set(tx.entries.map(e => e.accountId))];
  await Promise.all(accountIds.map(aid => recalculateMonthlySummary(aid, year, month)));
}

// ============================================
// Reports
// ============================================

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

  const bsBalances = await getCumulativeBalances(asOfDate);
  const yearStart = new Date(asOfDate.getFullYear(), 0, 1);
  const ytdBalances = await getAccountBalancesOptimized(yearStart, asOfDate);

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
    getCumulativeBalances(toDate),
  ]);

  const getAccountLabel = (acc: Account) => getAccountName(acc, lang);

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
    getAccountBalancesOptimized(fromDate, toDate),
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
  const [accounts, balances] = await Promise.all([
    db.accounts.filter(a => a.isActive).toArray(),
    getAccountBalancesOptimized(fromDate, toDate),
  ]);

  const cashAccountIds = accounts.filter(a => (a.type === 'asset' || a.type === 'cashBank') && a.parentId).map(a => a.id);

  const beforeBalances = await getBeginningBalances(fromDate);
  let beginningBalance = 0;
  for (const id of cashAccountIds) {
    const bal = beforeBalances.get(id);
    if (bal) beginningBalance += bal.debit - bal.credit;
  }

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

  const allBalances = await getCumulativeBalances(toDate);
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
  // Get live transactions for this account
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

  // Calculate beginning balance using summaries + live tx
  if (fromDate) {
    const prevBalances = await getBeginningBalances(fromDate);
    const bal = prevBalances.get(accountId);
    if (bal) {
      runningBalance = isDebitNormal ? bal.debit - bal.credit : bal.credit - bal.debit;
    }
  } else {
    // Calculate from all summaries + all live tx
    const allBalances = await getCumulativeBalances(new Date());
    const bal = allBalances.get(accountId);
    if (bal) {
      runningBalance = isDebitNormal ? bal.debit - bal.credit : bal.credit - bal.debit;
    }
    // Reset since we'll recalculate
    runningBalance = 0;
    const allTx = await db.transactions.orderBy('date').toArray();
    for (const tx of allTx) {
      for (const entry of tx.entries) {
        if (entry.accountId === accountId) {
          runningBalance += isDebitNormal ? entry.debit - entry.credit : entry.credit - entry.debit;
        }
      }
    }
    return entries.length > 0 ? entries : [];
  }

  for (const tx of transactions) {
    for (const entry of tx.entries) {
      if (entry.accountId === accountId) {
        runningBalance += isDebitNormal ? entry.debit - entry.credit : entry.credit - entry.debit;
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

// Dashboard summary
export async function getDashboardSummary() {
  const transactions = await db.transactions.toArray();
  const accounts = await db.accounts.toArray();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let totalBalance = 0;
  let todayIncome = 0;
  let todayExpense = 0;

  const cashAccountIds = accounts
    .filter(a => (a.type === 'asset' || a.type === 'cashBank') && a.parentId)
    .map(a => a.id);

  const incomeAccountIds = accounts.filter(a => a.type === 'income').map(a => a.id);
  const expenseAccountIds = accounts.filter(a => a.type === 'expense').map(a => a.id);

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    for (const entry of tx.entries) {
      if (cashAccountIds.includes(entry.accountId)) {
        totalBalance += entry.debit - entry.credit;
      }
      if (txDate >= todayStart && incomeAccountIds.includes(entry.accountId) && entry.credit > 0) {
        todayIncome += entry.credit;
      }
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

// Multi-entry custom transaction (admin)
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

  // Update monthly summaries for all involved accounts
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  const accountIds = [...new Set(entries.map(e => e.accountId))];
  await Promise.all(accountIds.map(aid => recalculateMonthlySummary(aid, year, month)));

  return transaction;
}

// Get the current balance for a single account
export async function getAccountBalance(accountId: string): Promise<number> {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;

  const balances = await getCumulativeBalances(new Date());
  const bal = balances.get(accountId);
  if (!bal) return 0;

  const isDebitNormal = account.type === 'asset' || account.type === 'cashBank' || account.type === 'expense';
  return isDebitNormal ? bal.debit - bal.credit : bal.credit - bal.debit;
}
