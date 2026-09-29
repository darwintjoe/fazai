'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { db, type Account, type AccountCategory } from '@/lib/fazai-db';
import { createOpeningBalanceTransaction } from '@/lib/ledger-engine';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

export const CAT_TYPE_MAP: Record<string, Account['type']> = {
  'cat-cashbank': 'cashBank', 'cat-ar': 'asset', 'cat-inventory': 'asset',
  'cat-fixedasset': 'asset', 'cat-accumdepr': 'asset', 'cat-ap': 'liability',
  'cat-taxpayable': 'liability', 'cat-taxreceivable': 'asset', 'cat-otherliability': 'liability',
  'cat-equity': 'equity', 'cat-income': 'income', 'cat-cogs': 'expense',
  'cat-expenses': 'expense', 'cat-rent': 'expense', 'cat-depreciation-expense': 'expense',
  'cat-other-income': 'income', 'cat-other-expense': 'expense', 'cat-tax-expense': 'expense',
};

export const CAT_ROOTS: Record<string, string> = {
  'cat-cashbank': 'acc-cashbank-root', 'cat-income': 'acc-income-root',
  'cat-expenses': 'acc-expense-root', 'cat-equity': 'acc-equity-root',
};

export const BS_CATS = new Set(['cat-cashbank', 'cat-ar', 'cat-inventory', 'cat-fixedasset', 'cat-accumdepr', 'cat-ap', 'cat-taxpayable', 'cat-taxreceivable', 'cat-otherliability', 'cat-equity']);

export const ACCOUNT_GROUPS = ['BS', 'PL'] as const;

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an account to edit, or null to create */
  editAccount: Account | null;
  onSaved: (account: Account) => void;
}

export function AddAccountDialog({ open, onOpenChange, editAccount, onSaved }: AddAccountDialogProps) {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [balance, setBalance] = useState('');

  useEffect(() => {
    if (!open) return;
    db.accountCategories.toArray().then(all => setCategories(all.filter(c => c.isActive)));
    setName(editAccount?.name ?? '');
    setCategoryId(editAccount?.categoryId ?? '');
    setBalance('');
  }, [open, editAccount]);

  const handleBalanceChange = (value: string) => {
    const parsed = parseFormattedNumber(value);
    if (!isNaN(parsed) || value === '') {
      setBalance(value === '' ? '' : formatNumber(parsed));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryId) return;
    const type = CAT_TYPE_MAP[categoryId] || 'expense';

    if (editAccount) {
      await db.accounts.update(editAccount.id, {
        name: name.trim(),
        categoryId,
        type,
      });
      const updated: Account = { ...editAccount, name: name.trim(), categoryId, type };
      toast({ title: t('common.success', lang) });
      onSaved(updated);
      onOpenChange(false);
      return;
    }

    const existing = await db.accounts.where('categoryId').equals(categoryId).toArray();
    const catAccounts = existing.filter(a => a.parentId);
    const typePrefix = type === 'asset' || type === 'cashBank' ? '1' : type === 'liability' ? '2' : type === 'equity' ? '3' : type === 'income' ? '4' : '5';
    const maxSuffix = catAccounts.reduce((max, a) => {
      const parts = a.code.split('-');
      return parts.length > 1 ? Math.max(max, parseInt(parts[1])) : max;
    }, 0);
    const newCode = `${typePrefix}-${String(maxSuffix + 100).padStart(4, '0')}`;
    const newAccount: Account = {
      id: `acc-${uuid()}`,
      code: newCode,
      name: name.trim(),
      type,
      categoryId,
      parentId: CAT_ROOTS[categoryId],
      isSystem: false,
      isActive: true,
      createdAt: new Date(),
    };

    await db.accounts.add(newAccount);

    if (BS_CATS.has(categoryId)) {
      const numBalance = parseFormattedNumber(balance);
      if (numBalance !== 0) {
        try {
          await createOpeningBalanceTransaction({
            accountId: newAccount.id,
            amount: numBalance,
            date: today(),
            userId: userId || '',
          });
        } catch (err) {
          console.error('Failed to create opening balance:', err);
        }
      }
    }

    toast({ title: t('common.success', lang) });
    onSaved(newAccount);
    onOpenChange(false);
  };

  const isBsCat = categoryId ? BS_CATS.has(categoryId) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{editAccount ? t('admin.editAccount', lang) : t('admin.addAccount', lang)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium">{t('admin.name', lang)}</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_GROUPS.map(g => {
                  const groupCats = categories.filter(c => c.group === g).sort((a, b) => a.order - b.order);
                  return (
                    <React.Fragment key={g}>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">{g === 'BS' ? 'Balance Sheet' : 'Profit & Loss'}</div>
                      {groupCats.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{t(`cat.${cat.id.replace('cat-', '')}` as any, lang)}</SelectItem>
                      ))}
                    </React.Fragment>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {editAccount === null && isBsCat && (
            <div>
              <label className="text-xs font-medium">{t('admin.openingBalance', lang)}</label>
              <Input type="text" inputMode="numeric" value={balance} onChange={e => handleBalanceChange(e.target.value)} placeholder="0" className="mt-1 h-9 text-sm font-medium" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {lang === 'id' ? 'Akan dicatat sebagai Saldo Awal (lawan: Modal - Saldo Awal)' : lang === 'zh' ? '将记为期初余额（对方科目：权益-期初余额）' : 'Recorded as Opening Balance (counter: Equity - Opening Balance)'}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t('common.cancel', lang)}</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || !categoryId}>{t('common.save', lang)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
