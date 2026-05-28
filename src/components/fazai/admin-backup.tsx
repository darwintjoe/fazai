'use client';

import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { exportAllData, importAllData, type ExportData } from '@/lib/fazai-db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AdminBackup() {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);

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
    </div>
  );
}
