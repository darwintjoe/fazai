'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore, type PendingReceipt } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { db } from '@/lib/fazai-db';
import { formatNumber } from '@/lib/format';
import { type AiProviderConfig, type AiProviderId } from '@/lib/ai-provider';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Loader2, AlertCircle, CheckCircle, Pencil, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OcrResult {
  type: 'income' | 'expense';
  amount: number;
  counterparty: string;
  description: string;
  accountId: string;
  accountName: string;
  date: string;
  reference: string;
}

type OcrStatus = 'loading-image' | 'loading-ocr' | 'success' | 'error' | 'no-image' | 'no-ai';

export function ReceiptOcr() {
  const { lang } = useAuthStore();
  const { navigate, setPendingReceipt } = useAppStore();
  const { toast } = useToast();

  const [status, setStatus] = useState<OcrStatus>('loading-image');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Load shared image from Cache API
  const loadSharedImage = useCallback(async () => {
    try {
      const cache = await caches.open('shared-files');

      // Try to find the shared image (could be /shared-image-0, /shared-image, etc.)
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

      // Clean up cache entries
      for (const key of keys) {
        if (key.url.includes('/shared-image') || key.url.includes('/shared-meta') || key.url.includes('/shared-count')) {
          await cache.delete(key);
        }
      }

      // Convert blob to base64 for API call
      setStatus('loading-ocr');
      const base64 = await blobToBase64(blob);
      await performOcr(base64);
    } catch (err) {
      console.error('Error loading shared image:', err);
      setStatus('no-image');
    }
  }, [lang]);

  // Perform OCR via AI API
  const performOcr = useCallback(async (base64: string) => {
    try {
      // Load AI config from DB (same pattern as ai-chat.tsx)
      const [provSetting, modelSetting, keySetting, endpointSetting] = await Promise.all([
        db.settings.get('ai-provider'),
        db.settings.get('ai-model'),
        db.settings.get('ai-api-key'),
        db.settings.get('ai-endpoint'),
      ]);
      const accounts = await db.accounts.where('isActive').equals(1).toArray();

      const apiKey = keySetting?.value as string | undefined;
      if (!apiKey) {
        setStatus('no-ai');
        return;
      }

      const aiConfig: AiProviderConfig = {
        provider: ((provSetting?.value as string) || 'openai') as AiProviderId,
        model: (modelSetting?.value as string) || '',
        apiKey,
        endpoint: (endpointSetting?.value as string) || undefined,
      };

      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
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

      if (data.error === 'AI_API_KEY_NOT_SET') {
        setStatus('no-ai');
        return;
      }

      if (!res.ok || data.error) {
        setStatus('error');
        setErrorMessage(data.message || data.error || 'OCR failed');
        return;
      }

      setOcrResult(data);
      setStatus('success');
    } catch (err: any) {
      console.error('OCR error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Network error');
    }
  }, [lang]);

  useEffect(() => {
    loadSharedImage();
  }, [loadSharedImage]);

  // Navigate to transaction form with pre-filled data
  const handleUseData = useCallback(() => {
    if (!ocrResult) return;

    const receipt: PendingReceipt = {
      amount: ocrResult.amount,
      counterparty: ocrResult.counterparty,
      description: ocrResult.description,
      accountId: ocrResult.accountId || undefined,
      accountName: ocrResult.accountName || undefined,
      date: ocrResult.date || undefined,
    };

    setPendingReceipt(receipt);
    navigate(ocrResult.type === 'income' ? 'income' : 'expense');
  }, [ocrResult, setPendingReceipt, navigate]);

  const handleRetry = useCallback(() => {
    if (imageUrl) {
      // Re-fetch the image as base64
      setStatus('loading-ocr');
      fetch(imageUrl)
        .then(r => r.blob())
        .then(blob => blobToBase64(blob))
        .then(base64 => performOcr(base64))
        .catch(() => {
          setStatus('error');
          setErrorMessage('Failed to reload image');
        });
    }
  }, [imageUrl, performOcr]);

  const handleCancel = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    navigate('dashboard');
  }, [imageUrl, navigate]);

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleCancel} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-red-600">{t('receipt.title', lang)}</h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">

        {/* Image Preview */}
        {imageUrl && (
          <div className="rounded-xl overflow-hidden border bg-card">
            <img
              src={imageUrl}
              alt="Shared receipt"
              className="w-full max-h-64 object-contain bg-muted"
            />
          </div>
        )}

        {/* Loading image */}
        {status === 'loading-image' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">{t('receipt.processing', lang)}</p>
          </div>
        )}

        {/* Loading OCR */}
        {status === 'loading-ocr' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">{t('receipt.processing', lang)}</p>
            <p className="text-xs text-muted-foreground">AI is reading your receipt...</p>
          </div>
        )}

        {/* No image */}
        {status === 'no-image' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Camera className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('receipt.noImage', lang)}</p>
            <Button variant="outline" onClick={handleCancel} className="mt-2">
              {t('common.back', lang)}
            </Button>
          </div>
        )}

        {/* AI not configured */}
        {status === 'no-ai' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
            <p className="text-sm text-muted-foreground">{t('receipt.aiNotConfigured', lang)}</p>
            <Button variant="outline" onClick={handleCancel} className="mt-2">
              {t('common.back', lang)}
            </Button>
          </div>
        )}

        {/* OCR Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-muted-foreground">{t('receipt.error', lang)}</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={handleRetry} size="sm">
                {t('receipt.retry', lang)}
              </Button>
              <Button variant="outline" onClick={handleCancel} size="sm">
                {t('common.cancel', lang)}
              </Button>
            </div>
          </div>
        )}

        {/* OCR Success */}
        {status === 'success' && ocrResult && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">{t('receipt.extracted', lang)}</span>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              {/* Transaction Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('receipt.type', lang)}</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  ocrResult.type === 'income'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {ocrResult.type === 'income' ? t('dash.income', lang) : t('dash.expense', lang)}
                </span>
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('form.amount', lang)}</span>
                <span className="text-lg font-bold">
                  {ocrResult.amount > 0 ? formatNumber(ocrResult.amount) : '—'}
                </span>
              </div>

              {/* Counterparty */}
              {ocrResult.counterparty && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('receipt.fromReceipt', lang)}
                  </span>
                  <span className="text-sm font-medium">{ocrResult.counterparty}</span>
                </div>
              )}

              {/* Account */}
              {ocrResult.accountName && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('form.account', lang)}</span>
                  <span className="text-sm font-medium">{ocrResult.accountName}</span>
                </div>
              )}

              {/* Description */}
              {ocrResult.description && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('form.description', lang)}</span>
                  <span className="text-sm text-right max-w-[60%]">{ocrResult.description}</span>
                </div>
              )}

              {/* Date */}
              {ocrResult.date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('form.date', lang)}</span>
                  <span className="text-sm">{ocrResult.date}</span>
                </div>
              )}

              {/* Reference */}
              {ocrResult.reference && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('receipt.reference', lang)}</span>
                  <span className="text-xs text-muted-foreground font-mono">{ocrResult.reference}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUseData}
                disabled={ocrResult.amount <= 0}
                className={`flex-1 h-12 text-base font-semibold ${
                  ocrResult.type === 'income'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                    : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
                } text-white`}
              >
                <Pencil className="w-4 h-4 mr-2" />
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

/** Convert a Blob to a base64 data URI string */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
