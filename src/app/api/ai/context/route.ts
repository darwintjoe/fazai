import { NextRequest, NextResponse } from 'next/server';
import { formatNumber, MONTH_LABELS } from '@/lib/format';

/**
 * POST /api/ai/context
 * Receives financial data from the client (Dexie runs browser-side)
 * and returns a structured context string for the AI chat prompt.
 */

function getAccountName(acc: { name: string; nameId?: string; nameZh?: string }, lang: string): string {
  if (lang === 'id' && acc.nameId) return acc.nameId;
  if (lang === 'zh' && acc.nameZh) return acc.nameZh;
  return acc.name;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      accounts = [],
      recentTransactions = [],
      monthlySummaries = [],
      currentBalance = 0,
      todayIncome = 0,
      todayExpense = 0,
      lang = 'en',
    } = body as {
      accounts: Array<{
        id: string; code: string; name: string; nameId?: string; nameZh?: string;
        type: string; isActive: boolean; parentId?: string;
      }>;
      recentTransactions: Array<{
        id: string; date: string; description: string; counterparty: string;
        type: string; entries: Array<{ accountId: string; debit: number; credit: number }>;
      }>;
      monthlySummaries: Array<{
        accountId: string; year: number; month: number;
        totalDebit: number; totalCredit: number;
      }>;
      currentBalance: number;
      todayIncome: number;
      todayExpense: number;
      lang: string;
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    const fmt = (n: number) => formatNumber(n);

    const lines: string[] = [];

    // Current financial position
    lines.push(`=== CURRENT FINANCIAL POSITION (${now.toLocaleDateString()}) ===`);
    lines.push(`Cash & Bank Balance: ${fmt(currentBalance)}`);
    lines.push(`Today's Income: +${fmt(todayIncome)}`);
    lines.push(`Today's Expense: -${fmt(todayExpense)}`);
    lines.push('');

    // Active accounts
    lines.push(`=== ACCOUNTS (active) ===`);
    const activeAccounts = accounts.filter(a => a.isActive && a.type !== 'asset');
    for (const acc of activeAccounts) {
      const displayName = getAccountName(acc, lang);
      const prefix = acc.type === 'income' ? '[Income]' : acc.type === 'expense' ? '[Expense]' : acc.type === 'cashBank' ? '[Cash/Bank]' : '[Other]';
      lines.push(`  ${prefix} ${displayName} (id: ${acc.id}, code: ${acc.code})`);
    }
    lines.push('');

    // Current month summaries
    const currentMonthSummaries = monthlySummaries.filter(
      s => s.year === currentYear && s.month === now.getMonth()
    );
    if (currentMonthSummaries.length > 0) {
      lines.push(`=== THIS MONTH (${MONTH_LABELS[now.getMonth()]} ${currentYear}) ===`);
      for (const s of currentMonthSummaries) {
        const acc = accounts.find(a => a.id === s.accountId);
        if (!acc || !acc.parentId) continue;
        const displayName = getAccountName(acc, lang);
        if (acc.type === 'income') {
          const amount = s.totalCredit - s.totalDebit;
          if (amount > 0) lines.push(`  [Income] ${displayName}: +${fmt(amount)}`);
        } else if (acc.type === 'expense') {
          const amount = s.totalDebit - s.totalCredit;
          if (amount > 0) lines.push(`  [Expense] ${displayName}: -${fmt(amount)}`);
        } else if (acc.type === 'cashBank') {
          const amount = s.totalDebit - s.totalCredit;
          lines.push(`  [Cash/Bank] ${displayName} change: ${amount >= 0 ? '+' : ''}${fmt(amount)}`);
        }
      }
      lines.push('');
    }

    // Previous month summaries for comparison
    const prevMonthDate = new Date(currentYear, now.getMonth() - 1, 1);
    const prevMonthSummaries = monthlySummaries.filter(
      s => s.year === prevMonthDate.getFullYear() && s.month === prevMonthDate.getMonth()
    );
    if (prevMonthSummaries.length > 0) {
      lines.push(`=== LAST MONTH (${MONTH_LABELS[prevMonthDate.getMonth()]} ${prevMonthDate.getFullYear()}) ===`);
      let prevIncome = 0, prevExpense = 0;
      for (const s of prevMonthSummaries) {
        const acc = accounts.find(a => a.id === s.accountId);
        if (!acc || !acc.parentId) continue;
        if (acc.type === 'income') prevIncome += s.totalCredit - s.totalDebit;
        if (acc.type === 'expense') prevExpense += s.totalDebit - s.totalCredit;
      }
      lines.push(`  Total Income: +${fmt(prevIncome)}`);
      lines.push(`  Total Expense: -${fmt(prevExpense)}`);
      lines.push(`  Net: ${prevIncome - prevExpense >= 0 ? '+' : ''}${fmt(prevIncome - prevExpense)}`);
      lines.push('');
    }

    // Recent transactions (last 15)
    if (recentTransactions.length > 0) {
      lines.push(`=== RECENT TRANSACTIONS (last ${Math.min(recentTransactions.length, 15)}) ===`);
      for (const tx of recentTransactions.slice(0, 15)) {
        const date = new Date(tx.date).toLocaleDateString();
        let amount = 0;
        let txAccountId = '';
        for (const entry of tx.entries) {
          if (entry.debit > 0) {
            const acc = accounts.find(a => a.id === entry.accountId);
            if (acc && acc.type === 'expense') {
              amount = entry.debit;
              txAccountId = entry.accountId;
            }
          }
          if (entry.credit > 0) {
            const acc = accounts.find(a => a.id === entry.accountId);
            if (acc && acc.type === 'income') {
              amount = entry.credit;
              txAccountId = entry.accountId;
            }
          }
        }
        const typeLabel = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '~';
        const acc = accounts.find(a => a.id === txAccountId);
        const accName = acc ? getAccountName(acc, lang) : '';
        const counterparty = tx.counterparty ? ` (${tx.counterparty})` : '';
        lines.push(`  [${date}] ${typeLabel}${fmt(amount)} ${tx.description}${counterparty} [${accName}] (txId: ${tx.id})`);
      }
      lines.push('');
    }

    return NextResponse.json({ context: lines.join('\n') });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI Context error:', message);
    return NextResponse.json({ context: '' });
  }
}
