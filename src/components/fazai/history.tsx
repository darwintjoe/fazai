'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName } from '@/lib/i18n';
import { formatNumber, formatDate } from '@/lib/format';
import { db, type Transaction, type Account } from '@/lib/fazai-db';
import { deleteTransaction } from '@/lib/ledger-engine';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

function useHistoryData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    const txs = await db.transactions.orderBy('date').reverse().toArray();
    setTransactions(txs);
    const accs = await db.accounts.toArray();
    setAccounts(accs);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [loadData]);

  return { transactions, accounts, loadData };
}

export function History() {
  const { lang, userRole } = useAuthStore();
  const { navigate } = useAppStore();
  const { toast } = useToast();
  const { transactions, accounts, loadData } = useHistoryData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'custom'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.counterparty.toLowerCase().includes(q) ||
        tx.entries.some(e => {
          const acc = accounts.find(a => a.id === e.accountId);
          return acc ? getAccountName(acc, lang).toLowerCase().includes(q) : false;
        })
      );
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setDeleteConfirm(null);
    setSelectedTx(null);
    toast({ title: t('common.success', lang) });
    loadData();
  };

  const getTxAmount = (tx: Transaction) => {
    if (tx.type === 'income') {
      return tx.entries.find(e => e.debit > 0 && ['asset', 'cashBank'].includes(accounts.find(a => a.id === e.accountId)?.type || ''))?.debit || 0;
    }
    return tx.entries.find(e => e.credit > 0 && ['asset', 'cashBank'].includes(accounts.find(a => a.id === e.accountId)?.type || ''))?.credit || 0;
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('hist.title', lang)}</h2>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('hist.search', lang)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex gap-1.5">
        {(['all', 'income', 'expense'] as const).map((ft) => (
          <button
            key={ft}
            onClick={() => setFilterType(ft)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterType === ft
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {ft === 'all' ? t('hist.all', lang) : ft === 'income' ? t('dash.income', lang) : t('dash.expense', lang)}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {t('hist.noResults', lang)}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const amount = getTxAmount(tx);
              const primaryAcc = tx.entries.find(e => {
                const acc = accounts.find(a => a.id === e.accountId);
                return acc?.type === 'income' || acc?.type === 'expense';
              });
              const primaryAccObj = primaryAcc ? accounts.find(a => a.id === primaryAcc.accountId) : null;

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => setSelectedTx(tx)}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isIncome ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                  }`}>
                    {isIncome
                      ? <ArrowUpRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                      : <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description || (primaryAccObj ? getAccountName(primaryAccObj, lang) : '')}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {primaryAccObj ? getAccountName(primaryAccObj, lang) : ''}{tx.counterparty ? ` · ${tx.counterparty}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isIncome ? '+' : '-'}{formatNumber(amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(tx.date, lang)}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('hist.detail', lang)}</DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t('form.date', lang)}</p>
                  <p className="font-medium">{formatDate(selectedTx.date, lang)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Type</p>
                  <p className="font-medium capitalize">{selectedTx.type}</p>
                </div>
                {selectedTx.counterparty && (
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {selectedTx.type === 'income' ? t('form.from', lang) : t('form.to', lang)}
                    </p>
                    <p className="font-medium">{selectedTx.counterparty}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">{t('form.description', lang)}</p>
                  <p className="font-medium">{selectedTx.description || '-'}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Journal Entries</p>
                <div className="flex flex-col gap-1">
                  {selectedTx.entries.map((entry) => {
                    const acc = accounts.find(a => a.id === entry.accountId);
                    return (
                      <div key={entry.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">
                          {acc ? getAccountName(acc, lang) : entry.accountId}
                        </span>
                        <div className="flex gap-4">
                          <span className={entry.debit > 0 ? 'font-medium' : 'text-muted-foreground'}>
                            {entry.debit > 0 ? formatNumber(entry.debit) : ''}
                          </span>
                          <span className={entry.credit > 0 ? 'font-medium' : 'text-muted-foreground'}>
                            {entry.credit > 0 ? formatNumber(entry.credit) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-sm font-semibold border-t mt-2 pt-2">
                  <span>{t('rep.total', lang)}</span>
                  <div className="flex gap-4">
                    <span>{formatNumber(selectedTx.entries.reduce((s, e) => s + e.debit, 0))}</span>
                    <span>{formatNumber(selectedTx.entries.reduce((s, e) => s + e.credit, 0))}</span>
                  </div>
                </div>
              </div>
              {userRole === 'admin' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirm(selectedTx.id)}
                  className="self-end"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t('common.delete', lang)}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', lang)}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.cannotUndo', lang)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', lang)}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {t('common.delete', lang)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
