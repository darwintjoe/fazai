'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName } from '@/lib/i18n';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { db, type Account } from '@/lib/fazai-db';
import { createIncomeTransaction, createExpenseTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, CalendarIcon, Search, Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

interface TransactionFormProps {
  type: 'income' | 'expense';
}

export function TransactionForm({ type }: TransactionFormProps) {
  const { lang, userId } = useAuthStore();
  const { navigate } = useAppStore();
  const { toast } = useToast();
  const isIncome = type === 'income';

  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [opponentAccountId, setOpponentAccountId] = useState('acc-cash');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(today());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [opponentAccounts, setOpponentAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [showNewCashBank, setShowNewCashBank] = useState(false);
  const [newCashBankName, setNewCashBankName] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  const loadAccounts = useCallback(async () => {
    const accType = isIncome ? 'income' : 'expense';
    const accs = await db.accounts.where('type').equals(accType).toArray();
    const leafAccs = accs.filter(a => a.parentId && a.isActive);
    setAccounts(leafAccs);

    const cashAccs = await db.accounts.where('type').equals('asset').toArray();
    const cashBankAccs = await db.accounts.where('type').equals('cashBank').toArray();
    const allCashAccs = [...cashAccs, ...cashBankAccs];
    setOpponentAccounts(allCashAccs.filter(a => a.parentId && a.isActive));
  }, [isIncome]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Only show filtered accounts when there's a search query
  const filteredAccounts = searchQuery
    ? accounts.filter(a => {
        const name = getAccountName(a, lang).toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      })
    : [];

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;

    const accType = isIncome ? 'income' : 'expense';
    const existingAccounts = accounts.filter(a => a.type === accType);
    const maxCode = existingAccounts.reduce((max, a) => {
      const parts = a.code.split('-');
      return parts.length > 1 ? Math.max(max, parseInt(parts[1])) : max;
    }, 0);
    const prefix = accType === 'income' ? '4' : '5';
    const newCode = `${prefix}-${String(maxCode + 100).padStart(4, '0')}`;

    const parentId = accType === 'income' ? 'acc-income-root' : 'acc-expense-root';

    const newAccount: Account = {
      id: `acc-${uuid()}`,
      code: newCode,
      name: newAccountName.trim(),
      type: accType,
      parentId,
      isSystem: false,
      isActive: true,
      createdAt: new Date(),
    };

    await db.accounts.add(newAccount);
    setNewAccountName('');
    setShowNewAccount(false);
    await loadAccounts();
    setSelectedAccountId(newAccount.id);
  };

  const handleCreateCashBank = async () => {
    if (!newCashBankName.trim()) return;

    const existingCashBank = opponentAccounts;
    const maxCode = existingCashBank.reduce((max, a) => {
      const parts = a.code.split('-');
      return parts.length > 1 ? Math.max(max, parseInt(parts[1])) : max;
    }, 0);
    const newCode = `1-${String(maxCode + 100).padStart(4, '0')}`;

    const newAccount: Account = {
      id: `acc-${uuid()}`,
      code: newCode,
      name: newCashBankName.trim(),
      type: 'cashBank',
      parentId: 'acc-cashbank-root',
      isSystem: false,
      isActive: true,
      createdAt: new Date(),
    };

    await db.accounts.add(newAccount);
    setNewCashBankName('');
    setShowNewCashBank(false);
    await loadAccounts();
    setOpponentAccountId(newAccount.id);
  };

  const handleAmountChange = (value: string) => {
    const parsed = parseFormattedNumber(value);
    if (!isNaN(parsed) || value === '') {
      setAmount(value === '' ? '' : formatNumber(parsed));
    }
  };

  const handleSave = async () => {
    const numAmount = parseFormattedNumber(amount);
    if (numAmount <= 0 || !selectedAccountId || !opponentAccountId) return;

    setSaving(true);
    try {
      if (isIncome) {
        await createIncomeTransaction({
          amount: numAmount,
          counterparty,
          incomeAccountId: selectedAccountId,
          opponentAccountId,
          description,
          date,
          userId: userId || '',
        });
      } else {
        await createExpenseTransaction({
          amount: numAmount,
          counterparty,
          expenseAccountId: selectedAccountId,
          opponentAccountId,
          description,
          date,
          userId: userId || '',
        });
      }
      toast({ title: t('common.success', lang) });
      navigate('dashboard');
    } catch {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // AI Suggestion
  const fetchAiSuggestion = async () => {
    if (!description && !counterparty) return;
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, counterparty, type, accounts: accounts.map(a => ({ id: a.id, name: getAccountName(a, lang) })) }),
      });
      const data = await res.json();
      if (data.accountId) {
        setAiSuggestion(data.accountName || '');
        setSelectedAccountId(data.accountId);
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('dashboard')} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className={`text-xl font-bold ${isIncome ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
          {isIncome ? t('dash.income', lang) : t('dash.expense', lang)}
        </h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
        {/* Amount */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">{t('form.amount', lang)}</label>
          <Input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            className="text-2xl font-bold h-14 mt-1"
          />
        </div>

        {/* Counterparty */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            {isIncome ? t('form.from', lang) : t('form.to', lang)}
          </label>
          <Input
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder={isIncome ? 'PT Maju Jaya' : 'Grocery Store'}
            className="mt-1"
          />
        </div>

        {/* Account Selection — Hidden until search */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">{t('form.account', lang)}</label>
          {selectedAccountId && (
            <div className="mt-1 mb-2 flex items-center gap-2 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
              <span className="text-sm font-medium">{getAccountName(accounts.find(a => a.id === selectedAccountId)!, lang)}</span>
              <button onClick={() => setSelectedAccountId('')} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
            </div>
          )}
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('form.searchAccount', lang)}
              className="pl-9"
            />
          </div>
          {searchQuery && (
            <div className="flex flex-col gap-1 mt-2 max-h-40 overflow-y-auto">
              {filteredAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => { setSelectedAccountId(acc.id); setSearchQuery(''); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedAccountId === acc.id
                      ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      : 'hover:bg-accent'
                  }`}
                >
                  <span>{getAccountName(acc, lang)}</span>
                </button>
              ))}
              {filteredAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No accounts found</p>
              )}
            </div>
          )}
          <button
            onClick={() => setShowNewAccount(!showNewAccount)}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 mt-2"
          >
            <Plus className="w-3 h-3" />
            {t('form.newAccount', lang)}
          </button>
          {showNewAccount && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Account name"
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAccount()}
              />
              <Button size="sm" onClick={handleCreateAccount} variant="outline">
                {t('form.createAccount', lang)}
              </Button>
            </div>
          )}
        </div>

        {/* Opponent Account (Cash/Bank) */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">{t('form.opponentAccount', lang)}</label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {opponentAccounts.map((acc) => (
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
            <button
              onClick={() => setShowNewCashBank(!showNewCashBank)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {t('form.createCashBank', lang)}
            </button>
          </div>
          {showNewCashBank && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newCashBankName}
                onChange={(e) => setNewCashBankName(e.target.value)}
                placeholder={t('form.newCashBank', lang)}
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCashBank()}
              />
              <Button size="sm" onClick={handleCreateCashBank} variant="outline">
                {t('form.createAccount', lang)}
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">{t('form.description', lang)}</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes..."
            className="mt-1"
            rows={2}
          />
          <button
            onClick={fetchAiSuggestion}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 mt-1"
          >
            <Sparkles className="w-3 h-3" />
            {t('form.aiSuggestion', lang)}
          </button>
          {aiSuggestion && (
            <p className="text-xs text-red-600 mt-1">
              ✨ {aiSuggestion}
            </p>
          )}
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

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving || parseFormattedNumber(amount) <= 0 || !selectedAccountId}
          className={`w-full h-12 text-base font-semibold ${
            isIncome
              ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
              : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
          } text-white`}
        >
          {saving ? t('common.loading', lang) : t('form.save', lang)}
        </Button>
      </motion.div>
    </div>
  );
}
