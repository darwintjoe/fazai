'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, getAccountName } from '@/lib/i18n';
import { db, type Account, type PosConnection } from '@/lib/fazai-db';
import { buildSampleImportFile } from '@/lib/pos-import';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Check, Download, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The connection to document. If null, the guide shows generic placeholders. */
  connection: PosConnection | null;
}

const REPORT_METHOD_HINT: Record<PosConnection['reportMethod'], string> = {
  immediate: 'POS sends a file per sale → FAZAI posts one ledger entry per sale',
  'daily-individual': 'POS sends the day\'s detailed log → FAZAI posts each sale as its own ledger entry',
  'daily-total': 'POS sums the day → FAZAI posts one multi-row ledger entry (one debit leg per payment method)',
};

export function PosDevGuide({ open, onOpenChange, connection }: Props) {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [copied, setCopied] = useState(false);

  // Load account names so the payment map reads as "qris → QRIS (1-1300)".
  React.useEffect(() => {
    if (!open) return;
    db.accounts.toArray().then(setAccounts);
    setCopied(false);
  }, [open]);

  const apiKey = connection?.apiKey ?? 'faz_pos_REPLACE_WITH_MERCHANT_API_KEY';
  const paymentMap = connection?.paymentMethodMap ?? {};
  const incomeAccount = accounts.find((a) => a.id === (connection?.defaultIncomeAccountId || 'acc-sales'));

  const handleCopyKey = async () => {
    if (!connection) return;
    try {
      await navigator.clipboard.writeText(connection.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('common.error', lang) });
    }
  };

  const handleDownloadSample = () => {
    if (!connection) return;
    const sample = buildSampleImportFile(connection);
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fazai-pos-sample-${connection.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampleJson = JSON.stringify(
    {
      format: 'fazai-pos-import',
      version: 1,
      apiKey,
      posProvider: connection?.posProvider || 'Your POS',
      exportedAt: new Date().toISOString(),
      currency: 'IDR',
      sales: [
        {
          saleId: 'INV-1001',
          datetime: '2026-06-29T09:30:00.000Z',
          amount: 25000,
          paymentMethod: Object.keys(paymentMap)[0] || 'cash',
          counterparty: 'Table 5',
          description: '2 × Es Kopi Susu',
        },
      ],
    },
    null,
    2,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-1.5">
            <Code2 className="w-4 h-4" />
            {t('admin.posDevGuide', lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-xs">
          {/* Intro */}
          <p className="text-muted-foreground leading-relaxed">
            {lang === 'id'
              ? 'Integrasikan POS Anda dengan mengekspor file JSON. Setiap penjualan dicatat di buku besar sebagai Pendapatan vs Kas/Bank/QRIS.'
              : lang === 'zh'
              ? '通过导出JSON文件将您的POS接入。每笔销售会记入分类账：收入 vs 现金/银行/QRIS。'
              : 'Integrate your POS by exporting a JSON file. Each sale is posted to the ledger as Income vs Cash/Bank/QRIS.'}
          </p>

          {/* Live config — only when a real connection is selected */}
          {connection ? (
            <Section title={lang === 'id' ? 'Konfigurasi koneksi ini' : lang === 'zh' ? '此连接的配置' : 'This connection\'s config'}>
              <Row label="API Key">
                <div className="flex gap-1.5 items-center">
                  <code className="font-mono text-[10px] break-all flex-1 bg-muted px-1.5 py-1 rounded">{connection.apiKey}</code>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyKey}>
                    {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </Row>
              <Row label={t('admin.posReportMethod', lang)}>
                <span className="font-medium">{connection.reportMethod}</span>
                <span className="text-muted-foreground"> — {REPORT_METHOD_HINT[connection.reportMethod]}</span>
              </Row>
              <Row label={t('admin.posIncomeAccount', lang)}>
                <span className="font-medium">{incomeAccount ? getAccountName(incomeAccount, lang) : 'Sales'}</span>
              </Row>
              <Row label={t('admin.posPaymentMap', lang)}>
                <div className="flex flex-col gap-0.5 w-full">
                  {Object.entries(paymentMap).length === 0 && (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {Object.entries(paymentMap).map(([key, accId]) => {
                    const acc = accounts.find((a) => a.id === accId);
                    return (
                      <div key={key} className="flex items-center gap-1.5 font-mono text-[10px]">
                        <code className="bg-muted px-1 rounded">{key}</code>
                        <span className="text-muted-foreground">→</span>
                        <span>{acc ? `${getAccountName(acc, lang)} (${acc.code})` : accId}</span>
                      </div>
                    );
                  })}
                </div>
              </Row>
            </Section>
          ) : (
            <div className="border border-dashed rounded-md p-3 text-muted-foreground text-center">
              {lang === 'id'
                ? 'Buat koneksi POS untuk melihat API key dan metode pembayarannya.'
                : lang === 'zh'
                ? '创建一个POS连接以查看其API密钥和付款方式。'
                : 'Create a POS connection to see its API key and payment methods.'}
            </div>
          )}

          {/* Payment-method keys — the contract the dev must obey */}
          <Section title={lang === 'id' ? 'Kunci paymentMethod yang diterima' : lang === 'zh' ? '接受的paymentMethod键' : 'Accepted paymentMethod keys'}>
            <p className="text-muted-foreground">
              {lang === 'id'
                ? 'Gunakan salah satu kunci ini di field paymentMethod. Metode lain akan ditolak (tidak di-default).'
                : lang === 'zh'
                ? '在paymentMethod字段中使用以下键之一。其他方式将被拒绝（不会默认）。'
                : 'Use one of these keys in the paymentMethod field. Any other value is rejected (no defaulting).'}
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.keys(paymentMap).length === 0 && <code className="bg-muted px-1.5 py-0.5 rounded">cash</code>}
              {Object.keys(paymentMap).map((k) => (
                <code key={k} className="bg-muted px-1.5 py-0.5 rounded">{k}</code>
              ))}
            </div>
          </Section>

          {/* JSON contract */}
          <Section title={lang === 'id' ? 'Format file' : lang === 'zh' ? '文件格式' : 'File format'}>
            <p className="text-muted-foreground">
              {lang === 'id'
                ? 'Ekspor satu file JSON dengan struktur ini:'
                : lang === 'zh'
                ? '导出具有以下结构的单个JSON文件：'
                : 'Export a single JSON file with this structure:'}
            </p>
            <pre className="bg-muted rounded-md p-2.5 overflow-x-auto text-[10px] leading-relaxed font-mono">{sampleJson}</pre>
          </Section>

          {/* Required fields */}
          <Section title={lang === 'id' ? 'Field wajib per penjualan' : lang === 'zh' ? '每笔销售的必填字段' : 'Required fields per sale'}>
            <div className="flex flex-col gap-1">
              <FieldRow name="saleId" req desc={lang === 'id' ? 'ID unik. Kunci de-duplikasi.' : lang === 'zh' ? '唯一ID。去重键。' : 'Unique ID. De-duplication key.'} />
              <FieldRow name="datetime" req desc="ISO 8601" />
              <FieldRow name="amount" req desc={lang === 'id' ? 'angka positif' : lang === 'zh' ? '正数' : 'positive number'} />
              <FieldRow name="paymentMethod" req desc={lang === 'id' ? 'salah satu kunci di atas' : lang === 'zh' ? '上列键之一' : 'one of the keys above'} />
              <FieldRow name="counterparty" desc={lang === 'id' ? 'opsional' : lang === 'zh' ? '可选' : 'optional'} />
              <FieldRow name="description" desc={lang === 'id' ? 'opsional' : lang === 'zh' ? '可选' : 'optional'} />
            </div>
          </Section>

          {/* Idempotency */}
          <Section title={lang === 'id' ? 'Idempotensi' : lang === 'zh' ? '幂等性' : 'Idempotency'}>
            <p className="text-muted-foreground leading-relaxed">
              {lang === 'id'
                ? 'saleId adalah kunci de-duplikasi. Mengimpor ulang file yang sama akan melewatkan penjualan yang sudah ada — tidak ada dobel-posting. Gunakan saleId yang stabil (no. struk/invoice).'
                : lang === 'zh'
                ? 'saleId是去重键。重新导入相同文件会跳过已存在的销售——不会重复记账。请使用稳定的saleId（收据/发票号）。'
                : 'saleId is the de-duplication key. Re-importing the same file skips already-imported sales — no double-posting. Use a stable saleId (receipt/invoice number).'}
            </p>
          </Section>

          {/* Sample download */}
          {connection && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadSample}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('admin.posDownloadSample', lang)}
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            {lang === 'id'
              ? 'Panduan lengkap: lihat INTEGRATION.md di repositori.'
              : lang === 'zh'
              ? '完整指南：参见仓库中的 INTEGRATION.md。'
              : 'Full guide: see INTEGRATION.md in the repository.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function FieldRow({ name, req, desc }: { name: string; req?: boolean; desc: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <code className="font-mono text-[10px] bg-muted px-1 rounded">{name}</code>
      {req && <span className="text-[9px] text-red-500 font-medium">REQ</span>}
      <span className="text-muted-foreground text-[10px]">{desc}</span>
    </div>
  );
}
