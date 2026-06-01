'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { createMultiEntryTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Search } from 'lucide-react';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuid } from 'uuid';

const ACCOUNT_TYPE_ORDER = ['asset', 'cashBank', 'liability', 'equity', 'income', 'expense'] as const;

interface JournalRow {
  id: string;
  accountId: string;
  amount: string;     // single value
  isDebit: boolean;   // true = Dr, false = Cr
}

export function AdminCustomEntry() {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([
    { id: crypto.randomUUID(), accountId: '', amount: '', isDebit: true },
    { id: crypto.randomUUID(), accountId: '', amount: '', isDebit: false },
  ]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(today());
  const [calOpen, setCalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Track which row triggered "Add New" so we can fill it after creation
  const [addNewForRow, setAddNewForRow] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [showNewAccount, setShowNewAccount] = useState<string | null>(null);
  const newAccountInputRef = useRef<HTMLInputElement>(null);

  const loadAccounts = useCallback(async () => {
    const accs = await db.accounts.filter(a => a.isActive).toArray();
    setAccounts(accs.filter(a => a.parentId));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Auto-focus the new account input when shown
  useEffect(() => {
    if (showNewAccount && newAccountInputRef.current) {
      newAccountInputRef.current.focus();
    }
  }, [showNewAccount]);

  const addRow = () => {
    setRows(prev => [...prev, { id: crypto.randomUUID(), accountId: '', amount: '', isDebit: false }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 2) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof JournalRow, value: string | boolean) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const toggleDrCr = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, isDebit: !r.isDebit } : r));
  };

  // Calculate totals
  const totalDebit = rows.reduce((sum, r) => {
    const val = parseFormattedNumber(r.amount);
    return sum + (r.isDebit ? val : 0);
  }, 0);
  const totalCredit = rows.reduce((sum, r) => {
    const val = parseFormattedNumber(r.amount);
    return sum + (!r.isDebit ? val : 0);
  }, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const difference = totalDebit - totalCredit;

  /** Get the natural opposing account for a given account */
  const getOpposingAccount = useCallback((accountId: string): string | null => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return null;

    // For expense/income accounts, the opposing is the default cash/bank account
    if (acc.type === 'expense' || acc.type === 'income') {
      // Prefer "Cash on Hand", then "Bank Account", then first cashBank child
      const cashOnHand = accounts.find(a => a.id === 'acc-cash');
      if (cashOnHand) return cashOnHand.id;
      const bank = accounts.find(a => a.id === 'acc-bank');
      if (bank) return bank.id;
      const firstCashBank = accounts.find(a => a.type === 'cashBank' && a.parentId);
      if (firstCashBank) return firstCashBank.id;
    }

    // For cash/bank accounts, the opposing depends on context:
    // If paired with an expense (debit), cash is credit → opposing is the expense
    // If paired with an income (credit), cash is debit → opposing is the income
    // This is harder to auto-detect, so we skip for cash/bank as primary
    if (acc.type === 'cashBank') {
      return null;
    }

    return null;
  }, [accounts]);

  /** Handle account selection — auto-suggest opposing account and Dr/Cr */
  const handleAccountSelect = (rowId: string, accountId: string) => {
    // Check if user selected "Add New"
    if (accountId.startsWith('__new_')) {
      const accType = accountId.replace('__new_', '');
      setAddNewForRow(rowId); // remember which row triggered this
      setShowNewAccount(accType);
      setNewAccountName('');
      return;
    }

    // Set the account for this row
    setRows(prev => {
      const newRows = prev.map(r => r.id === rowId ? { ...r, accountId } : r);

      // Auto-set Dr/Cr based on account type
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        const row = newRows.find(r => r.id === rowId);
        if (row) {
          // Income → Cr, Expense → Dr, CashBank → Dr (for receiving) or Cr (for paying)
          if (acc.type === 'income') {
            row.isDebit = false; // Income is always Credit
          } else if (acc.type === 'expense') {
            row.isDebit = true; // Expense is always Debit
          } else if (acc.type === 'cashBank') {
            // Default to Dr (receiving cash), user can toggle
            row.isDebit = true;
          } else if (acc.type === 'asset') {
            row.isDebit = true;
          } else if (acc.type === 'liability' || acc.type === 'equity') {
            row.isDebit = false;
          }
        }

        // Auto-suggest opposing account in empty rows
        const opposingId = getOpposingAccount(accountId);
        if (opposingId) {
          // Find a row with no account set, fill it with the opposing account
          const emptyRow = newRows.find(r => !r.accountId && r.id !== rowId);
          if (emptyRow) {
            emptyRow.accountId = opposingId;
            // Set the Dr/Cr opposite to the current row
            const currentRow = newRows.find(r => r.id === rowId);
            if (currentRow) {
              emptyRow.isDebit = !currentRow.isDebit;
            }
          }
        }
      }

      return newRows;
    });
  };

  // Auto-fill remaining balance when amounts change (auto-suggest without button)
  useEffect(() => {
    if (Math.abs(difference) < 0.01 || totalDebit === 0) return;

    // Find rows with empty amounts but have an account selected
    const emptyAmountRows = rows.filter(r => parseFormattedNumber(r.amount) === 0 && r.accountId);
    if (emptyAmountRows.length !== 1) return; // Only auto-fill if exactly one empty row

    const emptyRow = emptyAmountRows[0];
    const absDiff = Math.abs(difference);

    setRows(prev => prev.map(r => {
      if (r.id !== emptyRow.id) return r;
      return {
        ...r,
        amount: formatNumber(absDiff),
        // If difference > 0 (more debits), empty row needs to be Credit
        // If difference < 0 (more credits), empty row needs to be Debit
        isDebit: difference < 0,
      };
    }));
  }, [totalDebit, totalCredit, difference, rows]);

  const handleSave = async () => {
    if (!isBalanced) return;

    const entries = rows
      .filter(r => r.accountId && parseFormattedNumber(r.amount) > 0)
      .map(r => ({
        accountId: r.accountId,
        debit: r.isDebit ? parseFormattedNumber(r.amount) : 0,
        credit: !r.isDebit ? parseFormattedNumber(r.amount) : 0,
      }));

    if (entries.length < 2) return;

    setSaving(true);
    try {
      await createMultiEntryTransaction({
        entries,
        description,
        date,
        userId: userId || '',
      });
      toast({ title: t('common.success', lang) });
      setRows([
        { id: crypto.randomUUID(), accountId: '', amount: '', isDebit: true },
        { id: crypto.randomUUID(), accountId: '', amount: '', isDebit: false },
      ]);
      setDescription('');
    } catch {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAccount = async (accType: string) => {
    if (!newAccountName.trim()) return;

    const existingAccounts = accounts.filter(a => a.type === accType);
    const maxCode = existingAccounts.reduce((max, a) => {
      const parts = a.code.split('-');
      return parts.length > 1 ? Math.max(max, parseInt(parts[1])) : max;
    }, 0);
    const prefix = accType === 'asset' ? '1' : accType === 'cashBank' ? '1' : accType === 'liability' ? '2' : accType === 'equity' ? '3' : accType === 'income' ? '4' : '5';
    const subCode = accType === 'cashBank' ? '1' : '0';
    const newCode = `${prefix}-${subCode}${String(maxCode + 100).padStart(3, '0')}`;

    const rootMap: Record<string, string> = {
      asset: 'acc-asset-root', cashBank: 'acc-cashbank-root',
      liability: 'acc-liability-root', equity: 'acc-equity-root',
      income: 'acc-income-root', expense: 'acc-expense-root',
    };

    const newAccount: Account = {
      id: `acc-${uuid()}`,
      code: newCode,
      name: newAccountName.trim(),
      type: accType as Account['type'],
      parentId: rootMap[accType],
      isSystem: false,
      isActive: true,
      createdAt: new Date(),
    };

    await db.accounts.add(newAccount);
    setNewAccountName('');
    setShowNewAccount(null);
    await loadAccounts();

    // Auto-fill the new account into the row that triggered "Add New"
    if (addNewForRow) {
      handleAccountSelect(addNewForRow, newAccount.id);
      setAddNewForRow(null);
    }
  };

  // Group accounts by type for the selector
  const groupedAccounts = ACCOUNT_TYPE_ORDER.map(accType => ({
    type: accType,
    label: t(`type.${accType}` as keyof import('@/lib/i18n').TranslationKeys, lang),
    accounts: accounts
      .filter(a => a.type === accType)
      .filter(a => !searchQuery || getAccountName(a, lang).toLowerCase().includes(searchQuery.toLowerCase())),
  })).filter(g => g.accounts.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold text-sm">{t('admin.journalEntry', lang)}</h3>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('form.description', lang)}</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 text-sm" rows={2} />
      </div>

      {/* Date */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('form.date', lang)}</label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal mt-1 h-9 text-sm">
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {date.toLocaleDateString()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      {/* Search accounts filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('form.searchAccount', lang)}
          className="h-8 text-xs pl-9"
        />
      </div>

      {/* New Account inline creation */}
      {showNewAccount && (
        <div className="flex gap-2 items-center p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
          <Input
            ref={newAccountInputRef}
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder={lang === 'id' ? 'Nama akun baru...' : lang === 'zh' ? '新账户名称...' : 'New account name...'}
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateAccount(showNewAccount);
              if (e.key === 'Escape') { setShowNewAccount(null); setAddNewForRow(null); }
            }}
          />
          <Button
            size="sm"
            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white shrink-0"
            onClick={() => handleCreateAccount(showNewAccount)}
            disabled={!newAccountName.trim()}
          >
            {lang === 'id' ? 'Buat' : lang === 'zh' ? '创建' : 'Create'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs shrink-0"
            onClick={() => { setShowNewAccount(null); setAddNewForRow(null); }}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Journal Entry Rows - Mobile Optimized */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_52px_28px] gap-1 px-2 py-1.5 bg-muted/50 text-[10px] font-semibold text-muted-foreground">
          <span>{t('rep.account', lang)}</span>
          <span className="text-right">{lang === 'id' ? 'Jumlah' : lang === 'zh' ? '金额' : 'Amount'}</span>
          <span className="text-center">Dr/Cr</span>
          <span></span>
        </div>

        {/* Rows */}
        {rows.map((row, rowIdx) => (
          <div key={row.id} className="grid grid-cols-[1fr_100px_52px_28px] gap-1 px-2 py-1.5 border-t items-center">
            {/* Account selector with grouped options */}
            <Select value={row.accountId} onValueChange={(v) => handleAccountSelect(row.id, v)}>
              <SelectTrigger className="h-8 text-xs border-0 shadow-none p-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {groupedAccounts.map(group => (
                  <SelectGroup key={group.type}>
                    <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase">{group.label}</SelectLabel>
                    {group.accounts.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {getAccountName(a, lang)}
                      </SelectItem>
                    ))}
                    <SelectItem value={`__new_${group.type}`} className="text-xs text-red-600 font-medium">
                      + {lang === 'id' ? 'Tambah' : lang === 'zh' ? '新增' : 'Add New'}
                    </SelectItem>
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {/* Amount input */}
            <Input
              type="text"
              inputMode="numeric"
              value={row.amount}
              onChange={(e) => {
                const val = parseFormattedNumber(e.target.value);
                updateRow(row.id, 'amount', e.target.value === '' ? '' : formatNumber(val));
              }}
              className="h-8 text-xs text-right border-0 shadow-none p-1"
              placeholder="0"
            />

            {/* Dr/Cr Toggle */}
            <button
              onClick={() => toggleDrCr(row.id)}
              className={`h-7 rounded-md text-[10px] font-bold transition-colors ${
                row.isDebit
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
              }`}
            >
              {row.isDebit ? 'Dr' : 'Cr'}
            </button>

            {/* Delete */}
            <div className="flex items-center">
              {rows.length > 2 && (
                <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-destructive/10">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Totals */}
        <div className="grid grid-cols-[1fr_100px_52px_28px] gap-1 px-2 py-1.5 border-t-2 bg-muted/30 font-semibold text-xs">
          <span>{t('rep.total', lang)}</span>
          <div className="text-right">
            <span className="text-blue-600 dark:text-blue-400">Dr {formatNumber(totalDebit)}</span>
            <span className="mx-1 text-muted-foreground">|</span>
            <span className="text-orange-600 dark:text-orange-400">Cr {formatNumber(totalCredit)}</span>
          </div>
          <span></span>
          <span></span>
        </div>
      </div>

      {/* Balance indicator — only show when balanced */}
      {isBalanced && (
        <div className="text-xs text-amber-600 text-center">✓ Balanced</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={addRow} className="text-xs h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin.addRow', lang)}
        </Button>
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !isBalanced}
        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white h-10"
      >
        {saving ? t('common.loading', lang) : t('form.save', lang)}
      </Button>
    </div>
  );
}
