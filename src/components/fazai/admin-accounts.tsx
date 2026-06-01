'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { getAccountBalance, createOpeningBalanceTransaction } from '@/lib/ledger-engine';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const ACCOUNT_TYPES = ['asset', 'cashBank', 'liability', 'equity', 'income', 'expense'] as const;

const TYPE_ROOT_MAP: Record<string, string> = {
  asset: 'acc-asset-root',
  cashBank: 'acc-cashbank-root',
  liability: 'acc-liability-root',
  equity: 'acc-equity-root',
  income: 'acc-income-root',
  expense: 'acc-expense-root',
};

// Account types that can have an opening balance (BS accounts)
const BALANCE_ELIGIBLE_TYPES = new Set(['asset', 'cashBank', 'liability', 'equity']);

export function AdminAccounts() {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('expense');
  const [parentId, setParentId] = useState('');
  const [balance, setBalance] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['cashBank', 'income', 'expense']));

  const loadRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    const list = await db.accounts.toArray();
    setAccounts(list.sort((a, b) => a.code.localeCompare(b.code)));
    const balMap: Record<string, number> = {};
    for (const acc of list.filter(a => a.parentId)) {
      balMap[acc.id] = await getAccountBalance(acc.id);
    }
    setBalances(balMap);
  }, []);

  useEffect(() => {
    if (!loadRef.current) {
      loadRef.current = true;
      loadAccounts();
    }
  }, [loadAccounts]);

  const handleTypeChange = (newType: Account['type']) => {
    setType(newType);
    setParentId(TYPE_ROOT_MAP[newType] || '');
    // Clear balance if switching to income/expense
    if (!BALANCE_ELIGIBLE_TYPES.has(newType)) {
      setBalance('');
    }
  };

  const handleBalanceChange = (value: string) => {
    const parsed = parseFormattedNumber(value);
    if (!isNaN(parsed) || value === '') {
      setBalance(value === '' ? '' : formatNumber(parsed));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    if (editAccount) {
      await db.accounts.update(editAccount.id, {
        name: name.trim(),
        type,
        parentId: parentId || TYPE_ROOT_MAP[type] || undefined,
      });
    } else {
      // Auto-generate code based on type
      const typeAccounts = accounts.filter(a => a.type === type);
      const prefix = type === 'asset' ? '1' : type === 'cashBank' ? '1' : type === 'liability' ? '2' : type === 'equity' ? '3' : type === 'income' ? '4' : '5';
      const subCode = type === 'cashBank' ? '1' : '0';
      const maxSuffix = typeAccounts.reduce((max, a) => {
        const parts = a.code.split('-');
        return parts.length > 1 ? Math.max(max, parseInt(parts[1])) : max;
      }, 0);
      const newCode = `${prefix}-${subCode}${String(maxSuffix + 100).padStart(3, '0')}`;

      const newAccountId = `acc-${uuid()}`;

      await db.accounts.add({
        id: newAccountId,
        code: newCode,
        name: name.trim(),
        type,
        parentId: parentId || TYPE_ROOT_MAP[type] || undefined,
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
      });

      // Create opening balance transaction if balance is provided and account type is eligible
      const numBalance = parseFormattedNumber(balance);
      if (numBalance > 0 && BALANCE_ELIGIBLE_TYPES.has(type)) {
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

    resetForm();
    toast({ title: t('common.success', lang) });
    loadAccounts();
  };

  const handleToggleActive = async (acc: Account) => {
    await db.accounts.update(acc.id, { isActive: !acc.isActive });
    toast({ title: t('common.success', lang) });
    loadAccounts();
  };

  const startEdit = (acc: Account) => {
    setEditAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setParentId(acc.parentId || TYPE_ROOT_MAP[acc.type] || '');
    setBalance('');
  };

  const resetForm = () => {
    setEditAccount(null);
    setShowAdd(false);
    setName('');
    setType('expense');
    setParentId(TYPE_ROOT_MAP['expense']);
    setBalance('');
  };

  const toggleType = (accType: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(accType)) next.delete(accType);
      else next.add(accType);
      return next;
    });
  };

  const showBalanceField = !editAccount && BALANCE_ELIGIBLE_TYPES.has(type);

  const groupedAccounts = ACCOUNT_TYPES.map(accType => ({
    type: accType,
    accounts: accounts.filter(a => a.type === accType),
  })).filter(g => g.accounts.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('admin.accounts', lang)}</h3>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin.addAccount', lang)}
        </Button>
      </div>

      {groupedAccounts.map(({ type: accType, accounts: typeAccounts }) => {
        const isExpanded = expandedTypes.has(accType);
        const rootAccount = typeAccounts.find(a => !a.parentId);
        const childAccounts = typeAccounts.filter(a => a.parentId);
        const typeBalance = childAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);

        return (
          <div key={accType} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleType(accType)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="font-semibold text-xs">{t(`type.${accType}` as keyof import('@/lib/i18n').TranslationKeys, lang)}</span>
                <span className="text-[10px] text-muted-foreground">({childAccounts.length})</span>
              </div>
              <span className="text-xs font-medium">{formatNumber(typeBalance)}</span>
            </button>

            {isExpanded && (
              <div className="divide-y">
                {childAccounts.map((acc) => (
                  <div key={acc.id} className={`flex items-center justify-between px-3 py-2 ${!acc.isActive ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs truncate">{getAccountName(acc, lang)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium tabular-nums">{formatNumber(balances[acc.id] || 0)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(acc)}>
                        {acc.isActive
                          ? <ToggleRight className="w-4 h-4 text-red-500" />
                          : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                        }
                      </Button>
                      {!acc.isSystem && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(acc)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {childAccounts.length === 0 && (
                  <div className="px-3 py-3 text-xs text-muted-foreground text-center">No accounts</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={!!editAccount || showAdd} onOpenChange={() => resetForm()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{editAccount ? t('admin.editAccount', lang) : t('admin.addAccount', lang)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium">{t('admin.name', lang)}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">{t('admin.type', lang)}</label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as Account['type'])}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(at => (
                    <SelectItem key={at} value={at}>{t(`type.${at}` as keyof import('@/lib/i18n').TranslationKeys, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Parent</label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => !a.parentId).map(a => (
                    <SelectItem key={a.id} value={a.id}>{getAccountName(a, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Balance field - only for new accounts of BS types (asset, cashBank, liability, equity) */}
            {showBalanceField && (
              <div>
                <label className="text-xs font-medium">
                  {lang === 'id' ? 'Saldo Awal' : lang === 'zh' ? '期初余额' : 'Opening Balance'}
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={balance}
                  onChange={(e) => handleBalanceChange(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-9 text-sm font-medium"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {lang === 'id'
                    ? 'Akan dicatat sebagai Saldo Awal (lawan: Modal - Saldo Awal)'
                    : lang === 'zh'
                    ? '将记为期初余额（对方科目：权益-期初余额）'
                    : 'Recorded as Opening Balance (counter: Equity - Opening Balance)'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={resetForm}>{t('common.cancel', lang)}</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>{t('common.save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
