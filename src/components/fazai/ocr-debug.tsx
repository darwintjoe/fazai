'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { db } from '@/lib/fazai-db';
import { formatNumber } from '@/lib/format';
import { type AiProviderConfig, type AiProviderId } from '@/lib/ai-provider';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle, Eye, Trash2 } from 'lucide-react';

interface DebugResult {
  model: string;
  provider: string;
  diagnosticResponse: string;
  structuredRawResponse: string;
  parsed: Record<string, unknown>;
  accountsUsed: { income: number; expense: number; cashBank: number };
}

export function OcrDebug() {
  const { lang } = useAuthStore();
  const { goBack } = useAppStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DebugResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setResult(null);

    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRunOcr = useCallback(async () => {
    if (!base64) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Load OCR AI config
      const [provSetting, modelSetting, keySetting, endpointSetting] = await Promise.all([
        db.settings.get('ocr-provider'),
        db.settings.get('ocr-model'),
        db.settings.get('ocr-api-key'),
        db.settings.get('ocr-endpoint'),
      ]);
      const accounts = await db.accounts.filter(a => a.isActive).toArray();

      const apiKey = keySetting?.value as string | undefined;
      const provId = (provSetting?.value as string) || 'groq';

      const aiConfig: AiProviderConfig = {
        provider: provId as AiProviderId,
        model: (modelSetting?.value as string) || '',
        apiKey: apiKey || '',
        endpoint: (endpointSetting?.value as string) || undefined,
      };

      const res = await fetch('/api/ai/ocr-debug', {
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

      if (!res.ok || data.error) {
        setError(data.message || data.error || 'OCR debug failed');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [base64, lang]);

  const handleClear = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setBase64(null);
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }, [imageUrl]);

  const parsed = result?.parsed;

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-red-600">
          OCR Debug
        </h2>
        <Eye className="w-5 h-5 text-muted-foreground" />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">

        {/* Info banner */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-700 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Diagnostic tool — shows what AI model reads from your receipt image and how it interprets the data.
          </p>
        </div>

        {/* Image upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Receipt Image
          </Button>
          {(imageUrl || result) && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Image preview */}
        {imageUrl && (
          <div className="rounded-xl overflow-hidden border bg-card">
            <img
              src={imageUrl}
              alt="Test receipt"
              className="w-full max-h-64 object-contain bg-muted"
            />
          </div>
        )}

        {/* Run button */}
        {base64 && !loading && (
          <Button
            onClick={handleRunOcr}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
          >
            Run OCR
          </Button>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm text-muted-foreground">Sending to AI vision model...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-3">
            {/* Model info */}
            <div className="rounded-xl border bg-card p-3">
              <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Model Used</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Provider:</span>{' '}
                  <span className="font-mono font-medium">{result.provider}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Model:</span>{' '}
                  <span className="font-mono font-medium text-[11px]">{result.model}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Accounts loaded:</span>{' '}
                  <span>{result.accountsUsed.income} income, {result.accountsUsed.expense} expense, {result.accountsUsed.cashBank} cash/bank</span>
                </div>
              </div>
            </div>

            {/* Diagnostic: what AI sees */}
            <div className="rounded-xl border bg-card p-3">
              <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                What AI Reads (Raw Diagnostic)
              </h3>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3 max-h-60 overflow-y-auto">
                {result.diagnosticResponse}
              </pre>
            </div>

            {/* Structured JSON raw response */}
            <div className="rounded-xl border bg-card p-3">
              <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                Structured JSON Response (Raw)
              </h3>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto">
                {result.structuredRawResponse}
              </pre>
            </div>

            {/* Parsed result */}
            <div className="rounded-xl border bg-card p-3">
              <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                Parsed Result
              </h3>
              <div className="space-y-2">
                <Row label="Type" value={String(parsed?.type || '—')} />
                <Row label="Amount" value={typeof parsed?.amount === 'number' && parsed.amount > 0 ? formatNumber(parsed.amount as number) : '⚠ EMPTY'} highlight={typeof parsed?.amount !== 'number' || parsed.amount <= 0} />
                <Row label="Counterparty" value={String(parsed?.counterparty || '—')} />
                <Row label="Description" value={String(parsed?.description || '—')} />
                <Row label="Category" value={String(parsed?.accountName || parsed?.accountId || '—')} />
                <Row label="Payment Method" value={String(parsed?.paymentMethod || parsed?.paymentMethodId || '—')} />
                <Row label="Date" value={String(parsed?.date || '—')} />
                <Row label="Reference" value={String(parsed?.reference || '—')} />
              </div>
            </div>

            {/* Assessment */}
            <div className={`rounded-xl border p-3 ${
              (typeof parsed?.amount === 'number' && parsed.amount > 0 && parsed?.counterparty)
                ? 'border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-700'
                : 'border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700'
            }`}>
              <div className="flex items-center gap-2">
                {(typeof parsed?.amount === 'number' && parsed.amount > 0 && parsed?.counterparty) ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                      OCR extracted amount + counterparty successfully
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-700 dark:text-red-400 font-medium">
                      OCR failed to extract critical fields — check the raw diagnostic above
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium font-mono ${highlight ? 'text-red-600' : ''}`}>{value}</span>
    </div>
  );
}
