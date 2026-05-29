'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName, type Lang, type TranslationKeys } from '@/lib/i18n';
import { formatNumber, formatDate, startOfMonthFor, endOfMonthFor, MONTH_LABELS } from '@/lib/format';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CalendarIcon, FileDown, FileSpreadsheet } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function ReportViewer() {
  const { lang } = useAuthStore();
  const { navigate, reportType } = useAppStore();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [fromDate, setFromDate] = useState<Date>(startOfMonthFor(now.getFullYear(), now.getMonth()));
  const [toDate, setToDate] = useState<Date>(now);
  const [fromCalOpen, setFromCalOpen] = useState(false);
  const [toCalOpen, setToCalOpen] = useState(false);
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

  const generateReport = useCallback(async () => {
    const asOfDate = endOfMonthFor(selectedYear, selectedMonth);

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
  }, [reportType, fromDate, toDate, selectedMonth, selectedYear, lang, selectedAccountId]);

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
    return `${formatDate(fromDate, lang)} - ${formatDate(toDate, lang)}`;
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129);
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
          headStyles: { fillColor: [16, 185, 129] },
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
              headStyles: { fillColor: [16, 185, 129] },
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
            headStyles: { fillColor: [34, 197, 94] },
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
            headStyles: { fillColor: [34, 197, 94] },
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
        const acc = accounts.find(a => a.id === selectedAccountId);
        autoTable(doc, {
          startY: yOffset,
          head: [[t('form.date', lang), t('rep.description', lang), t('rep.debit', lang), t('rep.credit', lang), t('rep.balance', lang)]],
          body: ledgerEntries.map(e => [
            formatDate(e.date, lang),
            `${e.description}${e.counterparty ? ' (' + e.counterparty + ')' : ''}`,
            e.debit > 0 ? formatNumber(e.debit) : '',
            e.credit > 0 ? formatNumber(e.credit) : '',
            formatNumber(e.balance),
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [16, 185, 129] },
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
        const data = ledgerEntries.map(e => ({
          [t('form.date', lang)]: formatDate(e.date, lang),
          [t('rep.description', lang)]: `${e.description}${e.counterparty ? ' (' + e.counterparty + ')' : ''}`,
          [t('rep.debit', lang)]: e.debit,
          [t('rep.credit', lang)]: e.credit,
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

      {/* Date Range & Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Balance Sheet & Trial Balance: Month-Year Picker */}
        {(reportType === 'balance-sheet' || reportType === 'trial-balance') && (
          <div className="flex gap-2 items-center">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* P&L, Cash Flow, Ledger: Date Range with MTD default */}
        {(reportType === 'profit-loss' || reportType === 'cash-flow' || reportType === 'ledger') && (
          <div className="flex gap-2 flex-1">
            <Popover open={fromCalOpen} onOpenChange={setFromCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left font-normal text-xs">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {formatDate(fromDate, lang)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={(d) => { if (d) { setFromDate(d); setFromCalOpen(false); } }} initialFocus /></PopoverContent>
            </Popover>
            <Popover open={toCalOpen} onOpenChange={setToCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left font-normal text-xs">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {formatDate(toDate, lang)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={(d) => { if (d) { setToDate(d); setToCalOpen(false); } }} initialFocus /></PopoverContent>
            </Popover>
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
                <tr className="bg-emerald-50 dark:bg-emerald-950">
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
                { section: balanceSheet.assets, color: 'emerald' },
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
              <h3 className="font-semibold text-sm mb-2 text-green-600">{t('dash.income', lang)}</h3>
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
              <div className={`border-t-2 pt-3 font-bold text-lg ${profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {t('rep.netProfit', lang)}: {formatNumber(profitLoss.netProfit)}
              </div>
            </div>
          )}

          {reportType === 'cash-flow' && cashFlow && (
            <div className="p-4">
              <div className="mb-4 text-sm">
                <span className="font-medium">{t('rep.beginning', lang)}:</span> {formatNumber(cashFlow.beginningBalance)}
              </div>
              <h3 className="font-semibold text-sm mb-2 text-green-600">{t('rep.inflows', lang)}</h3>
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
                <tr className="bg-emerald-50 dark:bg-emerald-950">
                  <th className="text-left p-3 font-medium">{t('form.date', lang)}</th>
                  <th className="text-left p-3 font-medium">{t('rep.description', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('rep.debit', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('rep.credit', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('rep.balance', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((e, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3 text-xs">{formatDate(e.date, lang)}</td>
                    <td className="p-3">{e.description}{e.counterparty ? ` (${e.counterparty})` : ''}</td>
                    <td className="text-right p-3">{e.debit > 0 ? formatNumber(e.debit) : ''}</td>
                    <td className="text-right p-3">{e.credit > 0 ? formatNumber(e.credit) : ''}</td>
                    <td className="text-right p-3 font-medium">{formatNumber(e.balance)}</td>
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
