'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { formatNumber, formatDate } from '@/lib/format';
import { db } from '@/lib/fazai-db';
import { Button } from '@/components/ui/button';

export function ContactStatement() {
  const { lang } = useAuthStore();
  const [contactRows, setContactRows] = useState<{ id: string; name: string; group: 'AR' | 'AP'; paid: number; unpaid: number; aging: number }[]>([]);
  const [contactGroup, setContactGroup] = useState<'AR' | 'AP'>('AR');
  const [contactSort, setContactSort] = useState<{ key: 'name' | 'paid' | 'unpaid' | 'aging'; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [contactDetailId, setContactDetailId] = useState<string | null>(null);
  const [contactTxns, setContactTxns] = useState<{ id: string; date: Date; description: string; amount: number; unpaid: number }[]>([]);

  const load = useCallback(async () => {
    const contacts = await db.contacts.filter(c => c.isActive).toArray();
    const txs = (await db.transactions.toArray()).filter(tx => !tx.isDeleted && tx.contactId);
    const byId = new Map<string, { name: string; ar: number; ap: number; unpaid: number; aging: number }>();
    for (const c of contacts) byId.set(c.id, { name: c.name, ar: 0, ap: 0, unpaid: 0, aging: 0 });
    for (const tx of txs) {
      const row = byId.get(tx.contactId as string);
      if (!row) continue;
      const amount = tx.entries.reduce((s, e) => s + e.debit, 0);
      if (tx.type === 'income') row.ar += amount;
      else if (tx.type === 'expense') row.ap += amount;
      row.unpaid += tx.totalUnpaid || 0;
      row.aging = Math.max(row.aging, tx.agingDays || 0);
    }
    const rows = [...byId.entries()].map(([id, v]) => ({ id, name: v.name, group: contactGroup, paid: contactGroup === 'AR' ? v.ar : v.ap, unpaid: v.unpaid, aging: v.aging }));
    setContactRows(rows);
  }, [contactGroup]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {(['AR', 'AP'] as const).map(g => (
          <Button key={g} size="sm" variant={contactGroup === g ? 'default' : 'outline'} className="h-7 text-[10px] px-2" onClick={() => { setContactGroup(g); setContactDetailId(null); }}>
            {g}
          </Button>
        ))}
      </div>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="bg-red-50 dark:bg-red-950">
            {(['name', 'paid', 'unpaid', 'aging'] as const).map(k => (
              <th key={k} onClick={() => setContactSort(s => ({ key: k, dir: s.key === k && s.dir === 1 ? -1 : 1 }))} className={`p-3 font-medium cursor-pointer select-none ${k === 'name' ? 'text-left' : 'text-right'}`}>
                {k === 'name' ? t('rep.customer', lang) : k === 'paid' ? t('rep.paid', lang) : k === 'unpaid' ? t('rep.unpaid', lang) : t('rep.aging', lang)}{contactSort.key === k ? (contactSort.dir === 1 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contactRows
            .filter(r => r.paid > 0 || r.unpaid > 0)
            .sort((a, b) => {
              const k = contactSort.key;
              const va = a[k];
              const vb = b[k];
              const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
              return cmp * contactSort.dir;
            })
            .map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="text-right p-3">{formatNumber(r.paid)}</td>
                <td className="text-right p-3">
                  {r.unpaid > 0 ? (
                    <button className="underline" onClick={async () => {
                      setContactDetailId(r.id);
                      const txs = (await db.transactions.orderBy('date').toArray()).filter(tx => !tx.isDeleted && tx.contactId === r.id && (tx.totalUnpaid || 0) > 0);
                      setContactTxns(txs.map(tx => ({ id: tx.id, date: tx.date, description: tx.description, amount: tx.entries.reduce((s, e) => s + e.debit, 0), unpaid: tx.totalUnpaid || 0 })));
                    }}>{formatNumber(r.unpaid)}</button>
                  ) : '0'}
                </td>
                <td className="text-right p-3">{r.aging > 0 ? `${r.aging}d` : '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {contactDetailId && (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-semibold mb-2">{t('rep.outstandingTxns', lang)}</p>
          {contactTxns.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('rep.noOutstanding', lang)}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {contactTxns.map(tx => (
                  <tr key={tx.id} className="border-t">
                    <td className="p-2 text-xs">{formatDate(tx.date, lang)}</td>
                    <td className="p-2 text-xs">{tx.description}</td>
                    <td className="text-right p-2 text-xs">{formatNumber(tx.unpaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
