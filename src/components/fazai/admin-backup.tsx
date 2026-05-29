'use client';

import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { exportAllData, importAllData, deleteAllTransactions, verifyAdminPin, factoryReset, type ExportData } from '@/lib/fazai-db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Download, Upload, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AdminBackup() {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);

  // Reset state
  const [resetType, setResetType] = useState<'transactions' | 'factory' | null>(null);
  const [challengeCode, setChallengeCode] = useState('');
  const [challengeInput, setChallengeInput] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [resetError, setResetError] = useState('');

  const generateChallenge = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const startReset = (type: 'transactions' | 'factory') => {
    setResetType(type);
    setChallengeCode(generateChallenge());
    setChallengeInput('');
    setAdminPin('');
    setResetError('');
  };

  const handleResetConfirm = async () => {
    if (challengeInput !== challengeCode) {
      setResetError(t('admin.challengeMismatch', lang));
      return;
    }
    const pinValid = await verifyAdminPin(adminPin);
    if (!pinValid) {
      setResetError(t('admin.wrongPin', lang));
      return;
    }
    if (resetType === 'transactions') {
      await deleteAllTransactions();
    } else {
      await factoryReset();
    }
    toast({ title: t('common.success', lang) });
    setResetType(null);
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fazai-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('common.success', lang) });
    } catch {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ExportData;
        if (!data.users || !data.accounts || !data.transactions) {
          toast({ title: t('common.error', lang), description: 'Invalid backup file' });
          return;
        }
        setPendingImportData(data);
        setShowImportConfirm(true);
      } catch {
        toast({ title: t('common.error', lang), description: 'Failed to parse backup file' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!pendingImportData) return;
    try {
      await importAllData(pendingImportData);
      toast({ title: t('common.success', lang) });
    } catch {
      toast({ title: t('common.error', lang), variant: 'destructive' });
    }
    setPendingImportData(null);
    setShowImportConfirm(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">{t('admin.backup', lang)}</h3>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('admin.exportData', lang)}</p>
            <p className="text-xs text-muted-foreground">Download all data as JSON</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> {t('common.export', lang)}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('admin.importData', lang)}</p>
            <p className="text-xs text-muted-foreground">Restore from JSON backup</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> {t('common.import', lang)}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">{t('admin.resetTransactions', lang)}</p>
            <p className="text-xs text-muted-foreground">{t('admin.resetTransactionsDesc', lang)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => startReset('transactions')} className="text-orange-600 border-orange-300 hover:bg-orange-50">
            <Trash2 className="w-4 h-4 mr-1" /> {t('admin.resetTransactions', lang)}
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-red-200 dark:border-red-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">{t('admin.fullFactoryReset', lang)}</p>
            <p className="text-xs text-muted-foreground">{t('admin.fullFactoryResetDesc', lang)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => startReset('factory')} className="text-red-600 border-red-300 hover:bg-red-50">
            <RotateCcw className="w-4 h-4 mr-1" /> {t('admin.fullFactoryReset', lang)}
          </Button>
        </div>
      </Card>

      {/* Import Confirm Dialog */}
      <AlertDialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.confirmImport', lang)}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.importWarning', lang)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', lang)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirm}>{t('common.confirm', lang)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetType !== null} onOpenChange={(open) => { if (!open) setResetType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {t('admin.confirmReset', lang)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetType === 'transactions'
                ? t('admin.resetTransactionsWarning', lang)
                : t('admin.fullResetWarning', lang)
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <p className="text-sm font-medium mb-1">{t('admin.typeToConfirm', lang)}</p>
              <div className="flex items-center gap-2">
                <code className="px-3 py-1.5 bg-muted rounded-md font-mono text-lg tracking-widest font-bold select-all">
                  {challengeCode}
                </code>
              </div>
            </div>
            <div>
              <Input
                value={challengeInput}
                onChange={(e) => { setChallengeInput(e.target.value.toUpperCase()); setResetError(''); }}
                placeholder={t('admin.typeToConfirm', lang)}
                className="font-mono"
              />
            </div>
            <div>
              <Input
                type="password"
                value={adminPin}
                onChange={(e) => { setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setResetError(''); }}
                placeholder={t('admin.enterAdminPin', lang)}
                maxLength={6}
              />
            </div>
            {resetError && (
              <p className="text-sm text-red-500">{resetError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', lang)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              disabled={challengeInput !== challengeCode || adminPin.length !== 6}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('admin.proceedReset', lang)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
