'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { db, type PosConnection, type PosImport } from '@/lib/fazai-db';
import { buildSampleImportFile } from '@/lib/pos-import';
import { formatDateTime, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, ToggleLeft, ToggleRight, Trash2, Upload, Download, Store, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminPosConnectionForm } from './admin-pos-connection-form';
import { PosImportDialog } from './pos-import-dialog';
import { PosDevGuide } from './pos-dev-guide';

const REPORT_METHOD_LABEL: Record<PosConnection['reportMethod'], string> = {
  immediate: 'Immediate',
  'daily-individual': 'Daily (individual)',
  'daily-total': 'Daily (one total)',
};

export function AdminPosConnections() {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [lastImports, setLastImports] = useState<Record<string, PosImport | undefined>>({});
  const [saleTotals, setSaleTotals] = useState<Record<string, number>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PosConnection | null>(null);
  const [importTarget, setImportTarget] = useState<PosConnection | null>(null);
  const [guideTarget, setGuideTarget] = useState<PosConnection | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async () => {
    const list = await db.posConnections.toArray();
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    setConnections(list);
    // Latest import per connection + total imported-sale count per connection.
    const imports = await db.posImports.toArray();
    const latest: Record<string, PosImport | undefined> = {};
    for (const imp of imports) {
      const cur = latest[imp.connectionId];
      if (!cur || imp.importedAt > cur.importedAt) latest[imp.connectionId] = imp;
    }
    setLastImports(latest);

    const sales = await db.posSales.toArray();
    const totals: Record<string, number> = {};
    for (const s of sales) totals[s.connectionId] = (totals[s.connectionId] || 0) + 1;
    setSaleTotals(totals);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const handleEdit = (c: PosConnection) => {
    setEditing(c);
    setFormOpen(true);
  };
  const handleToggleActive = async (c: PosConnection) => {
    await db.posConnections.update(c.id, { isActive: !c.isActive, updatedAt: new Date() });
    toast({ title: t('common.success', lang) });
    load();
  };
  const handleDelete = async (c: PosConnection) => {
    if (!confirm(t('admin.posDeleteConfirm', lang))) return;
    await db.transaction('rw', [db.posConnections, db.posSales, db.posImports], async () => {
      await db.posConnections.delete(c.id);
      await db.posSales.where('connectionId').equals(c.id).delete();
      await db.posImports.where('connectionId').equals(c.id).delete();
    });
    toast({ title: t('common.success', lang) });
    load();
  };

  const handleDownloadSample = (c: PosConnection) => {
    const sample = buildSampleImportFile(c);
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fazai-pos-sample-${c.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5" /> {t('admin.pos', lang)}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { setGuideTarget(null); setGuideOpen(true); }} className="h-8 text-xs">
            <Code2 className="w-3.5 h-3.5 mr-1" /> {t('admin.posDevGuide', lang)}
          </Button>
          <Button size="sm" onClick={handleAdd} className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin.addPosConn', lang)}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {lang === 'id'
          ? 'Hubungkan POS Anda ke FAZAI. Ekspor penjualan dari POS sebagai file JSON (sertakan API key), lalu impor di sini. Penjualan dicatat otomatis sebagai Pendapatan vs Kas/Bank/QRIS.'
          : lang === 'zh'
          ? '将您的POS连接到FAZAI。从POS导出销售为JSON文件（包含API密钥），然后在此导入。销售会自动记为收入 vs 现金/银行/QRIS。'
          : 'Link your POS to FAZAI. Export sales from your POS as a JSON file (include the API key), then import it here. Sales are recorded automatically as Income vs Cash/Bank/QRIS.'}
      </p>

      {connections.length === 0 && (
        <div className="border rounded-lg py-8 text-center text-xs text-muted-foreground">
          {t('admin.posEmpty', lang)}
        </div>
      )}

      {connections.map((c) => {
        const last = lastImports[c.id];
        return (
          <div key={c.id} className={`border rounded-lg p-3 flex flex-col gap-2 ${!c.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  {c.posProvider && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c.posProvider}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{c.apiKey}</div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(c)} title={c.isActive ? t('admin.deactivate', lang) : t('admin.activate', lang)}>
                  {c.isActive ? <ToggleRight className="w-4 h-4 text-red-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(c)} title={t('common.edit', lang)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c)} title={t('common.delete', lang)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>{t('admin.posReportMethod', lang)}: <span className="text-foreground font-medium">{REPORT_METHOD_LABEL[c.reportMethod]}</span></span>
              <span>{lang === 'id' ? 'Penjualan' : lang === 'zh' ? '销售' : 'Sales'}: <span className="text-foreground font-medium">{formatNumber(saleTotals[c.id] || 0)}</span></span>
              {last && (
                <span>{lang === 'id' ? 'Impor terakhir' : lang === 'zh' ? '上次导入' : 'Last import'}: <span className="text-foreground font-medium">{formatDateTime(last.importedAt, lang)}</span></span>
              )}
            </div>

            <div className="flex gap-1.5">
              <Button size="sm" variant="default" className="h-7 text-xs flex-1" disabled={!c.isActive} onClick={() => setImportTarget(c)}>
                <Upload className="w-3 h-3 mr-1" /> {t('common.import', lang)}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => { setGuideTarget(c); setGuideOpen(true); }}>
                <Code2 className="w-3 h-3 mr-1" /> {t('admin.posDevGuide', lang)}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleDownloadSample(c)}>
                <Download className="w-3 h-3 mr-1" /> {t('admin.posSample', lang)}
              </Button>
            </div>
          </div>
        );
      })}

      <AdminPosConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        connection={editing}
        onSaved={load}
      />
      {importTarget && (
        <PosImportDialog
          open={!!importTarget}
          onOpenChange={(o) => { if (!o) setImportTarget(null); }}
          connection={importTarget}
          onDone={load}
        />
      )}
      <PosDevGuide
        open={guideOpen}
        onOpenChange={(o) => { setGuideOpen(o); if (!o) setGuideTarget(null); }}
        connection={guideTarget}
      />
    </div>
  );
}
