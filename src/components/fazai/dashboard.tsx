'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName, type Lang } from '@/lib/i18n';
import { formatNumber, formatDate } from '@/lib/format';
import { getDashboardSummary } from '@/lib/ledger-engine';
import { db, type Transaction, type Account } from '@/lib/fazai-db';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';

function useDashboardData(lang: Lang) {
  const [balance, setBalance] = useState(0);
  const [todayIncome, setTodayIncome] = useState(0);
  const [todayExpense, setTodayExpense] = useState(0);
  const [recentTx, setRecentTx] = useState<(Transaction & { accountName?: string })[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const refresh = useCallback(async () => {
    const summary = await getDashboardSummary();
    setBalance(summary.totalBalance);
    setTodayIncome(summary.todayIncome);
    setTodayExpense(summary.todayExpense);

    const accs = await db.accounts.toArray();
    setAccounts(accs);

    const enriched = summary.recentTransactions.map(tx => {
      const incomeEntry = tx.entries.find(e => {
        const acc = accs.find(a => a.id === e.accountId);
        return acc?.type === 'income' || acc?.type === 'expense';
      });
      const acc = incomeEntry ? accs.find(a => a.id === incomeEntry.accountId) : undefined;
      return { ...tx, accountName: acc ? getAccountName(acc, lang) : '' };
    });
    setRecentTx(enriched);
  }, [lang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { balance, todayIncome, todayExpense, recentTx, accounts, refresh };
}

export function Dashboard() {
  const { lang, userRole } = useAuthStore();
  const { navigate } = useAppStore();
  const { balance, todayIncome, todayExpense, recentTx, accounts } = useDashboardData(lang);

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl shadow-lg border-0">
          <p className="text-xs opacity-90">{t('dash.balance', lang)}</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(balance)}</p>
          <div className="flex gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-200" />
              <div>
                <p className="text-[10px] opacity-80">{t('dash.income', lang)}</p>
                <p className="text-xs font-semibold">{formatNumber(todayIncome)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-red-200" />
              <div>
                <p className="text-[10px] opacity-80">{t('dash.expense', lang)}</p>
                <p className="text-xs font-semibold">{formatNumber(todayExpense)}</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Income/Expense Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('income')}
          className="flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-4 shadow-md min-h-[100px] active:scale-95 transition-transform"
        >
          <TrendingUp className="w-7 h-7" />
          <span className="text-base font-bold">{t('dash.income', lang)}</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('expense')}
          className="flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-2xl p-4 shadow-md min-h-[100px] active:scale-95 transition-transform"
        >
          <TrendingDown className="w-7 h-7" />
          <span className="text-base font-bold">{t('dash.expense', lang)}</span>
        </motion.button>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-semibold">{t('dash.recentTransactions', lang)}</h3>
          <button
            onClick={() => navigate('history')}
            className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
          >
            {t('common.search', lang)} <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {recentTx.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('dash.noTransactions', lang)}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recentTx.map((tx) => {
              const isIncome = tx.type === 'income';
              const amount = isIncome
                ? tx.entries.find(e => e.debit > 0 && ['asset', 'cashBank'].includes(accounts.find(a => a.id === e.accountId)?.type || ''))?.debit || 0
                : tx.entries.find(e => e.credit > 0 && ['asset', 'cashBank'].includes(accounts.find(a => a.id === e.accountId)?.type || ''))?.credit || 0;

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    useAppStore.getState().setSelectedTransactionId(tx.id);
                    navigate('history');
                  }}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isIncome ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                  }`}>
                    {isIncome
                      ? <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                      : <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.accountName || tx.counterparty}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {tx.accountName}{tx.counterparty ? ` · ${tx.counterparty}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isIncome ? '+' : '-'}{formatNumber(amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(tx.date, lang)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
