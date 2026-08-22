'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName } from '@/lib/i18n';
import { formatNumber, formatDate, formatDateTime, parseFormattedNumber } from '@/lib/format';
import { db, type Transaction, type Account } from '@/lib/fazai-db';
import { deleteTransaction, editTransaction } from '@/lib/ledger-engine';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, ArrowUpRight, ArrowDownRight, Trash2, Pencil, CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

function useHistoryData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    const txs = await db.transactions.toArray();
    // Sort by createdAt descending — most recently added on top
    txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

// Resolve the amount + primary (income/expense) account for a transaction
function getTxDetails(tx: Transaction, accounts: Account[]) {
  const isIncome = tx.type === 'income';
  const amount = isIncome
    ? tx.entries.find(e => e.debit > 0 && ['asset', 'cashBank'].includes(accounts.find(a => a.id === e.accountId)?.type || ''))?.debit || 0
    : tx.entries.find(e => e.credit > 0 && ['asset', 'cashBank'].includes(accounts.find(a => a.id === e.accountId)?.type || ''))?.credit || 0;
  const primaryEntry = tx.entries.find(e => {
    const acc = accounts.find(a => a.id === e.accountId);
    return acc?.type === 'income' || acc?.type === 'expense';
  });
  const primaryAccount = primaryEntry ? accounts.find(a => a.id === primaryEntry.accountId) || null : null;
  return { isIncome, amount, primaryAccount };
}

export function History() {
  const { lang, userRole } = useAuthStore();
  const { toast } = useToast();
  const { transactions, accounts, loadData } = useHistoryData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'custom'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

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
    useAppStore.getState().bumpTxVersion();
    loadData();
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
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
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
              const { isIncome, amount, primaryAccount } = getTxDetails(tx, accounts);

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => setSelectedTx(tx)}
                  className={`flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                    tx.isDeleted ? 'opacity-50 grayscale' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isIncome ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {isIncome
                      ? <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                      : <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {tx.description || (primaryAccount ? getAccountName(primaryAccount, lang) : '')}
                      </p>
                      {tx.isDeleted && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">
                          {t('common.deleted', lang)}
                        </span>
                      )}
                      {!tx.isDeleted && tx.isEdited && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-medium">
                          {t('common.edited', lang)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {primaryAccount ? getAccountName(primaryAccount, lang) : ''}{tx.counterparty ? ` · ${tx.counterparty}` : ''}
                    </p>
                    {tx.isDeleted && tx.deletedAt && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 truncate">
                        {t('hist.deletedNote', lang).replace('{time}', formatDateTime(tx.deletedAt, lang))}
                      </p>
                    )}
                    {!tx.isDeleted && tx.isEdited && tx.editedAt && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
                        {t('hist.editedNote', lang).replace('{time}', formatDateTime(tx.editedAt, lang))}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isIncome ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
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
              {selectedTx.isDeleted && selectedTx.deletedAt && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2">
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                    {t('hist.deletedNote', lang).replace('{time}', formatDateTime(selectedTx.deletedAt, lang))}
                  </p>
                </div>
              )}
              {!selectedTx.isDeleted && selectedTx.isEdited && selectedTx.editedAt && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 px-3 py-2">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {t('hist.editedNote', lang).replace('{time}', formatDateTime(selectedTx.editedAt, lang))}
                  </p>
                </div>
              )}
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
              {userRole === 'admin' && !selectedTx.isDeleted && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingTx(selectedTx); }}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    {t('common.edit', lang)}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirm(selectedTx.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t('common.delete', lang)}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingTx && (
        <TransactionEditDialog
          tx={editingTx}
          accounts={accounts}
          onClose={() => setEditingTx(null)}
          onSaved={() => {
            setEditingTx(null);
            setSelectedTx(null);
            toast({ title: t('hist.editSuccess', lang) });
            useAppStore.getState().bumpTxVersion();
            loadData();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', lang)}</AlertDialogTitle>
            <AlertDialogDescription>{t('hist.deletedConfirmDesc', lang)}</AlertDialogDescription>
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

// ============================================
// Edit Dialog (admin only — invoked from the detail dialog)
// ============================================

interface EditDialogProps {
  tx: Transaction;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}

function TransactionEditDialog({ tx, accounts, onClose, onSaved }: EditDialogProps) {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const isIncomeOrExpense = tx.type === 'income' || tx.type === 'expense';

  // Pre-fill from the existing transaction
  const { amount: originalAmount, primaryAccount: originalPrimary } = getTxDetails(tx, accounts);
  const originalOpponent = tx.entries.find(e => {
    const acc = accounts.find(a => a.id === e.accountId);
    return acc?.type === 'asset' || acc?.type === 'cashBank';
  });

  const [amount, setAmount] = useState(formatNumber(originalAmount));
  const [counterparty, setCounterparty] = useState(tx.counterparty || '');
  const [description, setDescription] = useState(tx.description || '');
  const [date, setDate] = useState<Date>(new Date(tx.date));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable category account (income/expense)
  const [primaryAccountId, setPrimaryAccountId] = useState(originalPrimary?.id || '');
  // Editable cash/bank account
  const [opponentAccountId, setOpponentAccountId] = useState(originalOpponent?.accountId || 'acc-cash');

  // Editable account pools for income/expense flows
  const categoryAccounts = accounts.filter(a =>
    a.parentId && a.isActive && a.type === (tx.type === 'income' ? 'income' : 'expense')
  );
  const cashAccounts = accounts.filter(a =>
    a.parentId && a.isActive && (a.type === 'asset' || a.type === 'cashBank')
  );

  const handleSave = async () => {
    const numAmount = parseFormattedNumber(amount);
    if (numAmount <= 0) {
      toast({ title: t('common.error', lang), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await editTransaction(tx.id, {
        amount: numAmount,
        counterparty,
        description,
        date,
        primaryAccountId: isIncomeOrExpense ? primaryAccountId : undefined,
        opponentAccountId: isIncomeOrExpense ? opponentAccountId : undefined,
      });
      onSaved();
    } catch (_err) {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('hist.editTransaction', lang)}</DialogTitle>
          <DialogDescription>{t('hist.editTransactionDesc', lang)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('form.amount', lang)}
            </label>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(formatNumber(parseFormattedNumber(e.target.value)))}
              className="mt-1 text-lg font-semibold"
            />
          </div>

          {/* Counterparty */}
          {(tx.type === 'income' || tx.type === 'expense') && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {tx.type === 'income' ? t('form.from', lang) : t('form.to', lang)}
              </label>
              <Input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {/* Category account (income/expense) */}
          {isIncomeOrExpense && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('form.account', lang)}
              </label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {categoryAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setPrimaryAccountId(acc.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      primaryAccountId === acc.id
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {getAccountName(acc, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cash/Bank account */}
          {isIncomeOrExpense && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('form.opponentAccount', lang)}</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {cashAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setOpponentAccountId(acc.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      opponentAccountId === acc.id
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {getAccountName(acc, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('form.description', lang)}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('form.date', lang)}</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date.toLocaleDateString(lang === 'id' ? 'id-ID' : lang === 'zh' ? 'zh-CN' : 'en-US')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { if (d) { setDate(d); setCalendarOpen(false); } }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('common.cancel', lang)}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || parseFormattedNumber(amount) <= 0}>
              {t('common.save', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
