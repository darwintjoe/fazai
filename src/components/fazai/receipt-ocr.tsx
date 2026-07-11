'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore, type PendingReceipt } from '@/lib/app-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { formatNumber, parseFormattedNumber } from '@/lib/format';
import { type AiProviderConfig, type AiProviderId } from '@/lib/ai-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Loader2, AlertCircle, TrendingUp, TrendingDown, X, ImagePlus, Search, XCircle } from 'lucide-react';

type OcrStatus = 'loading-image' | 'scanning' | 'parsing' | 'success' | 'error' | 'failed' | 'no-image';

interface OcrParseResult {
  text: string;
  suggestedType: 'income' | 'expense';
  suggestedAccountId: string;
  suggestedAccountName: string;
  suggestedOpponentAccountId: string;
  amount: number;
  date: string;
  counterparty: string;
  description: string;
  paymentMethod: string;
  source: 'ai' | 'local';
}

export function ReceiptOcr() {
  const { lang } = useAuthStore();
  const { goBack, setPendingReceipt, setAiChatOpen } = useAppStore();

  const [status, setStatus] = useState<OcrStatus>('loading-image');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Parsed result
  const [parseResult, setParseResult] = useState<OcrParseResult | null>(null);

  // User-editable fields (pre-filled by AI/local suggestions)
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Account & opponent account state
  const [categoryAccounts, setCategoryAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [opponentAccounts, setOpponentAccounts] = useState<Account[]>([]);
  const [opponentAccountId, setOpponentAccountId] = useState('acc-cash');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [parseSource, setParseSource] = useState<'ai' | 'local' | ''>('');

  // Load accounts for the selected transaction type
  const loadAccountsForType = useCallback(async (type: 'income' | 'expense') => {
    const accs = await db.accounts.where('type').equals(type).toArray();
    setCategoryAccounts(accs.filter(a => a.parentId && a.isActive));

    const cashAccs = await db.accounts.where('type').equals('asset').toArray();
    const cashBankAccs = await db.accounts.where('type').equals('cashBank').toArray();
    setOpponentAccounts([...cashAccs, ...cashBankAccs].filter(a => a.parentId && a.isActive));
  }, []);

  // Load initial accounts (expense by default)
  useEffect(() => {
    loadAccountsForType('expense');
  }, [loadAccountsForType]);

  // Apply parsed result to form fields
  const applyParseResult = useCallback((result: OcrParseResult) => {
    setParseResult(result);
    setParseSource(result.source);

    // Set type and load matching accounts
    const type = result.suggestedType === 'income' ? 'income' : 'expense';
    setTxType(type);
    loadAccountsForType(type);

    // Pre-fill fields
    if (result.amount > 0) setAmount(formatNumber(result.amount));
    if (result.counterparty) setCounterparty(result.counterparty);
    if (result.description) setDescription(result.description);
    if (result.date) setDateStr(result.date);
    setSelectedAccountId(result.suggestedAccountId || '');
    setOpponentAccountId(result.suggestedOpponentAccountId || 'acc-cash');
  }, [loadAccountsForType]);

  // Handle type toggle — reload accounts for new type
  const handleTypeToggle = useCallback((newType: 'income' | 'expense') => {
    setTxType(newType);
    loadAccountsForType(newType);
    // Reset category account when switching type
    setSelectedAccountId('');
    setAccountSearchQuery('');
  }, [loadAccountsForType]);

  // Handle amount input
  const handleAmountChange = useCallback((value: string) => {
    const parsed = parseFormattedNumber(value);
    if (!isNaN(parsed) || value === '') {
      setAmount(value === '' ? '' : formatNumber(parsed));
    }
  }, []);

  // Perform the full OCR pipeline: local OCR → AI parse → local fallback
  const processReceipt = useCallback(async (blob: Blob) => {
    try {
      // Tier 1: Local OCR
      setStatus('scanning');
      const ocrModule = await import('@/lib/ocr-engine');
      const { text: rawText, blocks } = await ocrModule.recognizeReceiptWithBlocks(blob, lang);

      if (!rawText || rawText.length < 5) {
        setStatus('error');
        setErrorMessage(t('receipt.scanFailed', lang));
        return;
      }

      // Tier 2: AI text parsing (or local fallback)
      setStatus('parsing');

      // Load AI config from chat settings
      const [provSetting, modelSetting, keySetting, endpointSetting] = await Promise.all([
        db.settings.get('ai-provider'),
        db.settings.get('ai-model'),
        db.settings.get('ai-api-key'),
        db.settings.get('ai-endpoint'),
      ]);
      const accounts = await db.accounts.filter(a => a.isActive).toArray();

      const aiConfig: AiProviderConfig = {
        provider: (provSetting?.value as string || 'zai') as AiProviderId,
        model: (modelSetting?.value as string) || '',
        apiKey: (keySetting?.value as string) || '',
        endpoint: (endpointSetting?.value as string) || undefined,
      };

      const res = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          blocks,
          lang,
          accounts: accounts.map(a => ({
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

      // Check for failed transaction rejection
      if (data.failed === true) {
        setStatus('failed');
        return;
      }

      if (!res.ok || data.error) {
        // If AI parsing completely fails, show error (fields will be empty for manual fill)
        setStatus('success');
        applyParseResult({
          text: '',
          suggestedType: 'expense',
          suggestedAccountId: '',
          suggestedAccountName: '',
          suggestedOpponentAccountId: 'acc-cash',
          amount: 0,
          date: '',
          counterparty: '',
          description: '',
          paymentMethod: '',
          source: 'local',
        });
        return;
      }

      setStatus('success');
      applyParseResult(data);
    } catch (err: any) {
      console.error('Receipt processing error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Processing failed');
    }
  }, [lang, applyParseResult]);

  // Load shared image from Cache API
  const loadSharedImage = useCallback(async () => {
    try {
      const cache = await caches.open('shared-files');

      const keys = await cache.keys();
      const imageKey = keys.find(k =>
        k.url.includes('/shared-image-0') || k.url.includes('/shared-image')
      );

      if (!imageKey) {
        setStatus('no-image');
        return;
      }

      const response = await cache.match(imageKey);
      if (!response) {
        setStatus('no-image');
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);
      setImageBlob(blob);

      // Clean up cache entries
      for (const key of keys) {
        if (key.url.includes('/shared-image') || key.url.includes('/shared-meta') || key.url.includes('/shared-count')) {
          await cache.delete(key);
        }
      }

      await processReceipt(blob);
    } catch (err) {
      console.error('Error loading shared image:', err);
      setStatus('no-image');
    }
  }, [processReceipt]);

  useEffect(() => {
    loadSharedImage();
  }, [loadSharedImage]);

  // Navigate to transaction form with pre-filled data
  const handleRecord = useCallback(() => {
    const numAmount = parseFormattedNumber(amount);
    if (numAmount <= 0 || !selectedAccountId) return;

    const receipt: PendingReceipt = {
      amount: numAmount,
      counterparty,
      description,
      accountId: selectedAccountId || undefined,
      accountName: selectedAccountId
        ? getAccountName(categoryAccounts.find(a => a.id === selectedAccountId)!, lang)
        : undefined,
      opponentAccountId: opponentAccountId || undefined,
      date: dateStr || undefined,
    };

    setPendingReceipt(receipt);
    useAppStore.getState().navigate(txType === 'income' ? 'income' : 'expense');
  }, [amount, counterparty, description, selectedAccountId, categoryAccounts, opponentAccountId, dateStr, txType, lang, setPendingReceipt]);

  const handleCancel = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    goBack();
  }, [imageUrl, goBack]);

  const handleRetry = useCallback(() => {
    if (!imageBlob) return;
    setAmount('');
    setCounterparty('');
    setDescription('');
    setDateStr('');
    setSelectedAccountId('');
    setAccountSearchQuery('');
    setParseResult(null);
    setParseSource('');
    processReceipt(imageBlob);
  }, [imageBlob, processReceipt]);

  // Pick from gallery
  const handleGalleryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    setImageBlob(file);
    setAmount('');
    setCounterparty('');
    setDescription('');
    setDateStr('');
    setSelectedAccountId('');
    setAccountSearchQuery('');
    setParseResult(null);
    setParseSource('');

    processReceipt(file);
  }, [imageUrl, processReceipt]);

  // Fallback: send to AI assistant
  const handleAskAi = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setAiChatOpen(true);
    useAppStore.getState().navigate('dashboard');
  }, [imageUrl, setAiChatOpen]);

  // Filtered accounts for dropdown
  const filteredAccounts = accountSearchQuery
    ? categoryAccounts.filter(a => getAccountName(a, lang).toLowerCase().includes(accountSearchQuery.toLowerCase()))
    : [];

  const numAmount = parseFormattedNumber(amount);
  const canRecord = numAmount > 0 && selectedAccountId && opponentAccountId;

  const isFullscreenImage = status === 'loading-image' || status === 'scanning' || status === 'parsing';

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleCancel} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-red-600">{t('receipt.title', lang)}</h2>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryChange}
          className="hidden"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">

        {/* Image Preview */}
        {imageUrl && (
          <div className={`rounded-xl overflow-hidden border bg-card ${isFullscreenImage ? 'flex-1 min-h-[60vh]' : ''}`}>
            <img
              src={imageUrl}
              alt="Receipt"
              className={`w-full object-contain bg-muted ${isFullscreenImage ? 'max-h-[70vh]' : 'max-h-48'}`}
            />
          </div>
        )}

        {/* Loading states */}
        {status === 'loading-image' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">{t('receipt.processing', lang)}</p>
          </div>
        )}

        {status === 'scanning' && (
          <div className="flex flex-col items-center gap-3 py-3">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">{t('receipt.scanning', lang)}</p>
          </div>
        )}

        {status === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-3">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">{t('receipt.parsing', lang)}</p>
          </div>
        )}

        {/* No image */}
        {status === 'no-image' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Camera className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('receipt.noImage', lang)}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={() => galleryInputRef.current?.click()}>
                <ImagePlus className="w-3.5 h-3.5 mr-1" />
                {t('receipt.pickGallery', lang)}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {t('common.back', lang)}
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-muted-foreground">{t('receipt.error', lang)}</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={handleRetry} size="sm">
                {t('receipt.retry', lang)}
              </Button>
              <Button variant="outline" onClick={() => galleryInputRef.current?.click()} size="sm">
                <ImagePlus className="w-3.5 h-3.5 mr-1" />
                {t('receipt.pickGallery', lang)}
              </Button>
              <Button variant="outline" onClick={handleCancel} size="sm">
                {t('common.cancel', lang)}
              </Button>
            </div>
          </div>
        )}

        {/* Failed Transaction — auto-rejected */}
        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm font-semibold text-red-600">{t('receipt.transactionFailed', lang)}</p>
            <p className="text-xs text-muted-foreground">{t('receipt.transactionFailedHint', lang)}</p>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" onClick={handleRetry} size="sm">
                {t('receipt.retry', lang)}
              </Button>
              <Button variant="outline" onClick={() => galleryInputRef.current?.click()} size="sm">
                <ImagePlus className="w-3.5 h-3.5 mr-1" />
                {t('receipt.pickGallery', lang)}
              </Button>
              <Button variant="outline" onClick={handleCancel} size="sm">
                {t('common.cancel', lang)}
              </Button>
            </div>
          </div>
        )}

        {/* Success — Single Review Page */}
        {status === 'success' && (
          <div className="flex flex-col gap-3">
            {/* Parse source badge */}
            {parseSource === 'ai' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[10px] font-medium">AI</span>
                {t('receipt.extracted', lang)}
              </div>
            )}
            {parseSource === 'local' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400 text-[10px] font-medium">LOCAL</span>
                {t('receipt.parseFailed', lang)}
              </div>
            )}

            <div className="rounded-xl border bg-card p-4 space-y-4">
              {/* Income / Expense Toggle — Income LEFT (red), Expense RIGHT (gray) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleTypeToggle('income')}
                  className={`flex items-center justify-center gap-2 min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                    txType === 'income'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  {t('dash.income', lang)}
                </button>
                <button
                  onClick={() => handleTypeToggle('expense')}
                  className={`flex items-center justify-center gap-2 min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                    txType === 'expense'
                      ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  {t('dash.expense', lang)}
                </button>
              </div>

              {/* Account Category Dropdown */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('form.account', lang)}</label>
                {selectedAccountId && (
                  <div className="mt-1 mb-1.5 flex items-center gap-2 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
                    <span className="text-sm font-medium">{getAccountName(categoryAccounts.find(a => a.id === selectedAccountId)!, lang)}</span>
                    <button onClick={() => { setSelectedAccountId(''); setAccountSearchQuery(''); }} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
                  </div>
                )}
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={accountSearchQuery}
                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                    placeholder={t('form.searchAccount', lang)}
                    className="pl-9"
                  />
                </div>
                {accountSearchQuery && (
                  <div className="flex flex-col gap-1 mt-1.5 max-h-40 overflow-y-auto border rounded-lg">
                    {filteredAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => { setSelectedAccountId(acc.id); setAccountSearchQuery(''); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedAccountId === acc.id
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <span>{getAccountName(acc, lang)}</span>
                      </button>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <p className="text-xs text-muted-foreground px-3 py-2">No accounts found</p>
                    )}
                  </div>
                )}
              </div>

              {/* Opponent Account (Cash/Bank) Pills */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('form.opponentAccount', lang)}</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {opponentAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => setOpponentAccountId(acc.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        opponentAccountId === acc.id
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {getAccountName(acc, lang)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('form.amount', lang)}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="text-xl font-bold h-12 mt-1"
                />
              </div>

              {/* Counterparty */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {txType === 'income' ? t('form.from', lang) : t('form.to', lang)}
                </label>
                <Input
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder={txType === 'income' ? 'PT Maju Jaya' : 'Grocery Store'}
                  className="mt-1"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('form.description', lang)}</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes..."
                  className="mt-1"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('form.date', lang)}</label>
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleRecord}
                disabled={!canRecord}
                className={`flex-1 h-12 text-base font-semibold ${
                  txType === 'income'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                    : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
                } text-white`}
              >
                {t('receipt.record', lang)}
              </Button>
              <Button variant="outline" onClick={handleCancel} className="h-12">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
