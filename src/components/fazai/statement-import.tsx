'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { formatNumber } from '@/lib/format';
import { type AiProviderConfig, type AiProviderId } from '@/lib/ai-provider';
import type { Lang } from '@/lib/i18n';
import { createIncomeTransaction, createExpenseTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle2,
  FileText, Lock, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ParsedTx {
  date: string;
  description: string;
  counterparty: string;
  amount: number;
  type: 'income' | 'expense';
  accountId: string;
  accountName: string;
  sourceAccountId: string;
}

type ImportState = 'upload' | 'extracting' | 'parsing' | 'review' | 'submitting' | 'done';

export function StatementImport() {
  const { lang, userId } = useAuthStore();
  const { goBack, bumpTxVersion } = useAppStore();
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>('upload');
  const [fileName, setFileName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<ParsedTx[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [categories, setCategories] = useState<Account[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<Account[]>([]);
  const [createdCount, setCreatedCount] = useState(0);

  // Load accounts on mount
  React.useEffect(() => {
    (async () => {
      const allAccounts = await db.accounts.filter(a => a.isActive && !!a.parentId).toArray();
      setCategories(allAccounts.filter(a => a.type === 'income' || a.type === 'expense'));
      setSourceAccounts(allAccounts.filter(a => a.type === 'cashBank'));
    })();
  }, []);

  // Toggle a transaction checked state
  const toggleCheck = useCallback((idx: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (checked.size === transactions.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(transactions.map((_, i) => i)));
    }
  }, [checked.size, transactions.length]);

  // Update a field on a specific transaction (for inline editing)
  const updateTx = useCallback((idx: number, field: keyof ParsedTx, value: string | number) => {
    setTransactions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setError('');

    // Step 1: Extract text from PDF
    setState('extracting');
    let text = '';
    try {
      const { extractTextFromFile } = await import('@/lib/pdf-extract');
      text = await extractTextFromFile(file, password || undefined);
    } catch (err: any) {
      // If password error, prompt user to enter password
      if (err?.message?.includes('password') || err?.name === 'PasswordException') {
        setError(lang === 'id' ? 'PDF terenkripsi. Masukkan kata sandi.' : lang === 'zh' ? 'PDF已加密，请输入密码。' : 'PDF is encrypted. Please enter the password.');
        setState('upload');
        return;
      }
      setError(err.message || 'Failed to read PDF');
      setState('upload');
      return;
    }

    if (!text.trim()) {
      setError(lang === 'id' ? 'Tidak ada teks ditemukan di PDF.' : lang === 'zh' ? 'PDF中未找到文本。' : 'No text found in PDF.');
      setState('upload');
      return;
    }

    // Step 2: Send text to AI for parsing
    setState('parsing');
    try {
      const [provSetting, modelSetting, keySetting, endpointSetting] = await Promise.all([
        db.settings.get('ai-provider'),
        db.settings.get('ai-model'),
        db.settings.get('ai-api-key'),
        db.settings.get('ai-endpoint'),
      ]);
      const allAccounts = await db.accounts.filter(a => a.isActive).toArray();

      const apiKey = keySetting?.value as string | undefined;
      const provId = (provSetting?.value as string) || 'groq';

      const aiConfig: AiProviderConfig = {
        provider: provId as AiProviderId,
        model: (modelSetting?.value as string) || '',
        apiKey: apiKey || '',
        endpoint: (endpointSetting?.value as string) || undefined,
      };

      const res = await fetch('/api/ai/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          lang,
          accounts: allAccounts.map(a => ({
            id: a.id,
            name: a.name,
            nameId: a.nameId,
            nameZh: a.nameZh,
            type: a.type,
            code: a.code,
          })),
          aiConfig,
        }),
      });

      const data = await res.json();

      if (data.error === 'AI_API_KEY_NOT_SET' || (!res.ok && data.error)) {
        setError(data.message || data.error || 'AI parsing failed');
        setState('upload');
        return;
      }

      const txs: ParsedTx[] = data.transactions || [];
      if (txs.length === 0) {
        setError(lang === 'id' ? 'Tidak ada transaksi terdeteksi.' : lang === 'zh' ? '未检测到交易。' : 'No transactions detected.');
        setState('upload');
        return;
      }

      setTransactions(txs);
      setChecked(new Set(txs.map((_, i) => i)));
      setState('review');
    } catch (err: any) {
      setError(err.message || 'AI parsing failed');
      setState('upload');
    }
  }, [lang, password]);

  // Submit all checked transactions
  const handleSubmitAll = useCallback(async () => {
    setState('submitting');
    setCreatedCount(0);

    const selectedTxs = transactions.filter((_, i) => checked.has(i));

    try {
      for (const tx of selectedTxs) {
        const date = new Date(tx.date);
        if (isNaN(date.getTime())) continue;

        const amount = Math.abs(tx.amount);

        if (tx.type === 'income') {
          await createIncomeTransaction({
            amount,
            counterparty: tx.counterparty,
            incomeAccountId: tx.accountId,
            opponentAccountId: tx.sourceAccountId,
            description: tx.description,
            date,
            userId: userId || '',
          });
        } else {
          await createExpenseTransaction({
            amount,
            counterparty: tx.counterparty,
            expenseAccountId: tx.accountId,
            opponentAccountId: tx.sourceAccountId,
            description: tx.description,
            date,
            userId: userId || '',
          });
        }
        setCreatedCount(prev => prev + 1);
      }

      bumpTxVersion();
      setState('done');
      toast({
        title: lang === 'id' ? 'Impor Berhasil' : lang === 'zh' ? '导入成功' : 'Import Successful',
        description: `${createdCount} ${lang === 'id' ? 'transaksi dibuat' : lang === 'zh' ? '笔交易已创建' : 'transactions created'}`,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create transactions');
      setState('review');
    }
  }, [transactions, checked, userId, lang, bumpTxVersion, toast, createdCount]);

  // Computed summary
  const selectedTxs = transactions.filter((_, i) => checked.has(i));
  const totalIncome = selectedTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = selectedTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);

  const handleCancel = () => goBack();

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleCancel} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-red-600">
          {lang === 'id' ? 'Impor Mutasi Bank' : lang === 'zh' ? '导入银行对账单' : 'Bank Statement Import'}
        </h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">

        {/* ── Upload State ── */}
        {state === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <FileText className="w-12 h-12 text-muted-foreground" />

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg py-10 px-4 text-center hover:bg-accent transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {lang === 'id' ? 'Pilih file PDF' : lang === 'zh' ? '选择PDF文件' : 'Select PDF file'}
              </span>
              {fileName && <span className="text-xs text-muted-foreground mt-1">{fileName}</span>}
            </button>

            {/* Password field for encrypted PDFs */}
            <div className="flex items-center gap-2 w-full max-w-xs">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="password"
                placeholder={lang === 'id' ? 'Kata sandi PDF (opsional)' : lang === 'zh' ? 'PDF密码（可选）' : 'PDF password (optional)'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {lang === 'id'
                ? 'Ekstrak teks dari e-statement bank, lalu AI akan mem-parsing setiap baris menjadi transaksi.'
                : lang === 'zh'
                  ? '从银行电子对账单中提取文本，然后AI将逐行解析为交易记录。'
                  : 'Extract text from bank e-statements, then AI parses each row into transactions.'}
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 w-full">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}

            <Button variant="outline" onClick={handleCancel}>{t('common.cancel', lang)}</Button>
          </div>
        )}

        {/* ── Extracting / Parsing State ── */}
        {(state === 'extracting' || state === 'parsing') && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">
              {state === 'extracting'
                ? (lang === 'id' ? 'Membaca PDF...' : lang === 'zh' ? '正在读取PDF...' : 'Reading PDF...')
                : (lang === 'id' ? 'Menganalisis transaksi...' : lang === 'zh' ? '正在分析交易...' : 'Analyzing transactions...')}
            </p>
            <p className="text-xs text-muted-foreground">{fileName}</p>
          </div>
        )}

        {/* ── Review State ── */}
        {state === 'review' && transactions.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Select All toggle */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {checked.size === transactions.length
                  ? (lang === 'id' ? 'Deselect All' : lang === 'zh' ? '取消全选' : 'Deselect All')
                  : (lang === 'id' ? 'Select All' : lang === 'zh' ? '全选' : 'Select All')}
              </button>
              <span className="text-xs text-muted-foreground">
                {checked.size}/{transactions.length} {lang === 'id' ? 'dipilih' : lang === 'zh' ? '已选' : 'selected'}
              </span>
            </div>

            {/* Transaction list */}
            <div className="flex flex-col gap-2">
              {transactions.map((tx, idx) => (
                <TransactionRow
                  key={idx}
                  tx={tx}
                  idx={idx}
                  checked={checked.has(idx)}
                  expanded={expandedIdx === idx}
                  lang={lang}
                  categories={categories}
                  sourceAccounts={sourceAccounts}
                  onToggleCheck={() => toggleCheck(idx)}
                  onToggleExpand={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  onUpdate={(field, value) => updateTx(idx, field, value)}
                />
              ))}
            </div>

            {/* Summary bar */}
            <div className="rounded-xl border bg-card p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {lang === 'id' ? 'Pemasukan' : lang === 'zh' ? '收入' : 'Income'}
                </span>
                <span className="text-green-600 font-medium">+{formatNumber(totalIncome)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {lang === 'id' ? 'Pengeluaran' : lang === 'zh' ? '支出' : 'Expense'}
                </span>
                <span className="text-red-600 font-medium">-{formatNumber(totalExpense)}</span>
              </div>
            </div>

            {/* Submit button */}
            <Button
              onClick={handleSubmitAll}
              disabled={checked.size === 0}
              className="h-12 text-base font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {lang === 'id' ? 'Simpan Semua' : lang === 'zh' ? '保存全部' : 'Submit All'} ({checked.size})
            </Button>
          </div>
        )}

        {/* ── Submitting State ── */}
        {state === 'submitting' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">
              {lang === 'id'
                ? `Membuat ${createdCount}/${selectedTxs.length} transaksi...`
                : lang === 'zh'
                  ? `正在创建 ${createdCount}/${selectedTxs.length} 笔交易...`
                  : `Creating ${createdCount}/${selectedTxs.length} transactions...`}
            </p>
          </div>
        )}

        {/* ── Done State ── */}
        {state === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-sm font-medium">
              {lang === 'id'
                ? `${createdCount} transaksi berhasil dibuat!`
                : lang === 'zh'
                  ? `成功创建 ${createdCount} 笔交易！`
                  : `${createdCount} transactions created!`}
            </p>
            <Button onClick={handleCancel}>
              {lang === 'id' ? 'Kembali' : lang === 'zh' ? '返回' : t('common.back', lang)}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Individual transaction row ── */

interface TxRowProps {
  tx: ParsedTx;
  idx: number;
  checked: boolean;
  expanded: boolean;
  lang: Lang;
  categories: Account[];
  sourceAccounts: Account[];
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  onUpdate: (field: keyof ParsedTx, value: string | number) => void;
}

function TransactionRow({
  tx, idx, checked, expanded, lang,
  categories, sourceAccounts,
  onToggleCheck, onToggleExpand, onUpdate,
}: TxRowProps) {
  const getAccountName = (id: string) => {
    const acc = [...categories, ...sourceAccounts].find(a => a.id === id);
    if (!acc) return id;
    return lang === 'id' && acc.nameId ? acc.nameId : lang === 'zh' && acc.nameZh ? acc.nameZh : acc.name;
  };

  return (
    <div className={`rounded-lg border bg-card overflow-hidden transition-colors ${!checked ? 'opacity-50' : ''}`}>
      {/* Collapsed row */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => { e.stopPropagation(); onToggleCheck(); }}
          className="w-4 h-4 rounded accent-red-600 shrink-0"
        />

        {/* Row number */}
        <span className="text-[10px] text-muted-foreground tabular-nums w-5 text-right shrink-0">{idx + 1}</span>

        {/* Date */}
        <span className="text-xs text-muted-foreground w-20 shrink-0">{tx.date}</span>

        {/* Description + amount */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{tx.description || tx.counterparty || '—'}</div>
        </div>

        {/* Amount */}
        <span className={`text-xs font-bold tabular-nums shrink-0 ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
          {tx.type === 'income' ? '+' : '-'}{formatNumber(tx.amount)}
        </span>

        {/* Expand icon */}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t bg-muted/30 px-3 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* Date */}
            <div>
              <label className="text-[10px] text-muted-foreground">{t('form.date', lang)}</label>
              <input
                type="date"
                value={tx.date}
                onChange={(e) => onUpdate('date', e.target.value)}
                className="w-full h-8 rounded border bg-background px-2 text-xs"
              />
            </div>

            {/* Type toggle */}
            <div>
              <label className="text-[10px] text-muted-foreground">{t('receipt.type', lang)}</label>
              <button
                onClick={() => onUpdate('type', tx.type === 'income' ? 'expense' : 'income')}
                className={`w-full h-8 rounded border text-xs font-medium flex items-center justify-center gap-1 ${
                  tx.type === 'income'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-300'
                }`}
              >
                {tx.type === 'income' ? t('dash.income', lang) : t('dash.expense', lang)}
              </button>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-muted-foreground">{t('form.description', lang)}</label>
              <input
                type="text"
                value={tx.description}
                onChange={(e) => onUpdate('description', e.target.value)}
                className="w-full h-8 rounded border bg-background px-2 text-xs"
              />
            </div>

            {/* Counterparty */}
            <div>
              <label className="text-[10px] text-muted-foreground">{t('receipt.fromReceipt', lang)}</label>
              <input
                type="text"
                value={tx.counterparty}
                onChange={(e) => onUpdate('counterparty', e.target.value)}
                className="w-full h-8 rounded border bg-background px-2 text-xs"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-muted-foreground">{t('form.amount', lang)}</label>
              <input
                type="number"
                value={tx.amount}
                onChange={(e) => onUpdate('amount', parseFloat(e.target.value) || 0)}
                className="w-full h-8 rounded border bg-background px-2 text-xs tabular-nums"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] text-muted-foreground">{t('form.account', lang)}</label>
              <select
                value={tx.accountId}
                onChange={(e) => {
                  onUpdate('accountId', e.target.value);
                  onUpdate('accountName', getAccountName(e.target.value));
                }}
                className="w-full h-8 rounded border bg-background px-2 text-xs"
              >
                {categories.map(a => (
                  <option key={a.id} value={a.id}>
                    {lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Source account (full width) */}
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">
                {lang === 'id' ? 'Sumber Akun' : lang === 'zh' ? '来源账户' : 'Source Account'}
              </label>
              <select
                value={tx.sourceAccountId}
                onChange={(e) => onUpdate('sourceAccountId', e.target.value)}
                className="w-full h-8 rounded border bg-background px-2 text-xs"
              >
                {sourceAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {lang === 'id' && a.nameId ? a.nameId : lang === 'zh' && a.nameZh ? a.nameZh : a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delete button */}
          <div className="flex justify-end">
            <button
              onClick={onToggleCheck}
              className="text-[10px] text-red-500 flex items-center gap-1 hover:underline"
            >
              <Trash2 className="w-3 h-3" />
              {lang === 'id' ? 'Hapus' : lang === 'zh' ? '删除' : 'Remove'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
