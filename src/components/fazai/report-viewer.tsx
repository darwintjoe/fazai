'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName, type Lang, type TranslationKeys } from '@/lib/i18n';
import { formatNumber, formatDate, startOfMonthFor, endOfMonthFor, MONTH_LABELS, formatMonthYear, isCurrentMonth } from '@/lib/format';
import { db, type Account } from '@/lib/fazai-db';
import {
  generateTrialBalance,
  generateBalanceSheet,
  generateProfitLoss,
  generateCashFlow,
  generateLedger,
  type TrialBalanceRow,
  type BalanceSheet,
  type ProfitLoss,
  type CashFlow,
  type LedgerEntry,
} from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileDown, FileSpreadsheet } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function ReportViewer() {
  const { lang } = useAuthStore();
  const { navigate, reportType } = useAppStore();

  const now = new Date();
  // For TB & BS: "as of" a single month end
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  // For PL, CF, Ledger: period range (from month → to month)
  const [fromMonth, setFromMonth] = useState<number>(0); // January
  const [fromYear, setFromYear] = useState<number>(now.getFullYear());
  const [toMonth, setToMonth] = useState<number>(now.getMonth());
  const [toYear, setToYear] = useState<number>(now.getFullYear());
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);

  const YEAR_OPTIONS: number[] = [];
  for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 1; y++) YEAR_OPTIONS.push(y);

  // Report data
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  const accountsLoadRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    const accs = await db.accounts.filter(a => a.isActive).toArray();
    setAccounts(accs);
    if (accs.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accs[0].id);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (!accountsLoadRef.current) {
      accountsLoadRef.current = true;
      loadAccounts();
    }
  }, [loadAccounts]);

  // Compute period dates for PL, CF, Ledger from fromMonth/fromYear → toMonth/toYear
  const getPeriodDates = useCallback(() => {
    const fromDate = startOfMonthFor(fromYear, fromMonth);
    const toDate = isCurrentMonth(toYear, toMonth)
      ? new Date() // MTD for current month
      : endOfMonthFor(toYear, toMonth); // Full month for past months
    return { fromDate, toDate };
  }, [fromYear, fromMonth, toYear, toMonth]);

  const generateReport = useCallback(async () => {
    const asOfDate = endOfMonthFor(selectedYear, selectedMonth);
    const { fromDate, toDate } = getPeriodDates();

    switch (reportType) {
      case 'trial-balance': {
        const data = await generateTrialBalance(asOfDate, lang);
        setTrialBalance(data);
        break;
      }
      case 'balance-sheet': {
        const data = await generateBalanceSheet(asOfDate, lang);
        setBalanceSheet(data);
        break;
      }
      case 'profit-loss': {
        const data = await generateProfitLoss(fromDate, toDate, lang);
        setProfitLoss(data);
        break;
      }
      case 'cash-flow': {
        const data = await generateCashFlow(fromDate, toDate, lang);
        setCashFlow(data);
        break;
      }
      case 'ledger': {
        if (selectedAccountId) {
          const data = await generateLedger(selectedAccountId, fromDate, toDate, lang);
          setLedgerEntries(data);
        }
        break;
      }
    }
  }, [reportType, selectedMonth, selectedYear, fromMonth, fromYear, toMonth, toYear, lang, selectedAccountId, getPeriodDates]);

  const reportLoadRef = useRef(false);

  useEffect(() => {
    if (!reportLoadRef.current) {
      reportLoadRef.current = true;
      generateReport();
    }
  }, [generateReport]);

  const REPORT_KEY_MAP: Record<string, string> = {
    'trial-balance': 'rep.trialBalance',
    'balance-sheet': 'rep.balanceSheet',
    'profit-loss': 'rep.profitLoss',
    'cash-flow': 'rep.cashFlow',
    'ledger': 'rep.ledger',
  };

  const reportTitle = t(REPORT_KEY_MAP[reportType] as keyof TranslationKeys, lang);

  // Get date label for export headers
  const getDateLabel = () => {
    if (reportType === 'balance-sheet' || reportType === 'trial-balance') {
      return formatDate(endOfMonthFor(selectedYear, selectedMonth), lang);
    }
    const fromLabel = formatMonthYear(fromYear, fromMonth, lang);
    const toLabel = formatMonthYear(toYear, toMonth, lang);
    const mtdLabel = isCurrentMonth(toYear, toMonth) ? ' (MTD)' : '';
    if (fromYear === toYear && fromMonth === toMonth) {
      return `${fromLabel}${mtdLabel}`;
    }
    return `${fromLabel} – ${toLabel}${mtdLabel}`;
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(220, 38, 38);
    doc.text('FAZAI', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(reportTitle, pageWidth / 2, 22, { align: 'center' });
    doc.setFontSize(9);
    doc.text(getDateLabel(), pageWidth / 2, 28, { align: 'center' });

    let yOffset = 35;

    switch (reportType) {
      case 'trial-balance': {
        autoTable(doc, {
          startY: yOffset,
          head: [[t('rep.account', lang), t('rep.debit', lang), t('rep.credit', lang)]],
          body: trialBalance.map(r => [r.accountName, formatNumber(r.debit), formatNumber(r.credit)]),
          foot: [[t('rep.total', lang), formatNumber(trialBalance.reduce((s, r) => s + r.debit, 0)), formatNumber(trialBalance.reduce((s, r) => s + r.credit, 0))]],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [220, 38, 38] },
          footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        });
        break;
      }
      case 'balance-sheet': {
        if (balanceSheet) {
          const sections = [
            { title: balanceSheet.assets.label, items: balanceSheet.assets.items, total: balanceSheet.assets.total },
            { title: balanceSheet.liabilities.label, items: balanceSheet.liabilities.items, total: balanceSheet.liabilities.total },
            { title: balanceSheet.equity.label, items: balanceSheet.equity.items, total: balanceSheet.equity.total },
          ];
          for (const section of sections) {
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(section.title, 14, yOffset);
            yOffset += 3;
            autoTable(doc, {
              startY: yOffset,
              head: [[t('rep.account', lang), t('rep.balance', lang)]],
              body: section.items.map(i => [i.accountName, formatNumber(i.amount)]),
              foot: [[t('rep.total', lang), formatNumber(section.total)]],
              styles: { fontSize: 9 },
              headStyles: { fillColor: [220, 38, 38] },
              footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            });
            yOffset = (doc as any).lastAutoTable.finalY + 10;
          }
          doc.setFontSize(10);
          doc.text(`${t('rep.total', lang)} ${t('rep.liabilities', lang)} + ${t('rep.equity', lang)}: ${formatNumber(balanceSheet.totalLiabilitiesAndEquity)}`, 14, yOffset);
        }
        break;
      }
      case 'profit-loss': {
        if (profitLoss) {
          autoTable(doc, {
            startY: yOffset,
            head: [[t('dash.income', lang), '', '']],
            body: profitLoss.income.items.map(i => [i.accountName, '', formatNumber(i.amount)]),
            foot: [[t('rep.total', lang) + ' ' + t('dash.income', lang), '', formatNumber(profitLoss.income.total)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [220, 38, 38] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          });
          yOffset = (doc as any).lastAutoTable.finalY + 10;
          autoTable(doc, {
            startY: yOffset,
            head: [[t('dash.expense', lang), '', '']],
            body: profitLoss.expenses.items.map(i => [i.accountName, '', formatNumber(i.amount)]),
            foot: [[t('rep.total', lang) + ' ' + t('dash.expense', lang), '', formatNumber(profitLoss.expenses.total)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [239, 68, 68] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          });
          yOffset = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(12);
          doc.setTextColor(0);
          doc.text(`${t('rep.netProfit', lang)}: ${formatNumber(profitLoss.netProfit)}`, 14, yOffset);
        }
        break;
      }
      case 'cash-flow': {
        if (cashFlow) {
          doc.setFontSize(11);
          doc.text(`${t('rep.beginning', lang)}: ${formatNumber(cashFlow.beginningBalance)}`, 14, yOffset);
          yOffset += 8;
          autoTable(doc, {
            startY: yOffset,
            head: [[t('rep.inflows', lang), '', '']],
            body: cashFlow.inflows.map(i => [i.accountName, '', formatNumber(i.amount)]),
            foot: [[t('rep.total', lang), '', formatNumber(cashFlow.totalInflows)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [220, 38, 38] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          });
          yOffset = (doc as any).lastAutoTable.finalY + 8;
          autoTable(doc, {
            startY: yOffset,
            head: [[t('rep.outflows', lang), '', '']],
            body: cashFlow.outflows.map(i => [i.accountName, '', formatNumber(i.amount)]),
            foot: [[t('rep.total', lang), '', formatNumber(cashFlow.totalOutflows)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [239, 68, 68] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          });
          yOffset = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(11);
          doc.text(`${t('rep.netChange', lang)}: ${formatNumber(cashFlow.netChange)}`, 14, yOffset);
          yOffset += 7;
          doc.text(`${t('rep.ending', lang)}: ${formatNumber(cashFlow.endingBalance)}`, 14, yOffset);
        }
        break;
      }
      case 'ledger': {
        autoTable(doc, {
          startY: yOffset,
          head: [[t('form.date', lang), t('rep.description', lang), lang === 'id' ? 'Jumlah' : lang === 'zh' ? '金额' : 'Amount', t('rep.balance', lang)]],
          body: ledgerEntries.map(e => [
            formatDate(e.date, lang),
            `${e.description}${e.counterparty ? ' (' + e.counterparty + ')' : ''}`,
            `${formatNumber(e.debit > 0 ? e.debit : e.credit)} ${e.debit > 0 ? 'Dr' : 'Cr'}`,
            formatNumber(e.balance),
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 38, 38] },
        });
        break;
      }
    }

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`FAZAI-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    switch (reportType) {
      case 'trial-balance': {
        const data = trialBalance.map(r => ({
          [t('rep.account', lang)]: r.accountName,
          [t('rep.debit', lang)]: r.debit,
          [t('rep.credit', lang)]: r.credit,
        }));
        data.push({
          [t('rep.account', lang)]: t('rep.total', lang),
          [t('rep.debit', lang)]: trialBalance.reduce((s, r) => s + r.debit, 0),
          [t('rep.credit', lang)]: trialBalance.reduce((s, r) => s + r.credit, 0),
        });
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, reportTitle);
        break;
      }
      case 'balance-sheet': {
        if (balanceSheet) {
          const data: Record<string, any>[] = [];
          data.push({ [t('rep.account', lang)]: balanceSheet.assets.label, [t('rep.balance', lang)]: '' });
          balanceSheet.assets.items.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: balanceSheet.assets.total });
          data.push({});
          data.push({ [t('rep.account', lang)]: balanceSheet.liabilities.label, [t('rep.balance', lang)]: '' });
          balanceSheet.liabilities.items.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: balanceSheet.liabilities.total });
          data.push({});
          data.push({ [t('rep.account', lang)]: balanceSheet.equity.label, [t('rep.balance', lang)]: '' });
          balanceSheet.equity.items.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: balanceSheet.equity.total });
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, reportTitle);
        }
        break;
      }
      case 'profit-loss': {
        if (profitLoss) {
          const data: Record<string, any>[] = [];
          data.push({ [t('rep.account', lang)]: t('dash.income', lang), [t('rep.balance', lang)]: '' });
          profitLoss.income.items.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: profitLoss.income.total });
          data.push({});
          data.push({ [t('rep.account', lang)]: t('dash.expense', lang), [t('rep.balance', lang)]: '' });
          profitLoss.expenses.items.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: profitLoss.expenses.total });
          data.push({});
          data.push({ [t('rep.account', lang)]: t('rep.netProfit', lang), [t('rep.balance', lang)]: profitLoss.netProfit });
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, reportTitle);
        }
        break;
      }
      case 'cash-flow': {
        if (cashFlow) {
          const data: Record<string, any>[] = [];
          data.push({ [t('rep.account', lang)]: t('rep.beginning', lang), [t('rep.balance', lang)]: cashFlow.beginningBalance });
          data.push({});
          data.push({ [t('rep.account', lang)]: t('rep.inflows', lang), [t('rep.balance', lang)]: '' });
          cashFlow.inflows.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: cashFlow.totalInflows });
          data.push({});
          data.push({ [t('rep.account', lang)]: t('rep.outflows', lang), [t('rep.balance', lang)]: '' });
          cashFlow.outflows.forEach(i => data.push({ [t('rep.account', lang)]: i.accountName, [t('rep.balance', lang)]: i.amount }));
          data.push({ [t('rep.account', lang)]: t('rep.total', lang), [t('rep.balance', lang)]: cashFlow.totalOutflows });
          data.push({});
          data.push({ [t('rep.account', lang)]: t('rep.netChange', lang), [t('rep.balance', lang)]: cashFlow.netChange });
          data.push({ [t('rep.account', lang)]: t('rep.ending', lang), [t('rep.balance', lang)]: cashFlow.endingBalance });
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, reportTitle);
        }
        break;
      }
      case 'ledger': {
        const amtLabel = lang === 'id' ? 'Jumlah' : lang === 'zh' ? '金额' : 'Amount';
        const dcLabel = lang === 'id' ? 'D/K' : lang === 'zh' ? '借/贷' : 'Dr/Cr';
        const data = ledgerEntries.map(e => ({
          [t('form.date', lang)]: formatDate(e.date, lang),
          [t('rep.description', lang)]: `${e.description}${e.counterparty ? ' (' + e.counterparty + ')' : ''}`,
          [amtLabel]: e.debit > 0 ? e.debit : e.credit,
          [dcLabel]: e.debit > 0 ? 'Dr' : 'Cr',
          [t('rep.balance', lang)]: e.balance,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, reportTitle);
        break;
      }
    }

    XLSX.writeFile(wb, `FAZAI-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('reports')} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">{reportTitle}</h2>
      </div>

      {/* Date Pickers & Filters */}
      <div className="flex flex-col gap-2">
        {/* TB & BS: Single "As Of" Month-Year Picker */}
        {(reportType === 'balance-sheet' || reportType === 'trial-balance') && (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">{lang === 'id' ? 'Sampai' : lang === 'zh' ? '截至' : 'As of'}:</span>
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* PL, CF, Ledger: From–To Month-Year Picker */}
        {(reportType === 'profit-loss' || reportType === 'cash-flow' || reportType === 'ledger') && (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">{lang === 'id' ? 'Dari' : lang === 'zh' ? '从' : 'From'}:</span>
            <Select value={String(fromMonth)} onValueChange={(v) => setFromMonth(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(fromYear)} onValueChange={(v) => setFromYear(Number(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground font-medium">{lang === 'id' ? 'Sampai' : lang === 'zh' ? '至' : 'To'}:</span>
            <Select value={String(toMonth)} onValueChange={(v) => setToMonth(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(toYear)} onValueChange={(v) => setToYear(Number(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {isCurrentMonth(toYear, toMonth) && (
              <span className="text-xs text-amber-600 font-semibold">MTD</span>
            )}
          </div>
        )}

        {reportType === 'ledger' && (
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('rep.selectAccount', lang)} /></SelectTrigger>
            <SelectContent>
              {accounts.filter(a => a.parentId).map(a => (
                <SelectItem key={a.id} value={a.id}>{getAccountName(a, lang)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Generate & Export Buttons */}
      <div className="flex gap-2">
        <Button size="sm" onClick={generateReport} className="text-xs">
          {t('rep.generate', lang)}
        </Button>
        <Button variant="outline" size="sm" onClick={exportPdf} className="text-xs">
          <FileDown className="w-3 h-3 mr-1" /> {t('rep.exportPdf', lang)}
        </Button>
        <Button variant="outline" size="sm" onClick={exportXlsx} className="text-xs">
          <FileSpreadsheet className="w-3 h-3 mr-1" /> {t('rep.exportXlsx', lang)}
        </Button>
      </div>

      {/* Report Content */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {reportType === 'trial-balance' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50 dark:bg-red-950">
                  <th className="text-left p-3 font-medium">{t('rep.account', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('rep.debit', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('rep.credit', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map((r) => (
                  <tr key={r.accountId} className="border-t">
                    <td className="p-3">{r.accountName}</td>
                    <td className="text-right p-3">{r.debit > 0 ? formatNumber(r.debit) : ''}</td>
                    <td className="text-right p-3">{r.credit > 0 ? formatNumber(r.credit) : ''}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold bg-muted/50">
                  <td className="p-3">{t('rep.total', lang)}</td>
                  <td className="text-right p-3">{formatNumber(trialBalance.reduce((s, r) => s + r.debit, 0))}</td>
                  <td className="text-right p-3">{formatNumber(trialBalance.reduce((s, r) => s + r.credit, 0))}</td>
                </tr>
              </tbody>
            </table>
          )}

          {reportType === 'balance-sheet' && balanceSheet && (
            <div className="p-4">
              {[
                { section: balanceSheet.assets, color: 'red' },
                { section: balanceSheet.liabilities, color: 'blue' },
                { section: balanceSheet.equity, color: 'purple' },
              ].map(({ section, color }) => (
                <div key={section.label} className="mb-6">
                  <h3 className={`font-semibold text-sm mb-2 text-${color}-600`}>{section.label}</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {section.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)} {section.label}</td>
                        <td className="text-right p-2">{formatNumber(section.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="border-t-2 pt-3 font-semibold text-sm">
                {t('rep.total', lang)} {t('rep.liabilities', lang)} + {t('rep.equity', lang)}: {formatNumber(balanceSheet.totalLiabilitiesAndEquity)}
              </div>
            </div>
          )}

          {reportType === 'profit-loss' && profitLoss && (
            <div className="p-4">
              <h3 className="font-semibold text-sm mb-2 text-red-600">{t('dash.income', lang)}</h3>
              <table className="w-full text-sm mb-4">
                <tbody>
                  {profitLoss.income.items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.accountName}</td>
                      <td className="text-right p-2">{formatNumber(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold">
                    <td className="p-2">{t('rep.total', lang)}</td>
                    <td className="text-right p-2">{formatNumber(profitLoss.income.total)}</td>
                  </tr>
                </tbody>
              </table>
              <h3 className="font-semibold text-sm mb-2 text-red-600">{t('dash.expense', lang)}</h3>
              <table className="w-full text-sm mb-4">
                <tbody>
                  {profitLoss.expenses.items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.accountName}</td>
                      <td className="text-right p-2">{formatNumber(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold">
                    <td className="p-2">{t('rep.total', lang)}</td>
                    <td className="text-right p-2">{formatNumber(profitLoss.expenses.total)}</td>
                  </tr>
                </tbody>
              </table>
              <div className={`border-t-2 pt-3 font-bold text-lg ${profitLoss.netProfit >= 0 ? 'text-red-600' : 'text-red-600'}`}>
                {t('rep.netProfit', lang)}: {formatNumber(profitLoss.netProfit)}
              </div>
            </div>
          )}

          {reportType === 'cash-flow' && cashFlow && (
            <div className="p-4">
              <div className="mb-4 text-sm">
                <span className="font-medium">{t('rep.beginning', lang)}:</span> {formatNumber(cashFlow.beginningBalance)}
              </div>
              <h3 className="font-semibold text-sm mb-2 text-red-600">{t('rep.inflows', lang)}</h3>
              <table className="w-full text-sm mb-4">
                <tbody>
                  {cashFlow.inflows.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.accountName}</td>
                      <td className="text-right p-2">{formatNumber(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold">
                    <td className="p-2">{t('rep.total', lang)}</td>
                    <td className="text-right p-2">{formatNumber(cashFlow.totalInflows)}</td>
                  </tr>
                </tbody>
              </table>
              <h3 className="font-semibold text-sm mb-2 text-red-600">{t('rep.outflows', lang)}</h3>
              <table className="w-full text-sm mb-4">
                <tbody>
                  {cashFlow.outflows.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.accountName}</td>
                      <td className="text-right p-2">{formatNumber(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold">
                    <td className="p-2">{t('rep.total', lang)}</td>
                    <td className="text-right p-2">{formatNumber(cashFlow.totalOutflows)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="border-t-2 pt-3 space-y-1 text-sm font-semibold">
                <div>{t('rep.netChange', lang)}: {formatNumber(cashFlow.netChange)}</div>
                <div>{t('rep.ending', lang)}: {formatNumber(cashFlow.endingBalance)}</div>
              </div>
            </div>
          )}

          {reportType === 'ledger' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50 dark:bg-red-950">
                  <th className="text-left p-3 font-medium">{t('form.date', lang)}</th>
                  <th className="text-left p-3 font-medium">{t('rep.description', lang)}</th>
                  <th className="text-right p-3 font-medium">{lang === 'id' ? 'Jumlah' : lang === 'zh' ? '金额' : 'Amount'}</th>
                  <th className="text-right p-3 font-medium">{t('rep.balance', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((e, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3 text-xs whitespace-nowrap">{formatDate(e.date, lang)}</td>
                    <td className="p-3 text-xs">
                      <span>{e.description}</span>
                      {e.counterparty && <span className="text-muted-foreground"> ({e.counterparty})</span>}
                    </td>
                    <td className="text-right p-3 whitespace-nowrap">
                      <span className="font-medium">{formatNumber(e.debit > 0 ? e.debit : e.credit)}</span>
                      <span className={`ml-1 text-[10px] font-bold ${
                        e.debit > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {e.debit > 0 ? 'Dr' : 'Cr'}
                      </span>
                    </td>
                    <td className="text-right p-3 font-medium whitespace-nowrap">{formatNumber(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {((reportType === 'trial-balance' && trialBalance.length === 0) ||
            (reportType === 'ledger' && ledgerEntries.length === 0) ||
            (reportType === 'balance-sheet' && !balanceSheet) ||
            (reportType === 'profit-loss' && !profitLoss) ||
            (reportType === 'cash-flow' && !cashFlow)) && (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('rep.noData', lang)}</div>
          )}
        </div>
      </Card>
    </div>
  );
}
