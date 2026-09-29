'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore, type PendingReceipt } from '@/lib/app-store';
import { t, getAccountName } from '@/lib/i18n';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { db, type Account, type Contact } from '@/lib/fazai-db';
import { createIncomeTransaction, createExpenseTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, CalendarIcon, Search, Plus, Sparkles, Receipt } from 'lucide-react';
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
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [showContactList, setShowContactList] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [opponentAccountId, setOpponentAccountId] = useState('acc-cash');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(today());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [opponentAccounts, setOpponentAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [showNewCashBank, setShowNewCashBank] = useState(false);
  const [newCashBankName, setNewCashBankName] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [fromReceipt, setFromReceipt] = useState(false);

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

  useEffect(() => {
    const q = counterparty.trim().toLowerCase();
    if (!q) {
      setContactResults([]);
      setShowContactList(false);
      setShowAddContact(false);
      return;
    }
    if (contactId) return;
    let cancelled = false;
    (async () => {
      const all = await db.contacts.filter(c => c.isActive).toArray();
      if (cancelled) return;
      const hits = all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phone.includes(q)
      ).slice(0, 8);
      setContactResults(hits);
      setShowContactList(true);
      setShowAddContact(hits.length === 0);
    })();
    return () => { cancelled = true; };
  }, [counterparty, contactId]);

  // Pre-fill from receipt OCR data
  useEffect(() => {
    const pending = useAppStore.getState().pendingReceipt;
    if (!pending) return;

    // Only consume if type matches
    if ((isIncome && pending.amount <= 0 && !pending.counterparty && !pending.description) ||
        (!isIncome && pending.amount <= 0 && !pending.counterparty && !pending.description)) {
      return;
    }

    if (pending.amount > 0) setAmount(formatNumber(pending.amount));
    if (pending.counterparty) setCounterparty(pending.counterparty);
    if (pending.description) setDescription(pending.description);
    if (pending.date) {
      const parsed = new Date(pending.date);
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
    if (pending.accountId) {
      setSelectedAccountId(pending.accountId);
    }
    if (pending.accountName) {
      setAiSuggestion(pending.accountName);
    }
    if (pending.opponentAccountId) {
      setOpponentAccountId(pending.opponentAccountId);
    }

    setFromReceipt(true);
    useAppStore.getState().clearPendingReceipt();
  }, [isIncome]);

  const filteredAccounts = accounts.filter(a => {
    const name = getAccountName(a, lang).toLowerCase();
    return !searchQuery || name.includes(searchQuery.toLowerCase());
  });

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
    const categoryId = accType === 'income' ? 'cat-income' : 'cat-expenses';

    const newAccount: Account = {
      id: `acc-${uuid()}`,
      code: newCode,
      name: newAccountName.trim(),
      type: accType,
      categoryId,
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
      categoryId: 'cat-cashbank',
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
    if (counterparty.trim() && !contactId) return;

    setSaving(true);
    try {
      if (isIncome) {
        await createIncomeTransaction({
          amount: numAmount,
          counterparty: counterparty.trim(),
          contactId,
          incomeAccountId: selectedAccountId,
          opponentAccountId,
          description,
          date,
          userId: userId || '',
        });
      } else {
        await createExpenseTransaction({
          amount: numAmount,
          counterparty: counterparty.trim(),
          contactId,
          expenseAccountId: selectedAccountId,
          opponentAccountId,
          description,
          date,
          userId: userId || '',
        });
      }
      toast({ title: t('common.success', lang) });
      useAppStore.getState().bumpTxVersion();
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
    <div className="flex flex-col gap-4 md:gap-6 pb-20 lg:pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('dashboard')} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className={`text-xl font-bold ${isIncome ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
          {isIncome ? t('dash.income', lang) : t('dash.expense', lang)}
        </h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
        {/* Receipt pre-fill indicator */}
        {fromReceipt && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs">
            <Receipt className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('receipt.fromReceipt', lang)}</span>
            <button onClick={() => setFromReceipt(false)} className="ml-auto hover:text-red-800 dark:hover:text-red-300">✕</button>
          </div>
        )}
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
          {contactId ? (
            <div className="mt-1 flex items-center gap-2 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
              <span className="text-sm font-medium">{counterparty}</span>
              <button onClick={() => { setContactId(null); setCounterparty(''); }} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
            </div>
          ) : (
            <div className="relative mt-1">
              <Input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                onFocus={() => { if (counterparty.trim()) setShowContactList(true); }}
                placeholder={isIncome ? 'PT Maju Jaya' : 'Grocery Store'}
                className="mt-1"
                style={{ color: counterparty ? undefined : 'var(--muted-foreground)' }}
              />
              {showContactList && counterparty.trim() && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {contactResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setContactId(c.id); setCounterparty(c.name); setShowContactList(false); setShowAddContact(false); }}
                      className="flex flex-col w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium">{c.name}</span>
                      {(c.company || c.phone) && (
                        <span className="text-xs text-muted-foreground">{[c.company, c.phone].filter(Boolean).join(' • ')}</span>
                      )}
                    </button>
                  ))}
                  {showAddContact && (
                    <div className="px-3 py-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">No match. Add as new contact?</p>
                      <Input
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Company (optional)"
                        className="text-sm mb-2"
                      />
                      <Input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className="text-sm mb-2"
                      />
                      <Button size="sm" variant="outline" onClick={async () => {
                        const name = counterparty.trim();
                        if (!name) return;
                        const id = `ctc-${uuid()}`;
                        await db.contacts.add({ id, name, company: newCompany.trim(), phone: newPhone.trim(), isActive: true, createdAt: new Date(), updatedAt: new Date() });
                        setContactId(id);
                        setNewCompany('');
                        setNewPhone('');
                        setShowContactList(false);
                        setShowAddContact(false);
                      }}>
                        Add &quot;{counterparty.trim()}&quot;
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                setIsSearchFocused(true);
                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onBlur={() => { setIsSearchFocused(false); setSearchQuery(''); }}
              placeholder={t('form.searchAccount', lang)}
              className="pl-9"
            />
          </div>
          {isSearchFocused && (
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
          className={`w-full md:col-span-2 md:max-w-sm md:ml-auto h-12 text-base font-semibold ${
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
