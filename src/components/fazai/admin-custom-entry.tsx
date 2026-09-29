'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account, type AccountCategory } from '@/lib/fazai-db';
import { createMultiEntryTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Search, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { AddAccountDialog } from './add-account-dialog';

interface JournalRow {
  id: string;
  accountId: string;
  amount: string;     // single value
  isDebit: boolean;   // true = Dr, false = Cr
}

/** Natural Dr/Cr for an account type */
function drCrForType(type: Account['type']): boolean {
  return type !== 'income' && type !== 'liability' && type !== 'equity';
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
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  // Row awaiting the new account created via the shared Add Account dialog
  const [addNewForRow, setAddNewForRow] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const scrollList = (dir: 1 | -1) => {
    listRef.current?.scrollBy({ top: dir * 160, behavior: 'smooth' });
  };

  const loadAccounts = useCallback(async () => {
    const [accs, allCats] = await Promise.all([
      db.accounts.filter(a => a.isActive).toArray(),
      db.accountCategories.toArray(),
    ]);
    const leaf = accs.filter(a => a.parentId);
    setAccounts(leaf);
    setCategories(allCats.filter(c => c.isActive));
    return leaf;
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
  const getOpposingAccount = useCallback((accountId: string, list: Account[]): string | null => {
    const acc = list.find(a => a.id === accountId);
    if (!acc) return null;

    // For expense/income accounts, the opposing is the default cash/bank account
    if (acc.type === 'expense' || acc.type === 'income') {
      // Prefer "Cash on Hand", then "Bank Account", then first cashBank child
      const cashOnHand = list.find(a => a.id === 'acc-cash');
      if (cashOnHand) return cashOnHand.id;
      const bank = list.find(a => a.id === 'acc-bank');
      if (bank) return bank.id;
      const firstCashBank = list.find(a => a.type === 'cashBank' && a.parentId);
      if (firstCashBank) return firstCashBank.id;
    }

    return null;
  }, []);

  /** Apply an account selection to a row: set account, auto Dr/Cr, auto-suggest opposing */
  const applySelection = useCallback((rowId: string, accountId: string, list: Account[]) => {
    setRows(prev => {
      const newRows = prev.map(r => r.id === rowId ? { ...r, accountId } : r);

      const acc = list.find(a => a.id === accountId);
      if (acc) {
        const row = newRows.find(r => r.id === rowId);
        if (row) {
          row.isDebit = drCrForType(acc.type);
        }

        // Auto-suggest opposing account in empty rows
        const opposingId = getOpposingAccount(accountId, list);
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
  }, [getOpposingAccount]);

  /** Handle account selection from the dropdown */
  const handleAccountSelect = (rowId: string, accountId: string) => {
    applySelection(rowId, accountId, accounts);
  };

  /** Fill the pending row after a new account is created via the shared dialog */
  const handleAccountCreated = async (newAccount: Account) => {
    const fresh = await loadAccounts();
    setShowAddDialog(false);
    const rowId = addNewForRow;
    setAddNewForRow(null);
    if (rowId) {
      applySelection(rowId, newAccount.id, fresh);
    }
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

  // Group accounts by the 18 account categories (same BS / Profit & Loss structure
  // as Admin - Accounts). All category headers show by default, collapsed;
  // tap a header to expand. Dropdown items show the bare account name;
  // the selected row shows "category / account".
  const q = searchQuery.trim().toLowerCase();
  const isSearching = q.length > 0;
  const catLabel = (catId: string) =>
    t(`cat.${catId.replace('cat-', '')}` as keyof import('@/lib/i18n').TranslationKeys, lang);
  const groups = ['BS', 'PL'].map(g => ({
    group: g,
    cats: categories
      .filter(c => c.group === g)
      .sort((a, b) => a.order - b.order)
      .map(c => {
        const label = catLabel(c.id);
        const items = accounts
          .filter(a => a.categoryId === c.id)
          .map(a => ({ acc: a, qual: `${label} / ${getAccountName(a, lang)}` }))
          .filter(x => !isSearching || x.qual.toLowerCase().includes(q));
        return { id: c.id, label, items };
      })
      .filter(c => !isSearching || c.items.length > 0),
  }));

  // "category / account" label per account id, for the selected-row display.
  // Rendered from state (not Radix SelectValue) so the row never blanks when
  // its group is collapsed or filtered out of the dropdown.
  const qualById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) {
      const name = getAccountName(a, lang);
      if (!a.categoryId) { m.set(a.id, name); continue; }
      const label = t(`cat.${a.categoryId.replace('cat-', '')}` as keyof import('@/lib/i18n').TranslationKeys, lang);
      m.set(a.id, `${label} / ${name}`);
    }
    return m;
  }, [accounts, lang]);

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const openAddDialog = () => {
    setAddNewForRow(openRowId);
    setOpenRowId(null);
    setSearchQuery('');
    setShowAddDialog(true);
  };

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
        {rows.map((row) => {
          const rowLabel = qualById.get(row.accountId);
          return (
          <div key={row.id} className="grid grid-cols-[1fr_100px_52px_28px] gap-1 px-2 py-1.5 border-t items-center">
            {/* Account selector with grouped options */}
            <Select
              value={row.accountId}
              open={openRowId === row.id}
              onValueChange={(v) => { setSearchQuery(''); handleAccountSelect(row.id, v); }}
              onOpenChange={(open) => { setOpenRowId(open ? row.id : null); if (!open) { setSearchQuery(''); setExpandedCats(new Set()); } }}
            >
              <SelectTrigger className="h-8 text-xs border-0 shadow-none p-1">
                <span className={`flex-1 min-w-0 truncate text-left ${rowLabel ? '' : 'text-muted-foreground'}`}>
                  {rowLabel ?? '—'}
                </span>
              </SelectTrigger>
              <SelectContent
                align="start"
                sideOffset={4}
                className="w-[min(85vw,420px)] max-h-[min(60dvh,560px)]"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <div
                  className="bg-popover p-1 pb-2"
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-1">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder={t('form.searchAccount', lang)}
                        className="h-8 text-xs pl-8"
                      />
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={openAddDialog}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {lang === 'id' ? 'Akun' : lang === 'zh' ? '账户' : 'Account'}
                    </Button>
                  </div>
                </div>
                <div ref={listRef} className="select-list-scroll max-h-[32dvh]">
                {isSearching && groups.every(g => g.cats.length === 0) && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No accounts found</div>
                )}
                {groups.map(g => (
                  <SelectGroup key={g.group}>
                    <div className="px-2 pt-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
                      {g.group === 'BS' ? 'Balance Sheet' : 'Profit & Loss'}
                    </div>
                    {g.cats.map(cat => {
                      const expanded = isSearching || expandedCats.has(cat.id);
                      return (
                        <div key={cat.id}>
                          <button
                            type="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => toggleCat(cat.id)}
                            className="flex w-full items-center gap-1 px-2 py-1.5 hover:bg-accent rounded-sm"
                          >
                            {expanded
                              ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                              : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
                            <span className="truncate text-xs font-medium">{cat.label}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground font-normal">({cat.items.length})</span>
                          </button>
                          {expanded && (cat.items.length > 0 ? cat.items.map(({ acc: a }) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs pl-7">
                              {getAccountName(a, lang)}
                            </SelectItem>
                          )) : (
                            <div className="px-2 py-1 pl-7 text-[11px] text-muted-foreground">No accounts — use + Account</div>
                          ))}
                        </div>
                      );
                    })}
                  </SelectGroup>
                ))}
                </div>
                <div className="flex items-center justify-center gap-6 border-t border-border/60 py-0.5">
                  <button
                    type="button"
                    aria-label="Scroll up"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => scrollList(-1)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Scroll down"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => scrollList(1)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
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
          );
        })}

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

      {/* Shared Add Account dialog (same as Admin - Accounts, incl. opening balance for BS) */}
      <AddAccountDialog
        open={showAddDialog}
        onOpenChange={(o) => { setShowAddDialog(o); if (!o) setAddNewForRow(null); }}
        editAccount={null}
        onSaved={handleAccountCreated}
      />
    </div>
  );
}
