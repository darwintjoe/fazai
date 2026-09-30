'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, getAccountName, type TranslationKeys } from '@/lib/i18n';
import { formatNumber, formatDate, startOfMonthFor, endOfMonthFor, formatMonthYear, isCurrentMonth } from '@/lib/format';
import { getPreviousRange, getPreviousAsof, buildPeriods, calcChange, formatPct, shiftMonth, type Granularity } from '@/lib/report-period';
import { ReportFilterBar, type RangePreset, type AsofPreset } from '@/components/fazai/report-filter';
import { TrendChart } from '@/components/fazai/trend-chart';
import { ContactStatement } from '@/components/fazai/contact-statement';
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
  const [ownerName, setOwnerName] = useState('');

  // Consistent filter presets + compare + granularity
  const [rangePreset, setRangePreset] = useState<RangePreset>('ytd');
  const [asofPreset, setAsofPreset] = useState<AsofPreset | 'custom'>('this-month');
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>('monthly');

  // Report data
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [prevBalanceSheet, setPrevBalanceSheet] = useState<BalanceSheet | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [prevProfitLoss, setPrevProfitLoss] = useState<ProfitLoss | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [prevCashFlow, setPrevCashFlow] = useState<CashFlow | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [plView, setPlView] = useState<'standard' | 'ebitda' | 'ebitdar'>('standard');
  const [plSeries, setPlSeries] = useState<{ label: string; income: number; expense: number; net: number }[]>([]);
  const [cfSeries, setCfSeries] = useState<{ label: string; inflow: number; outflow: number; net: number }[]>([]);
  const [contactRows, setContactRows] = useState<{ id: string; name: string; group: 'AR' | 'AP'; paid: number; unpaid: number; aging: number }[]>([]);
  const [contactGroup] = useState<'AR' | 'AP'>('AR');

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

  // Load owner name from settings
  useEffect(() => {
    db.settings.get('owner-name').then(s => {
      if (s?.value) setOwnerName(s.value);
    });
  }, []);

  // Compute period dates for PL, CF, Ledger from fromMonth/fromYear → toMonth/toYear
  const getPeriodDates = useCallback(() => {
    const fromDate = startOfMonthFor(fromYear, fromMonth);
    const toDate = isCurrentMonth(toYear, toMonth)
      ? new Date() // MTD for current month
      : endOfMonthFor(toYear, toMonth); // Full month for past months
    return { fromDate, toDate };
  }, [fromYear, fromMonth, toYear, toMonth]);

  // Preset handlers — consistent across reports
  const applyRangePreset = useCallback((p: RangePreset) => {
    setRangePreset(p);
    const n = new Date();
    if (p === 'this-month') {
      setFromMonth(n.getMonth()); setFromYear(n.getFullYear());
      setToMonth(n.getMonth()); setToYear(n.getFullYear());
    } else if (p === 'last-month') {
      const s = shiftMonth(n.getFullYear(), n.getMonth(), -1);
      setFromMonth(s.month); setFromYear(s.year);
      setToMonth(s.month); setToYear(s.year);
    } else if (p === 'this-quarter') {
      const q = Math.floor(n.getMonth() / 3);
      setFromMonth(q * 3); setFromYear(n.getFullYear());
      setToMonth(n.getMonth()); setToYear(n.getFullYear());
    } else if (p === 'ytd') {
      setFromMonth(0); setFromYear(n.getFullYear());
      setToMonth(n.getMonth()); setToYear(n.getFullYear());
    }
  }, []);

  const applyAsofPreset = useCallback((p: AsofPreset) => {
    setAsofPreset(p);
    const n = new Date();
    if (p === 'this-month') {
      setSelectedMonth(n.getMonth()); setSelectedYear(n.getFullYear());
    } else if (p === 'last-month') {
      const s = shiftMonth(n.getFullYear(), n.getMonth(), -1);
      setSelectedMonth(s.month); setSelectedYear(s.year);
    } else if (p === 'quarter-end') {
      const q = Math.floor(n.getMonth() / 3);
      let qEnd = q * 3 + 2;
      if (qEnd >= n.getMonth()) {
        const s = shiftMonth(n.getFullYear(), q * 3, -1);
        setSelectedMonth(s.month); setSelectedYear(s.year);
      } else {
        setSelectedMonth(qEnd); setSelectedYear(n.getFullYear());
      }
    } else if (p === 'year-end') {
      setSelectedMonth(11); setSelectedYear(n.getFullYear() - 1);
    }
  }, []);

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
        if (compareEnabled) {
          const prev = getPreviousAsof(selectedYear, selectedMonth);
          const prevData = await generateBalanceSheet(endOfMonthFor(prev.year, prev.month), lang);
          setPrevBalanceSheet(prevData);
        } else {
          setPrevBalanceSheet(null);
        }
        break;
      }
      case 'profit-loss': {
        const data = await generateProfitLoss(fromDate, toDate, lang);
        setProfitLoss(data);
        if (compareEnabled) {
          const pr = getPreviousRange(fromYear, fromMonth, toYear, toMonth);
          const pFrom = startOfMonthFor(pr.fromYear, pr.fromMonth);
          const pTo = endOfMonthFor(pr.toYear, pr.toMonth);
          const prevData = await generateProfitLoss(pFrom, pTo, lang);
          setPrevProfitLoss(prevData);
        } else {
          setPrevProfitLoss(null);
        }
        // M/Q/Y series
        const slices = buildPeriods(fromYear, fromMonth, toYear, toMonth, granularity, lang);
        const series: { label: string; income: number; expense: number; net: number }[] = [];
        for (const s of slices.slice(0, 24)) {
          const p = await generateProfitLoss(s.fromDate, s.toDate, lang);
          series.push({ label: s.label, income: p.income.total, expense: p.expenses.total, net: p.netProfit });
        }
        setPlSeries(series);
        break;
      }
      case 'cash-flow': {
        const data = await generateCashFlow(fromDate, toDate, lang);
        setCashFlow(data);
        if (compareEnabled) {
          const pr = getPreviousRange(fromYear, fromMonth, toYear, toMonth);
          const pFrom = startOfMonthFor(pr.fromYear, pr.fromMonth);
          const pTo = endOfMonthFor(pr.toYear, pr.toMonth);
          const prevData = await generateCashFlow(pFrom, pTo, lang);
          setPrevCashFlow(prevData);
        } else {
          setPrevCashFlow(null);
        }
        const slices = buildPeriods(fromYear, fromMonth, toYear, toMonth, granularity, lang);
        const series: { label: string; inflow: number; outflow: number; net: number }[] = [];
        for (const s of slices.slice(0, 24)) {
          const c = await generateCashFlow(s.fromDate, s.toDate, lang);
          series.push({ label: s.label, inflow: c.totalInflows, outflow: c.totalOutflows, net: c.netChange });
        }
        setCfSeries(series);
        break;
      }
      case 'ledger': {
        if (selectedAccountId) {
          const data = await generateLedger(selectedAccountId, fromDate, toDate, lang);
          setLedgerEntries(data);
        }
        break;
      }
      case 'contact-statement': {
        const contacts = await db.contacts.filter(c => c.isActive).toArray();
        const txs = (await db.transactions.toArray()).filter(tx => !tx.isDeleted && tx.contactId);
        const byId = new Map<string, { name: string; ar: number; ap: number; unpaid: number; aging: number }>();
        for (const c of contacts) byId.set(c.id, { name: c.name, ar: 0, ap: 0, unpaid: 0, aging: 0 });
        for (const tx of txs) {
          const row = byId.get(tx.contactId as string);
          if (!row) continue;
          const amount = tx.entries.reduce((s, e) => s + e.debit, 0);
          if (tx.type === 'income') row.ar += amount;
          else if (tx.type === 'expense') row.ap += amount;
          row.unpaid += tx.totalUnpaid || 0;
          row.aging = Math.max(row.aging, tx.agingDays || 0);
        }
        const rows = [...byId.entries()].map(([id, v]) => ({ id, name: v.name, group: contactGroup, paid: contactGroup === 'AR' ? v.ar : v.ap, unpaid: v.unpaid, aging: v.aging }));
        setContactRows(rows);
        break;
      }
    }
  }, [reportType, selectedMonth, selectedYear, fromMonth, fromYear, toMonth, toYear, lang, selectedAccountId, contactGroup, getPeriodDates, compareEnabled, granularity]);

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
    'contact-statement': 'rep.contacts',
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

  const chgText = (curr: number, prev: number | undefined | null) => {
    if (prev === undefined || prev === null || !compareEnabled) return null;
    const { diff, pct } = calcChange(curr, prev);
    const up = diff > 0;
    return (
      <span className={`ml-2 text-[11px] font-semibold ${up ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
        {diff === 0 ? '±0' : `${up ? '▲' : '▼'} ${formatNumber(Math.abs(diff))}`} · {formatPct(pct)}
      </span>
    );
  };

  const compareStrip = (curr: number, prev: number | undefined | null, label: string) => {
    if (!compareEnabled || prev === undefined || prev === null) return null;
    const { diff, pct } = calcChange(curr, prev);
    return (
      <div className="mb-3 p-2.5 rounded-lg bg-muted/60 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold">{label}</span>
        <span>Now: <b>{formatNumber(curr)}</b></span>
        <span className="text-muted-foreground">Prev: <b>{formatNumber(prev)}</b></span>
        <span className={diff > 0 ? 'text-green-600 font-semibold' : diff < 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
          {diff === 0 ? '±0' : `${diff > 0 ? '+' : ''}${formatNumber(diff)}`} ({formatPct(pct)})
        </span>
      </div>
    );
  };

  const chgStr = (curr: number, prev: number): string => {
    const { diff, pct } = calcChange(curr, prev);
    const d = diff === 0 ? '±0' : `${diff > 0 ? '+' : ''}${formatNumber(diff)}`;
    return `${d} (${formatPct(pct)})`;
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

    let yOffset = 22;
    if (ownerName) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${t('setup.ownerCaption', lang)} ${ownerName}`, pageWidth / 2, yOffset, { align: 'center' });
      yOffset += 5;
    }

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(reportTitle, pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 6;
    doc.setFontSize(9);
    doc.text(getDateLabel(), pageWidth / 2, yOffset, { align: 'center' });

    yOffset += 6;

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
          const showCmp = compareEnabled && !!prevBalanceSheet;
          const prevSecs = prevBalanceSheet ? [prevBalanceSheet.assets, prevBalanceSheet.liabilities, prevBalanceSheet.equity] : [];
          const sections = [
            { title: balanceSheet.assets.label, items: balanceSheet.assets.items, total: balanceSheet.assets.total },
            { title: balanceSheet.liabilities.label, items: balanceSheet.liabilities.items, total: balanceSheet.liabilities.total },
            { title: balanceSheet.equity.label, items: balanceSheet.equity.items, total: balanceSheet.equity.total },
          ];
          sections.forEach((section, si) => {
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(section.title, 14, yOffset);
            yOffset += 3;
            const prevMap = new Map((prevSecs[si]?.items || []).map(i => [i.accountName, i.amount]));
            const prevTotal = prevSecs[si]?.total;
            autoTable(doc, {
              startY: yOffset,
              head: showCmp ? [[t('rep.account', lang), t('rep.balance', lang), 'Prev', 'Change %']] : [[t('rep.account', lang), t('rep.balance', lang)]],
              body: section.items.map(i => {
                const p = prevMap.get(i.accountName);
                return showCmp && p !== undefined
                  ? [i.accountName, formatNumber(i.amount), formatNumber(p), chgStr(i.amount, p)]
                  : [i.accountName, formatNumber(i.amount)];
              }),
              foot: [showCmp && prevTotal !== undefined
                ? [t('rep.total', lang), formatNumber(section.total), formatNumber(prevTotal), chgStr(section.total, prevTotal)]
                : [t('rep.total', lang), formatNumber(section.total)]],
              styles: { fontSize: 9 },
              headStyles: { fillColor: [220, 38, 38] },
              footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            });
            yOffset = (doc as any).lastAutoTable.finalY + 10;
          });
          doc.setFontSize(10);
          doc.setTextColor(0);
          const leLine = `${t('rep.total', lang)} ${t('rep.liabilities', lang)} + ${t('rep.equity', lang)}: ${formatNumber(balanceSheet.totalLiabilitiesAndEquity)}`;
          doc.text(showCmp && prevBalanceSheet ? `${leLine} (${chgStr(balanceSheet.totalLiabilitiesAndEquity, prevBalanceSheet.totalLiabilitiesAndEquity)})` : leLine, 14, yOffset);
        }
        break;
      }
      case 'profit-loss': {
        if (profitLoss) {
          const showCmp = compareEnabled && !!prevProfitLoss;
          const prevMapFor = (items: { accountName: string; amount: number }[]) => new Map(items.map(i => [i.accountName, i.amount]));
          const addSection = (title: string, section: { items: { accountName: string; amount: number }[]; total: number }, totalLabel: string, prevSection?: { items: { accountName: string; amount: number }[]; total: number }) => {
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(title, 14, yOffset);
            yOffset += 3;
            const pm = prevMapFor(prevSection?.items || []);
            autoTable(doc, {
              startY: yOffset,
              head: showCmp && prevSection ? [[t('rep.account', lang), t('rep.balance', lang), 'Prev', 'Change %']] : [[t('rep.account', lang), '', t('rep.balance', lang)]],
              body: section.items.map(i => {
                const p = pm.get(i.accountName);
                return showCmp && prevSection && p !== undefined
                  ? [i.accountName, formatNumber(i.amount), formatNumber(p), chgStr(i.amount, p)]
                  : [i.accountName, '', formatNumber(i.amount)];
              }),
              foot: [showCmp && prevSection
                ? [totalLabel, formatNumber(section.total), formatNumber(prevSection.total), chgStr(section.total, prevSection.total)]
                : [totalLabel, '', formatNumber(section.total)]],
              styles: { fontSize: 9 },
              headStyles: { fillColor: [220, 38, 38] },
              footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            });
            yOffset = (doc as any).lastAutoTable.finalY + 8;
          };
          const addSubtotal = (label: string, value: number, prevValue?: number) => {
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(showCmp && prevValue !== undefined ? `${label}: ${formatNumber(value)} (${chgStr(value, prevValue)})` : `${label}: ${formatNumber(value)}`, 14, yOffset);
            yOffset += 6;
          };

          if (plView === 'standard') {
            addSection(t('dash.income', lang), profitLoss.income, t('rep.total', lang), prevProfitLoss?.income);
            addSection(t('dash.expense', lang), profitLoss.expenses, t('rep.total', lang), prevProfitLoss?.expenses);
            addSubtotal(t('rep.netProfit', lang), profitLoss.netProfit, prevProfitLoss?.netProfit);
          } else {
            // EBITDA / EBITDAR views
            addSection(t('pl.revenue', lang), profitLoss.revenue, `${t('rep.total', lang)} ${t('pl.revenue', lang)}`, prevProfitLoss?.revenue);
            addSection(t('pl.cogs', lang) || 'COGS', profitLoss.cogs, `${t('rep.total', lang)} ${t('pl.cogs', lang) || 'COGS'}`, prevProfitLoss?.cogs);
            addSubtotal(t('pl.grossProfit', lang), profitLoss.grossProfit, prevProfitLoss ? prevProfitLoss.grossProfit : undefined);
            addSection(t('pl.opEx', lang) || 'Operating Expenses', profitLoss.operatingExpenses, `${t('pl.totalOpEx', lang) || 'Total OpEx'}`, prevProfitLoss?.operatingExpenses);

            if (plView === 'ebitdar') {
              addSubtotal(t('pl.ebitdar', lang), profitLoss.ebitdar, prevProfitLoss ? prevProfitLoss.ebitdar : undefined);
              addSection(t('pl.rent', lang) || 'Rent', profitLoss.rent, `${t('rep.total', lang)} ${t('pl.rent', lang) || 'Rent'}`, prevProfitLoss?.rent);
            }
            addSubtotal(t('pl.ebitda', lang), profitLoss.ebitda, prevProfitLoss ? prevProfitLoss.ebitda : undefined);
            addSection(t('pl.depreciation', lang), profitLoss.depreciation, `${t('rep.total', lang)} ${t('pl.depreciation', lang)}`, prevProfitLoss?.depreciation);

            // Other Income & Expense
            const otherItems = [...profitLoss.otherIncome.items, ...profitLoss.otherExpense.items];
            const otherTotal = profitLoss.otherIncome.total - profitLoss.otherExpense.total;
            const prevOtherItems = prevProfitLoss ? [...prevProfitLoss.otherIncome.items, ...prevProfitLoss.otherExpense.items] : [];
            const prevOtherTotal = prevProfitLoss ? prevProfitLoss.otherIncome.total - prevProfitLoss.otherExpense.total : undefined;
            if (otherItems.length > 0) {
              doc.setFontSize(11);
              doc.setTextColor(0);
              doc.text(t('pl.otherIncomeExpense', lang) || 'Other Income & Expense', 14, yOffset);
              yOffset += 3;
              const pm = prevMapFor(prevOtherItems);
              autoTable(doc, {
                startY: yOffset,
                head: showCmp && prevProfitLoss ? [[t('rep.account', lang), t('rep.balance', lang), 'Prev', 'Change %']] : [[t('rep.account', lang), '', t('rep.balance', lang)]],
                body: otherItems.map(i => {
                  const p = pm.get(i.accountName);
                  return showCmp && prevProfitLoss && p !== undefined
                    ? [i.accountName, formatNumber(i.amount), formatNumber(p), chgStr(i.amount, p)]
                    : [i.accountName, '', formatNumber(i.amount)];
                }),
                foot: [showCmp && prevOtherTotal !== undefined
                  ? [t('rep.total', lang), formatNumber(otherTotal), formatNumber(prevOtherTotal), chgStr(otherTotal, prevOtherTotal)]
                  : [t('rep.total', lang), '', formatNumber(otherTotal)]],
                styles: { fontSize: 9 },
                headStyles: { fillColor: [220, 38, 38] },
                footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
              });
              yOffset = (doc as any).lastAutoTable.finalY + 8;
            }

            addSubtotal(t('pl.ebt', lang), profitLoss.earningsBeforeTax, prevProfitLoss ? prevProfitLoss.earningsBeforeTax : undefined);
            addSection(t('pl.tax', lang) || 'Tax Expense', profitLoss.taxExpense, `${t('rep.total', lang)} ${t('pl.tax', lang) || 'Tax'}`, prevProfitLoss?.taxExpense);
            addSubtotal(t('rep.netProfit', lang), profitLoss.netProfit, prevProfitLoss?.netProfit);
          }
          // M/Q/Y breakdown as shown on screen
          if (plSeries.length > 1) {
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(`${granularity} breakdown`, 14, yOffset);
            yOffset += 3;
            autoTable(doc, {
              startY: yOffset,
              head: [['Metric', ...plSeries.map(s => s.label)]],
              body: [
                ['Income', ...plSeries.map(s => formatNumber(s.income))],
                ['Expense', ...plSeries.map(s => formatNumber(s.expense))],
                ['Net', ...plSeries.map(s => formatNumber(s.net))],
              ],
              styles: { fontSize: 8 },
              headStyles: { fillColor: [220, 38, 38] },
            });
            yOffset = (doc as any).lastAutoTable.finalY + 8;
          }
        }
        break;
      }
      case 'cash-flow': {
        if (cashFlow) {
          const showCmp = compareEnabled && !!prevCashFlow;
          const cfPrevMap = (items: { accountName: string; amount: number }[]) => new Map(items.map(i => [i.accountName, i.amount]));
          const cfRow = (name: string, amount: number, prevItems: { accountName: string; amount: number }[] | undefined) => {
            const p = prevItems ? cfPrevMap(prevItems).get(name) : undefined;
            return showCmp && p !== undefined
              ? [name, formatNumber(amount), formatNumber(p), chgStr(amount, p)]
              : [name, '', formatNumber(amount)];
          };
          doc.setFontSize(11);
          doc.setTextColor(0);
          doc.text(`${t('rep.beginning', lang)}: ${formatNumber(cashFlow.beginningBalance)}`, 14, yOffset);
          yOffset += 8;
          autoTable(doc, {
            startY: yOffset,
            head: showCmp ? [[t('rep.inflows', lang), t('rep.balance', lang), 'Prev', 'Change %']] : [[t('rep.inflows', lang), '', '']],
            body: cashFlow.inflows.map(i => cfRow(i.accountName, i.amount, prevCashFlow?.inflows)),
            foot: [showCmp && prevCashFlow
              ? [t('rep.total', lang), formatNumber(cashFlow.totalInflows), formatNumber(prevCashFlow.totalInflows), chgStr(cashFlow.totalInflows, prevCashFlow.totalInflows)]
              : [t('rep.total', lang), '', formatNumber(cashFlow.totalInflows)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [220, 38, 38] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          });
          yOffset = (doc as any).lastAutoTable.finalY + 8;
          autoTable(doc, {
            startY: yOffset,
            head: showCmp ? [[t('rep.outflows', lang), t('rep.balance', lang), 'Prev', 'Change %']] : [[t('rep.outflows', lang), '', '']],
            body: cashFlow.outflows.map(i => cfRow(i.accountName, i.amount, prevCashFlow?.outflows)),
            foot: [showCmp && prevCashFlow
              ? [t('rep.total', lang), formatNumber(cashFlow.totalOutflows), formatNumber(prevCashFlow.totalOutflows), chgStr(cashFlow.totalOutflows, prevCashFlow.totalOutflows)]
              : [t('rep.total', lang), '', formatNumber(cashFlow.totalOutflows)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [239, 68, 68] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          });
          yOffset = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(11);
          doc.setTextColor(0);
          doc.text(showCmp && prevCashFlow
            ? `${t('rep.netChange', lang)}: ${formatNumber(cashFlow.netChange)} (${chgStr(cashFlow.netChange, prevCashFlow.netChange)})`
            : `${t('rep.netChange', lang)}: ${formatNumber(cashFlow.netChange)}`, 14, yOffset);
          yOffset += 7;
          doc.text(showCmp && prevCashFlow
            ? `${t('rep.ending', lang)}: ${formatNumber(cashFlow.endingBalance)} (${chgStr(cashFlow.endingBalance, prevCashFlow.endingBalance)})`
            : `${t('rep.ending', lang)}: ${formatNumber(cashFlow.endingBalance)}`, 14, yOffset);
          yOffset += 8;
          if (cfSeries.length > 1) {
            doc.setFontSize(11);
            doc.text(`${granularity} breakdown`, 14, yOffset);
            yOffset += 3;
            autoTable(doc, {
              startY: yOffset,
              head: [['Metric', ...cfSeries.map(s => s.label)]],
              body: [
                ['Inflow', ...cfSeries.map(s => formatNumber(s.inflow))],
                ['Outflow', ...cfSeries.map(s => formatNumber(s.outflow))],
                ['Net', ...cfSeries.map(s => formatNumber(s.net))],
              ],
              styles: { fontSize: 8 },
              headStyles: { fillColor: [220, 38, 38] },
            });
            yOffset = (doc as any).lastAutoTable.finalY + 8;
          }
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

    doc.save(`${ownerName || 'FAZAI'}-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
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
          const showCmp = compareEnabled && !!prevBalanceSheet;
          const acctLabel = t('rep.account', lang);
          const balLabel = t('rep.balance', lang);
          const data: Record<string, any>[] = [];
          const pushSection = (
            section: { label: string; items: { accountName: string; amount: number }[]; total: number },
            prevSection?: { items: { accountName: string; amount: number }[]; total: number },
          ) => {
            data.push({ [acctLabel]: section.label, ...(showCmp ? { [balLabel]: '', Prev: '', 'Change %': '' } : { [balLabel]: '' }) });
            const pm = new Map((prevSection?.items || []).map(i => [i.accountName, i.amount]));
            section.items.forEach(i => {
              const p = pm.get(i.accountName);
              data.push(showCmp && p !== undefined
                ? { [acctLabel]: i.accountName, [balLabel]: i.amount, Prev: p, 'Change %': formatPct(calcChange(i.amount, p).pct) }
                : { [acctLabel]: i.accountName, [balLabel]: i.amount });
            });
            data.push(showCmp && prevSection
              ? { [acctLabel]: t('rep.total', lang), [balLabel]: section.total, Prev: prevSection.total, 'Change %': formatPct(calcChange(section.total, prevSection.total).pct) }
              : { [acctLabel]: t('rep.total', lang), [balLabel]: section.total });
            data.push({});
          };
          pushSection({ label: balanceSheet.assets.label, items: balanceSheet.assets.items, total: balanceSheet.assets.total }, prevBalanceSheet?.assets);
          pushSection({ label: balanceSheet.liabilities.label, items: balanceSheet.liabilities.items, total: balanceSheet.liabilities.total }, prevBalanceSheet?.liabilities);
          pushSection({ label: balanceSheet.equity.label, items: balanceSheet.equity.items, total: balanceSheet.equity.total }, prevBalanceSheet?.equity);
          if (showCmp && prevBalanceSheet) {
            data.push({ [acctLabel]: `${t('rep.total', lang)} ${t('rep.liabilities', lang)} + ${t('rep.equity', lang)}`, [balLabel]: balanceSheet.totalLiabilitiesAndEquity, Prev: prevBalanceSheet.totalLiabilitiesAndEquity, 'Change %': formatPct(calcChange(balanceSheet.totalLiabilitiesAndEquity, prevBalanceSheet.totalLiabilitiesAndEquity).pct) });
          }
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, reportTitle);
        }
        break;
      }
      case 'profit-loss': {
        if (profitLoss) {
          const showCmp = compareEnabled && !!prevProfitLoss;
          const data: Record<string, any>[] = [];
          const acctLabel = t('rep.account', lang);
          const balLabel = t('rep.balance', lang);
          const addSectionRows = (title: string, section: { items: { accountName: string; amount: number }[]; total: number }, totalLabel: string, prevSection?: { items: { accountName: string; amount: number }[]; total: number }) => {
            data.push({ [acctLabel]: title, ...(showCmp ? { [balLabel]: '', Prev: '', 'Change %': '' } : { [balLabel]: '' }) });
            const pm = new Map((prevSection?.items || []).map(i => [i.accountName, i.amount]));
            section.items.forEach(i => {
              const p = pm.get(i.accountName);
              data.push(showCmp && prevSection && p !== undefined
                ? { [acctLabel]: i.accountName, [balLabel]: i.amount, Prev: p, 'Change %': formatPct(calcChange(i.amount, p).pct) }
                : { [acctLabel]: i.accountName, [balLabel]: i.amount });
            });
            data.push(showCmp && prevSection
              ? { [acctLabel]: totalLabel, [balLabel]: section.total, Prev: prevSection.total, 'Change %': formatPct(calcChange(section.total, prevSection.total).pct) }
              : { [acctLabel]: totalLabel, [balLabel]: section.total });
            data.push({});
          };
          const addSubtotalRow = (label: string, value: number, prevValue?: number) => {
            data.push(showCmp && prevValue !== undefined
              ? { [acctLabel]: label, [balLabel]: value, Prev: prevValue, 'Change %': formatPct(calcChange(value, prevValue).pct) }
              : { [acctLabel]: label, [balLabel]: value });
            data.push({});
          };

          if (plView === 'standard') {
            addSectionRows(t('dash.income', lang), profitLoss.income, t('rep.total', lang), prevProfitLoss?.income);
            addSectionRows(t('dash.expense', lang), profitLoss.expenses, t('rep.total', lang), prevProfitLoss?.expenses);
            addSubtotalRow(t('rep.netProfit', lang), profitLoss.netProfit, prevProfitLoss?.netProfit);
          } else {
            addSectionRows(t('pl.revenue', lang), profitLoss.revenue, `${t('rep.total', lang)} ${t('pl.revenue', lang)}`, prevProfitLoss?.revenue);
            addSectionRows(t('pl.cogs', lang) || 'COGS', profitLoss.cogs, `${t('rep.total', lang)} ${t('pl.cogs', lang) || 'COGS'}`, prevProfitLoss?.cogs);
            addSubtotalRow(t('pl.grossProfit', lang), profitLoss.grossProfit, prevProfitLoss?.grossProfit);
            addSectionRows(t('pl.opEx', lang) || 'Operating Expenses', profitLoss.operatingExpenses, `${t('pl.totalOpEx', lang) || 'Total OpEx'}`, prevProfitLoss?.operatingExpenses);

            if (plView === 'ebitdar') {
              addSubtotalRow(t('pl.ebitdar', lang), profitLoss.ebitdar, prevProfitLoss?.ebitdar);
              addSectionRows(t('pl.rent', lang) || 'Rent', profitLoss.rent, `${t('rep.total', lang)} ${t('pl.rent', lang) || 'Rent'}`, prevProfitLoss?.rent);
            }
            addSubtotalRow(t('pl.ebitda', lang), profitLoss.ebitda, prevProfitLoss?.ebitda);
            addSectionRows(t('pl.depreciation', lang), profitLoss.depreciation, `${t('rep.total', lang)} ${t('pl.depreciation', lang)}`, prevProfitLoss?.depreciation);

            const otherItems = [...profitLoss.otherIncome.items, ...profitLoss.otherExpense.items];
            const otherTotal = profitLoss.otherIncome.total - profitLoss.otherExpense.total;
            const prevOtherItems = prevProfitLoss ? [...prevProfitLoss.otherIncome.items, ...prevProfitLoss.otherExpense.items] : undefined;
            const prevOtherTotal = prevProfitLoss ? prevProfitLoss.otherIncome.total - prevProfitLoss.otherExpense.total : undefined;
            if (otherItems.length > 0) {
              addSectionRows(t('pl.otherIncomeExpense', lang) || 'Other Income & Expense', { items: otherItems, total: otherTotal }, t('rep.total', lang), prevOtherItems && prevOtherTotal !== undefined ? { items: prevOtherItems, total: prevOtherTotal } : undefined);
            }

            addSubtotalRow(t('pl.ebt', lang), profitLoss.earningsBeforeTax, prevProfitLoss?.earningsBeforeTax);
            addSectionRows(t('pl.tax', lang) || 'Tax Expense', profitLoss.taxExpense, `${t('rep.total', lang)} ${t('pl.tax', lang) || 'Tax'}`, prevProfitLoss?.taxExpense);
            addSubtotalRow(t('rep.netProfit', lang), profitLoss.netProfit, prevProfitLoss?.netProfit);
          }
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, reportTitle);
          if (plSeries.length > 1) {
            const bd: Record<string, any>[] = plSeries.map(s => ({ Metric: s.label, Income: s.income, Expense: s.expense, Net: s.net }));
            const ws2 = XLSX.utils.json_to_sheet(bd);
            XLSX.utils.book_append_sheet(wb, ws2, `${reportTitle} - ${granularity}`);
          }
        }
        break;
      }
      case 'cash-flow': {
        if (cashFlow) {
          const showCmp = compareEnabled && !!prevCashFlow;
          const acctLabel = t('rep.account', lang);
          const balLabel = t('rep.balance', lang);
          const cfXlsxRow = (name: string, amount: number, prevItems?: { accountName: string; amount: number }[]) => {
            const p = prevItems ? new Map(prevItems.map(i => [i.accountName, i.amount])).get(name) : undefined;
            return showCmp && p !== undefined
              ? { [acctLabel]: name, [balLabel]: amount, Prev: p, 'Change %': formatPct(calcChange(amount, p).pct) }
              : { [acctLabel]: name, [balLabel]: amount };
          };
          const cfXlsxTotal = (label: string, amount: number, prevAmount?: number) =>
            showCmp && prevAmount !== undefined
              ? { [acctLabel]: label, [balLabel]: amount, Prev: prevAmount, 'Change %': formatPct(calcChange(amount, prevAmount).pct) }
              : { [acctLabel]: label, [balLabel]: amount };
          const data: Record<string, any>[] = [];
          data.push({ [acctLabel]: t('rep.beginning', lang), [balLabel]: cashFlow.beginningBalance });
          data.push({});
          data.push({ [acctLabel]: t('rep.inflows', lang), [balLabel]: '' });
          cashFlow.inflows.forEach(i => data.push(cfXlsxRow(i.accountName, i.amount, prevCashFlow?.inflows)));
          data.push(cfXlsxTotal(t('rep.total', lang), cashFlow.totalInflows, prevCashFlow?.totalInflows));
          data.push({});
          data.push({ [acctLabel]: t('rep.outflows', lang), [balLabel]: '' });
          cashFlow.outflows.forEach(i => data.push(cfXlsxRow(i.accountName, i.amount, prevCashFlow?.outflows)));
          data.push(cfXlsxTotal(t('rep.total', lang), cashFlow.totalOutflows, prevCashFlow?.totalOutflows));
          data.push({});
          data.push(cfXlsxTotal(t('rep.netChange', lang), cashFlow.netChange, prevCashFlow?.netChange));
          data.push(cfXlsxTotal(t('rep.ending', lang), cashFlow.endingBalance, prevCashFlow?.endingBalance));
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, reportTitle);
          if (cfSeries.length > 1) {
            const bd: Record<string, any>[] = cfSeries.map(s => ({ Metric: s.label, Inflow: s.inflow, Outflow: s.outflow, Net: s.net }));
            const ws2 = XLSX.utils.json_to_sheet(bd);
            XLSX.utils.book_append_sheet(wb, ws2, `${reportTitle} - ${granularity}`);
          }
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

    XLSX.writeFile(wb, `${ownerName || 'FAZAI'}-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-20 lg:pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('reports')} className="p-2 rounded-lg hover:bg-accent">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">{reportTitle}</h2>
      </div>

      {/* Consistent range filter UI */}
      <div className="flex flex-col gap-2">
        {(reportType === 'balance-sheet' || reportType === 'trial-balance') && (
          <ReportFilterBar
            mode="asof" lang={lang}
            month={selectedMonth} year={selectedYear}
            onMonth={(m) => { setSelectedMonth(m); setAsofPreset('custom'); }}
            onYear={(y) => { setSelectedYear(y); setAsofPreset('custom'); }}
            onPreset={applyAsofPreset} activePreset={asofPreset}
          />
        )}
        {(reportType === 'profit-loss' || reportType === 'cash-flow' || reportType === 'ledger') && (
          <ReportFilterBar
            mode="range" lang={lang}
            fromMonth={fromMonth} fromYear={fromYear} toMonth={toMonth} toYear={toYear}
            onFromMonth={(m) => { setFromMonth(m); setRangePreset('custom'); }}
            onFromYear={(y) => { setFromYear(y); setRangePreset('custom'); }}
            onToMonth={(m) => { setToMonth(m); setRangePreset('custom'); }}
            onToYear={(y) => { setToYear(y); setRangePreset('custom'); }}
            onPreset={applyRangePreset} activePreset={rangePreset}
            granularity={granularity} onGranularity={setGranularity}
            showGranularity={reportType === 'profit-loss' || reportType === 'cash-flow'}
          />
        )}

        {reportType === 'ledger' && (
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-full sm:w-48 h-8 text-xs"><SelectValue placeholder={t('rep.selectAccount', lang)} /></SelectTrigger>
            <SelectContent>
              {accounts.filter(a => a.parentId).map(a => (
                <SelectItem key={a.id} value={a.id}>{getAccountName(a, lang)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(reportType === 'profit-loss' || reportType === 'cash-flow' || reportType === 'balance-sheet') && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={compareEnabled} onChange={(e) => setCompareEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-red-600" />
            Compare to previous period (default ON)
          </label>
        )}
      </div>

      {/* Generate & Export Buttons */}
      <div className="flex gap-2 flex-wrap">
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
            <table className="w-full min-w-[560px] text-sm md:text-[15px]">
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
              {compareEnabled && prevBalanceSheet && compareStrip(balanceSheet.assets.total, prevBalanceSheet.assets.total, `Assets vs prev`)}
              {[
                { section: balanceSheet.assets, prev: prevBalanceSheet?.assets, color: 'red' },
                { section: balanceSheet.liabilities, prev: prevBalanceSheet?.liabilities, color: 'blue' },
                { section: balanceSheet.equity, prev: prevBalanceSheet?.equity, color: 'purple' },
              ].map(({ section, prev, color }) => (
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
                        <td className="p-2">{t('rep.total', lang)} {section.label}{chgText(section.total, prev?.total)}</td>
                        <td className="text-right p-2">{formatNumber(section.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="border-t-2 pt-3 font-semibold text-sm">
                {t('rep.total', lang)} {t('rep.liabilities', lang)} + {t('rep.equity', lang)}: {formatNumber(balanceSheet.totalLiabilitiesAndEquity)}
                {chgText(balanceSheet.totalLiabilitiesAndEquity, prevBalanceSheet?.totalLiabilitiesAndEquity)}
              </div>
            </div>
          )}

          {reportType === 'profit-loss' && profitLoss && (
            <div className="p-4">
              {compareEnabled && prevProfitLoss && compareStrip(profitLoss.netProfit, prevProfitLoss.netProfit, `${t('rep.netProfit', lang)} vs prev`)}
              <div className="flex gap-1 mb-4">
                {(['standard', 'ebitda', 'ebitdar'] as const).map(v => (
                  <Button key={v} size="sm" variant={plView === v ? 'default' : 'outline'} className="h-7 text-[10px] px-2" onClick={() => setPlView(v)}>
                    {v === 'standard' ? 'Standard' : v === 'ebitda' ? 'EBITDA' : 'EBITDAR'}
                  </Button>
                ))}
              </div>

              {plView === 'standard' && (
                <>
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
                        <td className="p-2">{t('rep.total', lang)}{chgText(profitLoss.income.total, prevProfitLoss?.income.total)}</td>
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
                        <td className="p-2">{t('rep.total', lang)}{chgText(profitLoss.expenses.total, prevProfitLoss?.expenses.total)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.expenses.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg text-green-600">
                    {t('rep.netProfit', lang)}: {formatNumber(profitLoss.netProfit)}
                    {chgText(profitLoss.netProfit, prevProfitLoss?.netProfit)}
                  </div>
                </>
              )}

              {plView === 'ebitda' && (
                <>
                  <h3 className="font-semibold text-sm mb-2 text-red-600">{t('pl.revenue', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.revenue.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('pl.totalRevenue', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.revenue.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <h3 className="font-semibold text-sm mb-2 text-red-600">{t('pl.cogs', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.cogs.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.cogs.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.grossProfit', lang)}: {formatNumber(profitLoss.grossProfit)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.opEx', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.operatingExpenses.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('pl.totalOpEx', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.operatingExpenses.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.ebitda', lang)}: {formatNumber(profitLoss.ebitda)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.depreciation', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.depreciation.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.depreciation.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {(profitLoss.otherIncome.items.length > 0 || profitLoss.otherExpense.items.length > 0) && (
                    <>
                      <h3 className="font-semibold text-sm mb-2 text-red-600">{t('pl.otherIncomeExpense', lang)}</h3>
                      <table className="w-full text-sm mb-4">
                        <tbody>
                          {[...profitLoss.otherIncome.items, ...profitLoss.otherExpense.items].map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{item.accountName}</td>
                              <td className="text-right p-2">{formatNumber(item.amount)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-semibold">
                            <td className="p-2">{t('rep.total', lang)}</td>
                            <td className="text-right p-2">{formatNumber(profitLoss.otherIncome.total - profitLoss.otherExpense.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.ebt', lang)}: {formatNumber(profitLoss.earningsBeforeTax)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.tax', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.taxExpense.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.taxExpense.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg text-green-600">
                    {t('rep.netProfit', lang)}: {formatNumber(profitLoss.netProfit)}
                  </div>
                </>
              )}

              {plView === 'ebitdar' && (
                <>
                  <h3 className="font-semibold text-sm mb-2 text-red-600">{t('pl.revenue', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.revenue.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('pl.totalRevenue', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.revenue.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <h3 className="font-semibold text-sm mb-2 text-red-600">{t('pl.cogs', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.cogs.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.cogs.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.grossProfit', lang)}: {formatNumber(profitLoss.grossProfit)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.opEx', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.operatingExpenses.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('pl.totalOpEx', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.operatingExpenses.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.ebitdar', lang)}: {formatNumber(profitLoss.ebitdar)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.rent', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.rent.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.rent.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.ebitda', lang)}: {formatNumber(profitLoss.ebitda)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.depreciation', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.depreciation.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.depreciation.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {(profitLoss.otherIncome.items.length > 0 || profitLoss.otherExpense.items.length > 0) && (
                    <>
                      <h3 className="font-semibold text-sm mb-2 text-red-600">{t('pl.otherIncomeExpense', lang)}</h3>
                      <table className="w-full text-sm mb-4">
                        <tbody>
                          {[...profitLoss.otherIncome.items, ...profitLoss.otherExpense.items].map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{item.accountName}</td>
                              <td className="text-right p-2">{formatNumber(item.amount)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-semibold">
                            <td className="p-2">{t('rep.total', lang)}</td>
                            <td className="text-right p-2">{formatNumber(profitLoss.otherIncome.total - profitLoss.otherExpense.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}
                  <div className="border-t-2 pt-3 font-bold text-lg">{t('pl.ebt', lang)}: {formatNumber(profitLoss.earningsBeforeTax)}</div>
                  <h3 className="font-semibold text-sm mb-2 mt-4 text-red-600">{t('pl.tax', lang)}</h3>
                  <table className="w-full text-sm mb-4">
                    <tbody>
                      {profitLoss.taxExpense.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.accountName}</td>
                          <td className="text-right p-2">{formatNumber(item.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold">
                        <td className="p-2">{t('rep.total', lang)}</td>
                        <td className="text-right p-2">{formatNumber(profitLoss.taxExpense.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border-t-2 pt-3 font-bold text-lg text-green-600">
                    {t('rep.netProfit', lang)}: {formatNumber(profitLoss.netProfit)}
                  </div>
                </>
              )}
            </div>
          )}

          {reportType === 'cash-flow' && cashFlow && (
            <div className="p-4">
              {compareEnabled && prevCashFlow && compareStrip(cashFlow.netChange, prevCashFlow.netChange, `${t('rep.netChange', lang)} vs prev`)}
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
                    <td className="p-2">{t('rep.total', lang)}{chgText(cashFlow.totalInflows, prevCashFlow?.totalInflows)}</td>
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
                    <td className="p-2">{t('rep.total', lang)}{chgText(cashFlow.totalOutflows, prevCashFlow?.totalOutflows)}</td>
                    <td className="text-right p-2">{formatNumber(cashFlow.totalOutflows)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="border-t-2 pt-3 space-y-1 text-sm font-semibold">
                <div>{t('rep.netChange', lang)}: {formatNumber(cashFlow.netChange)}{chgText(cashFlow.netChange, prevCashFlow?.netChange)}</div>
                <div>{t('rep.ending', lang)}: {formatNumber(cashFlow.endingBalance)}{chgText(cashFlow.endingBalance, prevCashFlow?.endingBalance)}</div>
              </div>
            </div>
          )}

          {reportType === 'ledger' && (
            <table className="w-full min-w-[640px] text-sm">
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

          {reportType === 'contact-statement' && (
            <div className="p-4">
              <ContactStatement />
            </div>
          )}

          {((reportType === 'trial-balance' && trialBalance.length === 0) ||
            (reportType === 'ledger' && ledgerEntries.length === 0) ||
            (reportType === 'contact-statement' && contactRows.length === 0) ||
            (reportType === 'balance-sheet' && !balanceSheet) ||
            (reportType === 'profit-loss' && !profitLoss) ||
            (reportType === 'cash-flow' && !cashFlow)) && (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('rep.noData', lang)}</div>
          )}
        </div>
      </Card>

      {reportType === 'profit-loss' && profitLoss && plSeries.length > 1 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-2 capitalize">{granularity} breakdown</p>
          <TrendChart data={plSeries.map(s => s.net)} labels={plSeries.map(s => s.label)} height={120} />
          <div className="overflow-x-auto mt-2">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="bg-muted/60">
                  <th className="text-left p-2">Metric</th>
                  {plSeries.map(s => <th key={s.label} className="text-right p-2 whitespace-nowrap">{s.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Income</td>{plSeries.map(s => <td key={s.label} className="text-right p-2">{formatNumber(s.income)}</td>)}</tr>
                <tr className="border-t"><td className="p-2">Expense</td>{plSeries.map(s => <td key={s.label} className="text-right p-2">{formatNumber(s.expense)}</td>)}</tr>
                <tr className="border-t-2 font-semibold"><td className="p-2">Net</td>{plSeries.map(s => <td key={s.label} className="text-right p-2">{formatNumber(s.net)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {reportType === 'cash-flow' && cashFlow && cfSeries.length > 1 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-2 capitalize">{granularity} breakdown</p>
          <TrendChart data={cfSeries.map(s => s.net)} labels={cfSeries.map(s => s.label)} height={120} />
          <div className="overflow-x-auto mt-2">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="bg-muted/60">
                  <th className="text-left p-2">Metric</th>
                  {cfSeries.map(s => <th key={s.label} className="text-right p-2 whitespace-nowrap">{s.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Inflow</td>{cfSeries.map(s => <td key={s.label} className="text-right p-2">{formatNumber(s.inflow)}</td>)}</tr>
                <tr className="border-t"><td className="p-2">Outflow</td>{cfSeries.map(s => <td key={s.label} className="text-right p-2">{formatNumber(s.outflow)}</td>)}</tr>
                <tr className="border-t-2 font-semibold"><td className="p-2">Net</td>{cfSeries.map(s => <td key={s.label} className="text-right p-2">{formatNumber(s.net)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
