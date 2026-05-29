'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { createMultiEntryTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

interface JournalRow {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
}

export function AdminCustomEntry() {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([
    { id: crypto.randomUUID(), accountId: '', debit: '', credit: '' },
    { id: crypto.randomUUID(), accountId: '', debit: '', credit: '' },
  ]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(today());
  const [calOpen, setCalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadAccounts = useCallback(async () => {
    const accs = await db.accounts.filter(a => a.isActive).toArray();
    setAccounts(accs.filter(a => a.parentId));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const addRow = () => {
    setRows(prev => [...prev, { id: crypto.randomUUID(), accountId: '', debit: '', credit: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 2) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof JournalRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const toggleDebitCredit = (id: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      return { ...r, debit: r.credit, credit: r.debit };
    }));
  };

  const totalDebit = rows.reduce((sum, r) => sum + parseFormattedNumber(r.debit), 0);
  const totalCredit = rows.reduce((sum, r) => sum + parseFormattedNumber(r.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const difference = totalDebit - totalCredit;

  const autoBalance = () => {
    // If debits > credits, add the difference as credit on the first empty credit row
    // If credits > debits, add the difference as debit on the first empty debit row
    if (Math.abs(difference) < 0.01) return;

    setRows(prev => {
      const newRows = [...prev];
      if (difference > 0) {
        // Need more credits
        const emptyCreditRow = newRows.find(r => parseFormattedNumber(r.credit) === 0 && r.accountId);
        if (emptyCreditRow) {
          emptyCreditRow.credit = formatNumber(difference);
        }
      } else {
        // Need more debits
        const emptyDebitRow = newRows.find(r => parseFormattedNumber(r.debit) === 0 && r.accountId);
        if (emptyDebitRow) {
          emptyDebitRow.debit = formatNumber(Math.abs(difference));
        }
      }
      return newRows;
    });
  };

  const handleSave = async () => {
    if (!isBalanced) return;

    const entries = rows
      .filter(r => r.accountId && (parseFormattedNumber(r.debit) > 0 || parseFormattedNumber(r.credit) > 0))
      .map(r => ({
        accountId: r.accountId,
        debit: parseFormattedNumber(r.debit),
        credit: parseFormattedNumber(r.credit),
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
        { id: crypto.randomUUID(), accountId: '', debit: '', credit: '' },
        { id: crypto.randomUUID(), accountId: '', debit: '', credit: '' },
      ]);
      setDescription('');
    } catch {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredAccounts = searchQuery
    ? accounts.filter(a => getAccountName(a, lang).toLowerCase().includes(searchQuery.toLowerCase()))
    : accounts;

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

      {/* Search accounts */}
      <div>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('form.searchAccount', lang)}
          className="h-9 text-sm"
        />
      </div>

      {/* Journal Entry Rows */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_90px_90px_36px] gap-1 px-2 py-1.5 bg-muted/50 text-[10px] font-semibold text-muted-foreground">
          <span>{t('rep.account', lang)}</span>
          <span className="text-right">{t('rep.debit', lang)}</span>
          <span className="text-right">{t('rep.credit', lang)}</span>
          <span></span>
        </div>

        {/* Rows */}
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_90px_90px_36px] gap-1 px-2 py-1.5 border-t items-center">
            <Select value={row.accountId} onValueChange={(v) => updateRow(row.id, 'accountId', v)}>
              <SelectTrigger className="h-8 text-xs border-0 shadow-none p-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {getAccountName(a, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="text"
              inputMode="numeric"
              value={row.debit}
              onChange={(e) => {
                const val = parseFormattedNumber(e.target.value);
                updateRow(row.id, 'debit', e.target.value === '' ? '' : formatNumber(val));
              }}
              className="h-8 text-xs text-right border-0 shadow-none p-1"
              placeholder="0"
            />
            <Input
              type="text"
              inputMode="numeric"
              value={row.credit}
              onChange={(e) => {
                const val = parseFormattedNumber(e.target.value);
                updateRow(row.id, 'credit', e.target.value === '' ? '' : formatNumber(val));
              }}
              className="h-8 text-xs text-right border-0 shadow-none p-1"
              placeholder="0"
            />
            <div className="flex items-center gap-0.5">
              <button onClick={() => toggleDebitCredit(row.id)} className="p-1 rounded hover:bg-accent" title="Swap Dr/Cr">
                <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
              </button>
              {rows.length > 2 && (
                <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-destructive/10">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Totals */}
        <div className="grid grid-cols-[1fr_90px_90px_36px] gap-1 px-2 py-1.5 border-t-2 bg-muted/30 font-semibold text-xs">
          <span>{t('rep.total', lang)}</span>
          <span className="text-right">{formatNumber(totalDebit)}</span>
          <span className="text-right">{formatNumber(totalCredit)}</span>
          <span></span>
        </div>
      </div>

      {/* Balance indicator */}
      {!isBalanced && totalDebit > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{t('admin.notBalanced', lang)} (Diff: {formatNumber(Math.abs(difference))})</span>
        </div>
      )}
      {isBalanced && (
        <div className="text-xs text-emerald-600 text-center">✓ Balanced</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={addRow} className="text-xs h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin.addRow', lang)}
        </Button>
        {!isBalanced && totalDebit > 0 && (
          <Button size="sm" variant="outline" onClick={autoBalance} className="text-xs h-8">
            {t('admin.autoBalance', lang)}
          </Button>
        )}
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !isBalanced}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white h-10"
      >
        {saving ? t('common.loading', lang) : t('form.save', lang)}
      </Button>
    </div>
  );
}
