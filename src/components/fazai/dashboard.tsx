'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName, type Lang } from '@/lib/i18n';
import { formatNumber, formatDate } from '@/lib/format';
import { getDashboardSummary } from '@/lib/ledger-engine';
import { db, type Transaction, type Account } from '@/lib/fazai-db';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronRight, Download, Camera, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { usePwaInstall } from '@/hooks/use-pwa-install';

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
  const { lang } = useAuthStore();
  const { navigate, txVersion, toggleAiChat } = useAppStore();
  const { balance, todayIncome, todayExpense, recentTx, accounts, refresh } = useDashboardData(lang);
  const { isInstallable, promptInstall } = usePwaInstall();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-fetch data when txVersion changes (transaction created/deleted elsewhere)
  useEffect(() => {
    if (txVersion > 0) {
      refresh();
    }
  }, [txVersion, refresh]);

  /** Handle camera/gallery file selection — store in Cache API and navigate to OCR */
  const handleImageSelected = useCallback(async (file: File) => {
    try {
      const cache = await caches.open('shared-files');
      const response = new Response(file);
      // Store with the same key the service worker uses
      await cache.put('/shared-image-0', response);
      // Also store a count metadata entry (ReceiptOcr may expect this)
      await cache.put('/shared-count', new Response('1'));
      navigate('share-target');
    } catch (err) {
      console.error('Failed to store image for OCR:', err);
    }
  }, [navigate]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelected(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleImageSelected]);

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* PWA Install Banner */}
      {isInstallable && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border border-red-200 dark:border-red-800 rounded-xl"
        >
          <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {lang === 'id' ? 'Instal FAZAI' : lang === 'zh' ? '安装 FAZAI' : 'Install FAZAI'}
            </p>
            <p className="text-[11px] text-red-600/70 dark:text-red-400/70">
              {lang === 'id' ? 'Akses cepat dari layar utama' : lang === 'zh' ? '添加到主屏幕快速访问' : 'Add to home screen for quick access'}
            </p>
          </div>
          <button
            onClick={promptInstall}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all shrink-0"
          >
            {lang === 'id' ? 'Instal' : lang === 'zh' ? '安装' : 'Install'}
          </button>
        </motion.div>
      )}

      {/* Balance Card with embedded AI + Camera side icons */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative bg-gradient-to-br from-red-600 to-red-700 text-white p-5 rounded-2xl shadow-lg border-0 overflow-hidden">
          {/* Subtle decorative circle for depth */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />

          <div className="relative">
            <p className="text-xs opacity-90">{t('dash.balance', lang)}</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">{formatNumber(balance)}</p>
            <div className="flex gap-6 mt-3">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-red-200" />
                <div>
                  <p className="text-[10px] opacity-80">{t('dash.income', lang)}</p>
                  <p className="text-xs font-semibold">{formatNumber(todayIncome)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 text-white/60" />
                <div>
                  <p className="text-[10px] opacity-80">{t('dash.expense', lang)}</p>
                  <p className="text-xs font-semibold">{formatNumber(todayExpense)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Transparent side-menu icons — right side of card */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('dash.scanReceipt', lang)}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={toggleAiChat}
              title={t('ai.title', lang)}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <MessageCircle className="w-4 h-4 text-white" />
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Income / Expense — dominant action cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('income')}
          className="flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl p-5 shadow-md min-h-[120px] transition-transform"
        >
          <TrendingUp className="w-8 h-8" />
          <span className="text-base font-bold">{t('dash.income', lang)}</span>
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('expense')}
          className="flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl p-5 shadow-md min-h-[120px] transition-transform"
        >
          <TrendingDown className="w-8 h-8" />
          <span className="text-base font-bold">{t('dash.expense', lang)}</span>
        </motion.button>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-semibold">{t('dash.recentTransactions', lang)}</h3>
          <button
            onClick={() => navigate('history')}
            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-0.5"
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
                    isIncome ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {isIncome
                      ? <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                      : <ArrowDownRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.accountName || tx.counterparty}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {tx.accountName}{tx.counterparty ? ` · ${tx.counterparty}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isIncome ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
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
