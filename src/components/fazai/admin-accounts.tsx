'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account, type AccountCategory } from '@/lib/fazai-db';
import { getAccountBalance, createOpeningBalanceTransaction } from '@/lib/ledger-engine';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const CAT_TYPE_MAP: Record<string, Account['type']> = {
  'cat-cashbank': 'cashBank', 'cat-ar': 'asset', 'cat-inventory': 'asset',
  'cat-fixedasset': 'asset', 'cat-accumdepr': 'asset', 'cat-ap': 'liability',
  'cat-taxpayable': 'liability', 'cat-taxreceivable': 'asset', 'cat-otherliability': 'liability',
  'cat-equity': 'equity', 'cat-income': 'income', 'cat-cogs': 'expense',
  'cat-expenses': 'expense', 'cat-rent': 'expense', 'cat-depreciation-expense': 'expense',
  'cat-other-income': 'income', 'cat-other-expense': 'expense', 'cat-tax-expense': 'expense',
};

const CAT_ROOTS: Record<string, string> = {
  'cat-cashbank': 'acc-cashbank-root', 'cat-income': 'acc-income-root',
  'cat-expenses': 'acc-expense-root', 'cat-equity': 'acc-equity-root',
};

const BS_CATS = new Set(['cat-cashbank', 'cat-ar', 'cat-inventory', 'cat-fixedasset', 'cat-accumdepr', 'cat-ap', 'cat-taxpayable', 'cat-taxreceivable', 'cat-otherliability', 'cat-equity']);

const GROUPS = ['BS', 'PL'] as const;

export function AdminAccounts() {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['BS']));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [balance, setBalance] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const loadData = useCallback(async () => {
    const [accList, allCats] = await Promise.all([
      db.accounts.toArray(),
      db.accountCategories.toArray(),
    ]);
    const catList = allCats.filter(c => c.isActive);
    setAccounts(accList.sort((a, b) => a.code.localeCompare(b.code)));
    setCategories(catList);
    const balMap: Record<string, number> = {};
    for (const acc of accList.filter(a => a.parentId)) {
      balMap[acc.id] = await getAccountBalance(acc.id);
    }
    setBalances(balMap);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setEditAccount(null);
    setShowAdd(false);
    setName('');
    setCategoryId('');
    setBalance('');
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
    } else {
      const catAccounts = accounts.filter(a => a.categoryId === categoryId && a.parentId);
      const typePrefix = type === 'asset' || type === 'cashBank' ? '1' : type === 'liability' ? '2' : type === 'equity' ? '3' : type === 'income' ? '4' : '5';
      const maxSuffix = catAccounts.reduce((max, a) => {
        const parts = a.code.split('-');
        return parts.length > 1 ? Math.max(max, parseInt(parts[1])) : max;
      }, 0);
      const newCode = `${typePrefix}-${String(maxSuffix + 100).padStart(4, '0')}`;
      const newAccountId = `acc-${uuid()}`;
      const parentId = CAT_ROOTS[categoryId] || undefined;

      await db.accounts.add({
        id: newAccountId,
        code: newCode,
        name: name.trim(),
        type,
        categoryId,
        parentId,
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
      });

      if (BS_CATS.has(categoryId)) {
        const numBalance = parseFormattedNumber(balance);
        if (numBalance !== 0) {
          try {
            await createOpeningBalanceTransaction({
              accountId: newAccountId,
              amount: numBalance,
              date: today(),
              userId: userId || '',
            });
          } catch (err) {
            console.error('Failed to create opening balance:', err);
          }
        }
      }
    }

    resetForm();
    toast({ title: t('common.success', lang) });
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteTarget.isSystem) return;
    await db.accounts.delete(deleteTarget.id);
    setDeleteTarget(null);
    toast({ title: t('common.success', lang) });
    loadData();
  };

  const handleToggleActive = async (acc: Account) => {
    await db.accounts.update(acc.id, { isActive: !acc.isActive });
    toast({ title: t('common.success', lang) });
    loadData();
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const startEdit = (acc: Account) => {
    setEditAccount(acc);
    setName(acc.name);
    setCategoryId(acc.categoryId || '');
    setBalance('');
    setShowAdd(true);
  };

  const handleBalanceChange = (value: string) => {
    const parsed = parseFormattedNumber(value);
    if (!isNaN(parsed) || value === '') {
      setBalance(value === '' ? '' : formatNumber(parsed));
    }
  };

  // Group accounts by category
  const catAccounts = (catId: string) => accounts.filter(a => a.categoryId === catId && a.parentId);
  const catBalance = (catId: string) => catAccounts(catId).reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const groupBalance = (group: string) => categories.filter(c => c.group === group).reduce((sum, c) => sum + catBalance(c.id), 0);
  const groupCount = (group: string) => categories.filter(c => c.group === group).reduce((sum, c) => sum + catAccounts(c.id).length, 0);
  const isBsCat = categoryId ? BS_CATS.has(categoryId) : false;

  const renderGroup = (group: 'BS' | 'PL') => {
    const isExpanded = expandedGroups.has(group);
    const cats = categories.filter(c => c.group === group).sort((a, b) => a.order - b.order);
    const totalBalance = groupBalance(group);
    const totalCount = groupCount(group);

    return (
      <div key={group} className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleGroup(group)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <span className="font-semibold text-xs">{group === 'BS' ? 'Balance Sheet' : 'Profit & Loss'}</span>
            <span className="text-[10px] text-muted-foreground">({totalCount})</span>
          </div>
          <span className="text-xs font-medium">{formatNumber(totalBalance)}</span>
        </button>

        {isExpanded && (
          <div className="divide-y">
            {cats.map(cat => {
              const catExpanded = expandedCats.has(cat.id);
              const childAccounts = catAccounts(cat.id);
              const catBal = catBalance(cat.id);

              return (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className="w-full flex items-center justify-between px-3 py-2 pl-8 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {catExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                      <span className="text-xs font-medium">{t(`cat.${cat.id.replace('cat-', '')}` as any, lang)}</span>
                      <span className="text-[10px] text-muted-foreground">({childAccounts.length})</span>
                    </div>
                    <span className="text-[11px] font-medium tabular-nums">{formatNumber(catBal)}</span>
                  </button>

                  {catExpanded && (
                    <div className="divide-y">
                      {childAccounts.map(acc => (
                        <div key={acc.id} className={`flex items-center justify-between px-3 py-2 pl-14 ${!acc.isActive ? 'opacity-40' : ''}`}>
                          <span className="text-xs truncate flex-1 min-w-0">{getAccountName(acc, lang)}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-medium tabular-nums mr-1">{formatNumber(balances[acc.id] || 0)}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(acc)}>
                              {acc.isActive ? <ToggleRight className="w-4 h-4 text-red-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </Button>
                            {!acc.isSystem && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(acc)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(acc)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {childAccounts.length === 0 && (
                        <div className="px-3 py-3 pl-14 text-xs text-muted-foreground text-center">No accounts</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('admin.accounts', lang)}</h3>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin.addAccount', lang)}
        </Button>
      </div>

      {GROUPS.map(g => renderGroup(g))}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={() => resetForm()}>
        <DialogContent className="max-w-sm">
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
                  {GROUPS.map(g => {
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
            <Button variant="outline" size="sm" onClick={resetForm}>{t('common.cancel', lang)}</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim() || !categoryId}>{t('common.save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('common.confirmDelete', lang)}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {deleteTarget && <>{t('common.confirmDelete', lang)} <strong>{getAccountName(deleteTarget, lang)}</strong></>}
          </p>
          <p className="text-[10px] text-muted-foreground">{t('common.cannotUndo', lang)}</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>{t('common.cancel', lang)}</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>{t('common.delete', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
