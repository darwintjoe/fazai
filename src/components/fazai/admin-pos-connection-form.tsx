'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account, type PosConnection, type PosReportMethod } from '@/lib/fazai-db';
import {
  DEFAULT_PAYMENT_METHOD_MAP,
  DEFAULT_INCOME_ACCOUNT_ID,
  generatePosApiKey,
} from '@/lib/pos-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing an existing connection; null when creating. */
  connection: PosConnection | null;
  onSaved: () => void;
}

const REPORT_METHODS: { value: PosReportMethod; label: string; hint: string }[] = [
  { value: 'immediate', label: 'Immediate', hint: 'POS sends a file per sale → FAZAI posts one ledger entry per sale' },
  { value: 'daily-individual', label: 'Daily (individual)', hint: 'POS sends the day\'s detailed log → FAZAI posts each sale as its own ledger entry' },
  { value: 'daily-total', label: 'Daily (one total)', hint: 'POS sums the day → FAZAI posts one multi-row ledger entry (one debit leg per payment method)' },
];

export function AdminPosConnectionForm({ open, onOpenChange, connection, onSaved }: Props) {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [incomeAccounts, setIncomeAccounts] = useState<Account[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

  const [name, setName] = useState('');
  const [posProvider, setPosProvider] = useState('');
  const [reportMethod, setReportMethod] = useState<PosReportMethod>('immediate');
  const [defaultIncomeAccountId, setDefaultIncomeAccountId] = useState(DEFAULT_INCOME_ACCOUNT_ID);
  // Payment-method mapping rows: each row = { posKey, accountId }
  const [rows, setRows] = useState<{ posKey: string; accountId: string }[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    db.accounts.toArray().then((list) => {
      setAccounts(list);
      setIncomeAccounts(list.filter((a) => a.type === 'income' && a.parentId && a.isActive).sort((a, b) => a.code.localeCompare(b.code)));
      setCashBankAccounts(list.filter((a) => (a.type === 'cashBank' || a.type === 'asset') && a.parentId && a.isActive).sort((a, b) => a.code.localeCompare(b.code)));
    });
  }, []);

  // Hydrate form when opening (create or edit).
  useEffect(() => {
    if (!open) return;
    if (connection) {
      setName(connection.name);
      setPosProvider(connection.posProvider || '');
      setReportMethod(connection.reportMethod);
      setDefaultIncomeAccountId(connection.defaultIncomeAccountId || DEFAULT_INCOME_ACCOUNT_ID);
      setRows(
        Object.entries(connection.paymentMethodMap || {}).map(([posKey, accountId]) => ({
          posKey,
          accountId,
        })),
      );
      setApiKey(connection.apiKey);
    } else {
      setName('');
      setPosProvider('');
      setReportMethod('immediate');
      setDefaultIncomeAccountId(DEFAULT_INCOME_ACCOUNT_ID);
      setRows(
        Object.entries(DEFAULT_PAYMENT_METHOD_MAP).map(([posKey, accountId]) => ({
          posKey,
          accountId,
        })),
      );
      setApiKey(generatePosApiKey());
    }
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connection]);

  const updateRow = (i: number, patch: Partial<{ posKey: string; accountId: string }>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { posKey: '', accountId: cashBankAccounts[0]?.id || '' }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('common.error', lang) });
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: t('admin.name', lang) });
      return;
    }
    // Build the map, dropping rows with an empty posKey (keep rows that just
    // have a key → they'll produce "no account mapped" errors on import, which
    // is the desired explicit behavior rather than silent defaulting).
    const paymentMethodMap: Record<string, string> = {};
    const seenKeys = new Set<string>();
    for (const r of rows) {
      const key = r.posKey.trim();
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      if (r.accountId) paymentMethodMap[key] = r.accountId;
    }

    const now = new Date();
    if (connection) {
      await db.posConnections.update(connection.id, {
        name: trimmedName,
        posProvider: posProvider.trim() || undefined,
        reportMethod,
        defaultIncomeAccountId,
        paymentMethodMap,
        updatedAt: now,
      });
    } else {
      const newConn: PosConnection = {
        id: `pos-${uuid()}`,
        apiKey,
        name: trimmedName,
        posProvider: posProvider.trim() || undefined,
        reportMethod,
        paymentMethodMap,
        defaultIncomeAccountId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.posConnections.add(newConn);
    }
    toast({ title: t('common.success', lang) });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {connection ? t('admin.editPosConn', lang) : t('admin.addPosConn', lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* API key — generated, copyable, not editable */}
          <div>
            <label className="text-xs font-medium">API Key</label>
            <div className="flex gap-1.5 mt-1">
              <Input value={apiKey} readOnly className="h-9 text-xs font-mono" />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopyKey}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {lang === 'id'
                ? 'Tempel key ini ke POS Anda. Sertakan dalam setiap file ekspor.'
                : lang === 'zh'
                ? '将此密钥粘贴到您的POS，并包含在每个导出文件中。'
                : 'Paste this key into your POS. Include it in every export file.'}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">{t('admin.name', lang)}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 text-sm" placeholder="Moka — Front Counter" />
          </div>

          <div>
            <label className="text-xs font-medium">POS Provider</label>
            <Input value={posProvider} onChange={(e) => setPosProvider(e.target.value)} className="mt-1 h-9 text-sm" placeholder="Moka / iSeller / Olsera" />
          </div>

          <div>
            <label className="text-xs font-medium">{t('admin.posReportMethod', lang)}</label>
            <Select value={reportMethod} onValueChange={(v) => setReportMethod(v as PosReportMethod)}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col">
                      <span>{m.label}</span>
                      <span className="text-[10px] text-muted-foreground">{m.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium">{t('admin.posIncomeAccount', lang)}</label>
            <Select value={defaultIncomeAccountId} onValueChange={setDefaultIncomeAccountId}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {incomeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{getAccountName(a, lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment-method mapping */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">{t('admin.posPaymentMap', lang)}</label>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addRow}>
                <Plus className="w-3 h-3 mr-1" /> {t('admin.addRow', lang)}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {lang === 'id'
                ? 'Metode pembayaran POS → akun Kas/Bank FAZAI.'
                : lang === 'zh'
                ? 'POS付款方式 → FAZAI现金/银行账户。'
                : 'POS payment method → FAZAI Cash/Bank account.'}
            </p>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <Input
                    value={r.posKey}
                    onChange={(e) => updateRow(i, { posKey: e.target.value })}
                    placeholder="cash / qris / …"
                    className="h-8 text-xs flex-1"
                  />
                  <Select value={r.accountId} onValueChange={(v) => updateRow(i, { accountId: v })}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {cashBankAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{getAccountName(a, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="text-[11px] text-muted-foreground py-2 text-center">No mappings yet</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t('common.cancel', lang)}</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>{t('common.save', lang)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
