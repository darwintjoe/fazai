'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account, type AccountCategory } from '@/lib/fazai-db';
import { getAccountBalance } from '@/lib/ledger-engine';
import { formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddAccountDialog } from './add-account-dialog';

const GROUPS = ['BS', 'PL'] as const;

export function AdminAccounts() {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['BS']));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
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
    setShowAdd(true);
  };

  // Group accounts by category
  const catAccounts = (catId: string) => accounts.filter(a => a.categoryId === catId && a.parentId);
  const catBalance = (catId: string) => catAccounts(catId).reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const groupBalance = (group: string) => categories.filter(c => c.group === group).reduce((sum, c) => sum + catBalance(c.id), 0);
  const groupCount = (group: string) => categories.filter(c => c.group === group).reduce((sum, c) => sum + catAccounts(c.id).length, 0);

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
        <Button size="sm" onClick={() => { setEditAccount(null); setShowAdd(true); }} className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin.addAccount', lang)}
        </Button>
      </div>

      {GROUPS.map(g => renderGroup(g))}

      {/* Add/Edit Dialog (shared with Custom Entry) */}
      <AddAccountDialog
        open={showAdd}
        onOpenChange={(o) => { setShowAdd(o); if (!o) setEditAccount(null); }}
        editAccount={editAccount}
        onSaved={() => loadData()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
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
