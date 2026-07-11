'use client';

import React, { useState, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { type PosConnection } from '@/lib/fazai-db';
import { parsePosImportFile, runPosImport, type PosImportResult } from '@/lib/pos-import';
import { useAppStore } from '@/lib/app-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: PosConnection;
  onDone: () => void;
}

export function PosImportDialog({ open, onOpenChange, connection, onDone }: Props) {
  const { lang, userId } = useAuthStore();
  const { bumpTxVersion } = useAppStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PosImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setResult(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Reset after the close transition so the dialog empties cleanly.
      setTimeout(reset, 100);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setRunning(true);
    setResult(null);
    try {
      const raw = await file.text();
      const parsed = parsePosImportFile(raw);
      const res = await runPosImport(parsed, userId || '');
      setResult(res);
      if (res.ok && res.createdCount > 0) {
        bumpTxVersion(); // refresh dashboard / history
      }
      if (res.ok) {
        toast({
          title: t('admin.posImportDone', lang),
          description: `${res.createdCount} ${lang === 'id' ? 'dibuat' : lang === 'zh' ? '已创建' : 'created'} · ${res.skippedCount} ${lang === 'id' ? 'dilewati' : lang === 'zh' ? '已跳过' : 'skipped'}${res.errorCount ? ` · ${res.errorCount} ${lang === 'id' ? 'gagal' : lang === 'zh' ? '失败' : 'errors'}` : ''}`,
        });
      } else {
        toast({ title: t('common.error', lang), description: res.error });
      }
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error', lang), description: msg });
      setResult({ ok: false, error: msg, saleCount: 0, createdCount: 0, skippedCount: 0, errorCount: 0, errors: [] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t('admin.posImportTitle', lang)} — {connection.name}
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {!result && (
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={running}
              className="flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg py-8 px-4 text-center hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-xs font-medium">
                {running ? t('common.loading', lang) : t('admin.posPickFile', lang)}
              </span>
              {fileName && <span className="text-[10px] text-muted-foreground mt-1">{fileName}</span>}
            </button>
            <p className="text-[10px] text-muted-foreground text-center">
              {lang === 'id'
                ? 'Pilih file ekspor JSON dari POS Anda. Penjualan yang sudah diimpor akan dilewati.'
                : lang === 'zh'
                ? '选择POS导出的JSON文件。已导入的销售将被跳过。'
                : 'Pick the JSON export file from your POS. Already-imported sales are skipped.'}
            </p>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2 py-2">
            {result.ok ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span className="text-sm font-medium">{t('admin.posImportDone', lang)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Stat label={lang === 'id' ? 'Dibuat' : lang === 'zh' ? '创建' : 'Created'} value={result.createdCount} tone="green" />
                  <Stat label={lang === 'id' ? 'Dilewati' : lang === 'zh' ? '跳过' : 'Skipped'} value={result.skippedCount} tone="muted" />
                  <Stat label={lang === 'id' ? 'Gagal' : lang === 'zh' ? '失败' : 'Errors'} value={result.errorCount} tone={result.errorCount ? 'red' : 'muted'} />
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 flex flex-col gap-1">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                        <span>{e.saleId ? `[${e.saleId}] ` : ''}{e.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <span className="text-xs">{result.error}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button size="sm" onClick={() => handleClose(false)}>{t('common.close', lang)}</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={running}>
              {t('common.cancel', lang)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' | 'muted' }) {
  const toneCls =
    tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-muted-foreground';
  return (
    <div className="border rounded-md py-1.5 text-center">
      <div className={`text-lg font-bold tabular-nums ${toneCls}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
