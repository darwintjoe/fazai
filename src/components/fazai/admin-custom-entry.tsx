'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { createCustomTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

export function AdminCustomEntry() {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(today());
  const [calOpen, setCalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    const accs = await db.accounts.filter(a => a.isActive).toArray();
    setAccounts(accs.filter(a => a.parentId));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSave = async () => {
    const numAmount = parseFormattedNumber(amount);
    if (numAmount <= 0 || !debitAccountId || !creditAccountId) return;

    setSaving(true);
    try {
      await createCustomTransaction({
        debitAccountId,
        creditAccountId,
        amount: numAmount,
        description,
        date,
        userId: userId || '',
      });
      toast({ title: t('common.success', lang) });
      setAmount('');
      setDescription('');
    } catch {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">{t('admin.customTransaction', lang)}</h3>

      <div>
        <label className="text-sm font-medium">{t('admin.debitAccount', lang)}</label>
        <Select value={debitAccountId} onValueChange={setDebitAccountId}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.code} - {getAccountName(a, lang)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">{t('admin.creditAccount', lang)}</label>
        <Select value={creditAccountId} onValueChange={setCreditAccountId}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.code} - {getAccountName(a, lang)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">{t('form.amount', lang)}</label>
        <Input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            const parsed = parseFormattedNumber(val);
            setAmount(val === '' ? '' : formatNumber(parsed));
          }}
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium">{t('form.description', lang)}</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} />
      </div>

      <div>
        <label className="text-sm font-medium">{t('form.date', lang)}</label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date.toLocaleDateString()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || parseFormattedNumber(amount) <= 0 || !debitAccountId || !creditAccountId}
        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
      >
        {saving ? t('common.loading', lang) : t('form.save', lang)}
      </Button>
    </div>
  );
}
