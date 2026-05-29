'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const ACCOUNT_TYPES = ['asset', 'cashBank', 'liability', 'equity', 'income', 'expense'] as const;

export function AdminAccounts() {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('expense');
  const [parentId, setParentId] = useState('');

  const loadRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    const list = await db.accounts.toArray();
    setAccounts(list.sort((a, b) => a.code.localeCompare(b.code)));
  }, []);

  useEffect(() => {
    if (!loadRef.current) {
      loadRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAccounts();
    }
  }, [loadAccounts]);

  const rootAccounts = accounts.filter(a => !a.parentId);

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) return;

    if (editAccount) {
      await db.accounts.update(editAccount.id, {
        code: code.trim(),
        name: name.trim(),
        type,
        parentId: parentId || undefined,
      });
    } else {
      await db.accounts.add({
        id: `acc-${uuid()}`,
        code: code.trim(),
        name: name.trim(),
        type,
        parentId: parentId || undefined,
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
      });
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
    setCode(acc.code);
    setName(acc.name);
    setType(acc.type);
    setParentId(acc.parentId || '');
  };

  const resetForm = () => {
    setEditAccount(null);
    setShowAdd(false);
    setCode('');
    setName('');
    setType('expense');
    setParentId('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('admin.accounts', lang)}</h3>
        <Button size="sm" onClick={() => { setShowAdd(true); resetForm(); setShowAdd(true); }}>
          <Plus className="w-4 h-4 mr-1" /> {t('admin.addAccount', lang)}
        </Button>
      </div>

      {accounts.map((acc) => {
        const isRoot = !acc.parentId;
        return (
          <Card key={acc.id} className={`p-3 ${!acc.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{acc.code}</span>
                <span className={`text-sm ${isRoot ? 'font-bold' : ''}`}>
                  {isRoot ? '' : '└ '}{getAccountName(acc, lang)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {t(`type.${acc.type}` as any, lang)}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(acc)}>
                  {acc.isActive
                    ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                    : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                  }
                </Button>
                {!acc.isSystem && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(acc)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Add/Edit Dialog */}
      <Dialog open={!!editAccount || showAdd} onOpenChange={() => resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAccount ? t('admin.editAccount', lang) : t('admin.addAccount', lang)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium">{t('admin.code', lang)}</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1" placeholder="5-1000" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.name', lang)}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.type', lang)}</label>
              <Select value={type} onValueChange={(v) => setType(v as Account['type'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(at => (
                    <SelectItem key={at} value={at}>{t(`type.${at}` as any, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Parent</label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None (root)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root)</SelectItem>
                  {rootAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} - {getAccountName(a, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>{t('common.cancel', lang)}</Button>
            <Button onClick={handleSave} disabled={!code.trim() || !name.trim()}>{t('common.save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
