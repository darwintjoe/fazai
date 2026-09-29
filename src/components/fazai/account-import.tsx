'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { db, type Account, type AccountCategory } from '@/lib/fazai-db';
import { createOpeningBalanceTransaction } from '@/lib/ledger-engine';
import { formatNumber, parseFormattedNumber, today } from '@/lib/format';
import {
  rowsToAccounts, textToRows, toTitleCase, matchExistingFuzzy,
  type ParsedAccountRow,
} from '@/lib/account-import';
import { CAT_TYPE_MAP, CAT_ROOTS, BS_CATS } from './add-account-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type ImportState = 'upload' | 'parsing' | 'review' | 'submitting' | 'done';
type Decision = 'new' | 'update' | 'keep';

interface ReviewRow {
  key: string;
  name: string;
  categoryId: string;
  guessed: boolean;
  confirmed: boolean;
  balance: number | null;
  included: boolean;
  existing: Account | null;
  sameCategory: boolean;
  decision: Decision;
}

function labels(lang: string) {
  if (lang === 'id') return {
    title: 'Impor Akun', pick: 'Pilih file CSV, PDF, atau gambar', hint: 'Maks 5MB. Satu file. Hanya nama akun wajib.',
    noRows: 'Tidak ada akun terdeteksi. Coba file yang lebih rapi.',
    tooBig: 'File melebihi 5MB.', review: 'Tinjau & Konfirmasi', submit: 'Simpan Akun',
    before: 'Sebelum', after: 'Sesudah', keep: 'Lewati', update: 'Pindah kategori', addNew: 'Buat baru',
    conflict: 'Nama sudah ada, kategori beda', dupSame: 'Sudah ada (sama)', guessed: 'Kategori tebakan — konfirmasi',
    plWarn: 'Saldo di kategori PL akan tetap dibuat sebagai Saldo Awal',
  };
  if (lang === 'zh') return {
    title: '导入科目', pick: '选择 CSV、PDF 或图片文件', hint: '最大5MB。单个文件。仅科目名称为必填。',
    noRows: '未检测到科目，请尝试更清晰的文件。',
    tooBig: '文件超过5MB。', review: '核对并确认', submit: '保存科目',
    before: '导入前', after: '导入后', keep: '跳过', update: '更改分类', addNew: '新建',
    conflict: '名称已存在但分类不同', dupSame: '已存在（相同）', guessed: '分类为猜测 — 请确认',
    plWarn: 'PL分类的余额仍将创建为期初余额',
  };
  return {
    title: 'Import Accounts', pick: 'Select a CSV, PDF, or image file', hint: 'Max 5MB. Single file. Only account name is required.',
    noRows: 'No accounts detected. Try a cleaner file.',
    tooBig: 'File exceeds 5MB.', review: 'Review & Confirm', submit: 'Save Accounts',
    before: 'Before', after: 'After', keep: 'Skip', update: 'Change category', addNew: 'Create new',
    conflict: 'Name exists with different category', dupSame: 'Already exists (same)', guessed: 'Guessed category — confirm',
    plWarn: 'PL balances will still be created as Opening Balance',
  };
}

export function AccountImport({ onBack }: { onBack: () => void }) {
  const { lang, userId } = useAuthStore();
  const { bumpTxVersion } = useAppStore();
  const { toast } = useToast();
  const L = labels(lang);
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>('upload');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [beforeTotal, setBeforeTotal] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);

  const loadCats = useCallback(async () => {
    const all = await db.accountCategories.toArray();
    setCategories(all.filter(c => c.isActive).sort((a, b) => a.order - b.order));
    return all.filter(c => c.isActive);
  }, []);

  const buildReview = useCallback((parsed: ParsedAccountRow[], cats: AccountCategory[], existing: Account[]) => {
    const review: ReviewRow[] = parsed.map((p, i) => {
      const dup = matchExistingFuzzy(p.name, existing);
      const sameCategory = !!dup && dup.categoryId === p.categoryId;
      const isDup = !!dup;
      return {
        key: `${p.id}-${i}`,
        name: p.name,
        categoryId: p.categoryId ?? 'cat-other-expense',
        guessed: p.categoryGuessed,
        confirmed: !p.categoryGuessed,
        balance: p.balance,
        included: !isDup || !sameCategory,
        existing: dup,
        sameCategory,
        decision: !dup ? 'new' : sameCategory ? 'keep' : 'new',
      };
    });
    setRows(review);
  }, []);

  const aiFallback = useCallback(async (rawText: string, cats: AccountCategory[]): Promise<ParsedAccountRow[] | null> => {
    try {
      const [provSetting, modelSetting, keySetting, endpointSetting] = await Promise.all([
        db.settings.get('ai-provider'), db.settings.get('ai-model'),
        db.settings.get('ai-api-key'), db.settings.get('ai-endpoint'),
      ]);
      const apiKey = keySetting?.value as string | undefined;
      if (!apiKey && !(provSetting?.value === 'zai' || !provSetting?.value)) {
        // still try — server may inject env key
      }
      const res = await fetch('/api/ai/parse-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText.slice(0, 12000),
          lang,
          categories: cats.map(c => ({ id: c.id, name: c.name, nameId: c.nameId, nameZh: c.nameZh, group: c.group })),
          aiConfig: {
            provider: (provSetting?.value as string) || 'zai',
            model: (modelSetting?.value as string) || '',
            apiKey: apiKey || '',
            endpoint: (endpointSetting?.value as string) || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.accounts) || data.accounts.length === 0) return null;
      return data.accounts.map((a: any, i: number) => ({
        id: `ai-${i}`,
        name: toTitleCase(String(a.name || '')),
        categoryId: typeof a.category === 'string' ? a.category : 'cat-other-expense',
        categoryGuessed: true,
        balance: typeof a.balance === 'number' ? a.balance : null,
        needsCategoryConfirm: true,
        raw: [String(a.name || '')],
      }));
    } catch {
      return null;
    }
  }, [lang]);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError(L.tooBig);
      return;
    }
    setFileName(file.name);
    setState('parsing');
    try {
      const cats = await loadCats();
      const existing = await db.accounts.toArray();
      setBeforeTotal(existing.filter(a => a.parentId).length);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const isCsv = ext === 'csv' || file.type.includes('csv');
      const isPdf = ext === 'pdf' || file.type.includes('pdf');
      const isImg = !isCsv && !isPdf;

      let parsed: ParsedAccountRow[] = [];
      let rawText = '';

      if (isCsv) {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
        const strRows = aoa.map(r => r.map((c: any) => String(c ?? '').trim()));
        parsed = rowsToAccounts(strRows, cats);
      } else if (isPdf) {
        const { extractTextFromFile } = await import('@/lib/pdf-extract');
        rawText = await extractTextFromFile(file);
        parsed = rowsToAccounts(textToRows(rawText), cats);
        if (parsed.length === 0 && rawText.trim()) {
          const ai = await aiFallback(rawText, cats);
          if (ai) parsed = ai;
        }
      } else {
        const { recognizeReceipt } = await import('@/lib/ocr-engine');
        rawText = await recognizeReceipt(file, lang);
        parsed = rowsToAccounts(textToRows(rawText), cats);
        if (parsed.length === 0 && rawText.trim()) {
          const ai = await aiFallback(rawText, cats);
          if (ai) parsed = ai;
        }
      }

      // Drop image type check failures
      if (isImg && !file.type.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
        setError(L.noRows);
        setState('upload');
        return;
      }

      if (parsed.length === 0) {
        setError(L.noRows);
        setState('upload');
        return;
      }
      buildReview(parsed.slice(0, 500), cats, existing);
      setState('review');
    } catch (err: any) {
      setError(err?.message || 'Failed to parse file');
      setState('upload');
    }
  }, [L.tooBig, L.noRows, aiFallback, buildReview, lang, loadCats]);

  const updateRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const summary = useMemo(() => {
    const active = rows.filter(r => r.included && r.name.trim());
    const toAdd = active.filter(r => !r.existing || r.decision === 'new').length;
    const toUpdate = active.filter(r => r.existing && r.decision === 'update').length;
    const skipped = rows.length - active.length + active.filter(r => r.existing && r.decision === 'keep').length;
    const openingTotal = active.reduce((s, r) => s + (r.balance || 0), 0);
    const plWarn = active.filter(r => r.balance !== null && (r.balance || 0) !== 0 && !BS_CATS.has(r.categoryId)).length;
    const unconfirmed = active.filter(r => r.guessed && !r.confirmed).length;
    return { active: active.length, toAdd, toUpdate, skipped, openingTotal, plWarn, unconfirmed, canSubmit: active.length > 0 && unconfirmed === 0 };
  }, [rows]);

  const handleSubmit = useCallback(async () => {
    setState('submitting');
    try {
      const active = rows.filter(r => r.included && r.name.trim());
      const allAccounts = await db.accounts.toArray();
      // per-category max code suffix for new accounts
      const maxSuffix = new Map<string, number>();
      for (const a of allAccounts) {
        if (!a.parentId) continue;
        const parts = a.code.split('-');
        const n = parts.length > 1 ? parseInt(parts[1]) : 0;
        if (!isNaN(n)) maxSuffix.set(a.categoryId, Math.max(maxSuffix.get(a.categoryId) ?? 0, n));
      }
      let created = 0;
      let updated = 0;
      for (const r of active) {
        const name = toTitleCase(r.name);
        const type = CAT_TYPE_MAP[r.categoryId] || 'expense';
        if (r.existing && r.decision === 'update') {
          await db.accounts.update(r.existing.id, { categoryId: r.categoryId, type });
          updated++;
          if (r.balance !== null && r.balance !== 0) {
            try {
              await createOpeningBalanceTransaction({ accountId: r.existing.id, amount: Math.abs(r.balance), date: today(), userId: userId || '' });
            } catch (e) { console.error(e); }
          }
          continue;
        }
        if (r.existing && r.decision === 'keep') continue;
        // dedupe against accounts created earlier in this batch
        const dupNow = await db.accounts.toArray().then(list => matchExistingFuzzy(name, list));
        if (dupNow) continue;
        const next = (maxSuffix.get(r.categoryId) ?? 0) + 100;
        maxSuffix.set(r.categoryId, next);
        const prefix = type === 'asset' || type === 'cashBank' ? '1' : type === 'liability' ? '2' : type === 'equity' ? '3' : type === 'income' ? '4' : '5';
        const id = `acc-${uuid()}`;
        await db.accounts.add({
          id, code: `${prefix}-${String(next).padStart(4, '0')}`,
          name, type, categoryId: r.categoryId,
          parentId: CAT_ROOTS[r.categoryId],
          isSystem: false, isActive: true, createdAt: new Date(),
        });
        created++;
        if (r.balance !== null && r.balance !== 0) {
          try {
            await createOpeningBalanceTransaction({ accountId: id, amount: Math.abs(r.balance), date: today(), userId: userId || '' });
          } catch (e) { console.error(e); }
        }
      }
      setCreatedCount(created);
      setUpdatedCount(updated);
      bumpTxVersion();
      setState('done');
      toast({ title: `${created} created, ${updated} updated` });
    } catch (err: any) {
      setError(err?.message || 'Submit failed');
      setState('review');
    }
  }, [rows, userId, bumpTxVersion, toast]);

  const catName = (id: string) => {
    const c = categories.find(x => x.id === id);
    if (!c) return id;
    return lang === 'id' && c.nameId ? c.nameId : lang === 'zh' && c.nameZh ? c.nameZh : c.name;
  };

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold text-red-600">{L.title}</h2>
      </div>

      {state === 'upload' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <FileText className="w-12 h-12 text-muted-foreground" />
          <input ref={fileRef} type="file" accept=".csv,.pdf,.png,.jpg,.jpeg,.webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg py-10 px-4 text-center hover:bg-accent transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">{L.pick}</span>
            {fileName && <span className="text-xs text-muted-foreground mt-1">{fileName}</span>}
          </button>
          <p className="text-xs text-muted-foreground text-center max-w-xs">{L.hint}</p>
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 w-full">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}
        </div>
      )}

      {(state === 'parsing' || state === 'submitting') && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
          <p className="text-sm text-muted-foreground">{fileName}</p>
        </div>
      )}

      {state === 'review' && (
        <div className="flex flex-col gap-3">
          {/* Before / After summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-card p-3">
              <div className="text-[10px] uppercase text-muted-foreground">{L.before}</div>
              <div className="text-xl font-bold tabular-nums">{beforeTotal}</div>
              <div className="text-[10px] text-muted-foreground">accounts</div>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <div className="text-[10px] uppercase text-muted-foreground">{L.after}</div>
              <div className="text-xl font-bold tabular-nums">{beforeTotal + summary.toAdd}</div>
              <div className="text-[10px] text-muted-foreground">+{summary.toAdd} new · {summary.toUpdate} updated · {summary.skipped} skipped</div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Opening total</span><span className="font-medium tabular-nums">{formatNumber(summary.openingTotal)}</span></div>
            {summary.plWarn > 0 && <div className="text-amber-600 text-[11px]">{L.plWarn} ({summary.plWarn})</div>}
            {summary.unconfirmed > 0 && <div className="text-amber-600 text-[11px]">{L.guessed}: {summary.unconfirmed}</div>}
          </div>

          {/* Embedded table */}
          <div className="flex flex-col gap-2">
            {rows.map(r => (
              <div key={r.key} className={`rounded-lg border bg-card p-3 space-y-2 ${!r.included ? 'opacity-50' : ''} ${r.guessed && !r.confirmed ? 'border-amber-400' : ''}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={r.included} onChange={e => updateRow(r.key, { included: e.target.checked })} className="w-4 h-4 accent-red-600" />
                  <Input value={r.name} onChange={e => updateRow(r.key, { name: e.target.value })}
                    onBlur={e => updateRow(r.key, { name: toTitleCase(e.target.value) })}
                    className="h-8 text-xs font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={r.categoryId} onValueChange={v => updateRow(r.key, { categoryId: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['BS', 'PL'] as const).map(g => (
                        <React.Fragment key={g}>
                          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">{g === 'BS' ? 'Balance Sheet' : 'Profit & Loss'}</div>
                          {categories.filter(c => c.group === g).map(c => (
                            <SelectItem key={c.id} value={c.id}>{catName(c.id)}</SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="text" inputMode="numeric" value={r.balance === null ? '' : String(r.balance)}
                    onChange={e => updateRow(r.key, { balance: e.target.value === '' ? null : parseFormattedNumber(e.target.value) })}
                    placeholder="0" className="h-8 text-xs tabular-nums" />
                </div>
                {r.guessed && (
                  <label className="flex items-center gap-2 text-[11px]">
                    <input type="checkbox" checked={r.confirmed} onChange={e => updateRow(r.key, { confirmed: e.target.checked })} className="w-3.5 h-3.5 accent-red-600" />
                    <span className="text-amber-600">{L.guessed}: {catName(r.categoryId)}</span>
                  </label>
                )}
                {r.existing && (
                  <div className="text-[11px] space-y-1">
                    <div className={r.sameCategory ? 'text-muted-foreground' : 'text-amber-600'}>
                      {r.sameCategory ? L.dupSame : `${L.conflict}: ${r.existing.name} (${catName(r.existing.categoryId)})`}
                    </div>
                    {!r.sameCategory && (
                      <div className="flex gap-1">
                        {(['new', 'update', 'keep'] as Decision[]).map(d => (
                          <button key={d} onClick={() => updateRow(r.key, { decision: d, included: d !== 'keep' ? r.included : false })}
                            className={`px-2 py-1 rounded text-[10px] border ${r.decision === d ? 'bg-red-600 text-white border-red-600' : 'bg-background'}`}>
                            {d === 'new' ? L.addNew : d === 'update' ? L.update : L.keep}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSubmit} disabled={!summary.canSubmit}
            className="h-12 text-base font-semibold bg-gradient-to-r from-red-600 to-red-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-2" />{L.submit} ({summary.active})
          </Button>
          {!summary.canSubmit && summary.active > 0 && (
            <p className="text-[11px] text-amber-600 text-center">{L.guessed}: {summary.unconfirmed}</p>
          )}
        </div>
      )}

      {state === 'done' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <p className="text-sm font-medium">{createdCount} created · {updatedCount} updated</p>
          <Button onClick={onBack}>Back</Button>
        </div>
      )}
    </div>
  );
}
