'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { formatNumber, startOfMonthFor, endOfMonthFor } from '@/lib/format';
import { generateProfitLoss, generateBalanceSheet, getAccountBalances } from '@/lib/ledger-engine';
import { shiftMonth } from '@/lib/report-period';
import { db } from '@/lib/fazai-db';
import { FileText, PieChart, TrendingUp, DollarSign, BookOpen, ChevronRight, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { MultiTrendChart } from '@/components/fazai/trend-chart';

const MENU = [
  { id: 'trial-balance', icon: FileText, color: 'from-blue-500 to-indigo-600', desc: 'Debit / credit balances as of month-end' },
  { id: 'balance-sheet', icon: PieChart, color: 'from-purple-500 to-violet-600', desc: 'Assets, liabilities, equity + compare' },
  { id: 'profit-loss', icon: TrendingUp, color: 'from-red-600 to-amber-600', desc: 'Income vs expense + M/Q/Y + compare' },
  { id: 'cash-flow', icon: DollarSign, color: 'from-amber-500 to-orange-600', desc: 'Inflows, outflows + M/Q/Y + compare' },
  { id: 'ledger', icon: BookOpen, color: 'from-rose-500 to-pink-600', desc: 'Per-account entries with running balance' },
] as const;

const REPORT_KEY_MAP: Record<string, string> = {
  'trial-balance': 'rep.trialBalance',
  'balance-sheet': 'rep.balanceSheet',
  'profit-loss': 'rep.profitLoss',
  'cash-flow': 'rep.cashFlow',
  'ledger': 'rep.ledger',
};

type PeriodMode = 'mtd' | 'ytd';

interface KpiData {
  mtdProfit: number;
  mtdIncome: number;
  ytdProfit: number;
  ytdIncome: number;
  assets: number;
  equity: number;
  ar: number;
  ap: number;
  cash: number;
  liabilities: number;
}

export function Reports() {
  const { lang, userRole } = useAuthStore();
  const { navigate, setReportType } = useAppStore();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [period, setPeriod] = useState<PeriodMode>('mtd');
  const [trend, setTrend] = useState<{ labels: string[]; income: number[]; net: number[]; assets: number[] }>({ labels: [], income: [], net: [], assets: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const mtdFrom = startOfMonthFor(now.getFullYear(), now.getMonth());
      const ytdFrom = startOfMonthFor(now.getFullYear(), 0);
      const to = new Date();
      const asOf = endOfMonthFor(now.getFullYear(), now.getMonth());
      const [plMtd, plYtd, bs, accounts, balances] = await Promise.all([
        generateProfitLoss(mtdFrom, to, lang),
        generateProfitLoss(ytdFrom, to, lang),
        generateBalanceSheet(asOf, lang),
        db.accounts.filter(a => a.isActive).toArray(),
        getAccountBalances(undefined, new Date()),
      ]);
      let ar = 0, ap = 0, cash = 0;
      for (const a of accounts) {
        const b = balances.get(a.id);
        if (!b) continue;
        if (a.categoryId === 'cat-ar') ar += b.debit - b.credit;
        else if (a.categoryId === 'cat-ap') ap += b.credit - b.debit;
        if (a.type === 'cashBank') cash += b.debit - b.credit;
      }
      // 12-month trend: income + net profit per month, assets as-of month-end
      const labels: string[] = [];
      const income: number[] = [];
      const net: number[] = [];
      const assets: number[] = [];
      for (let i = 11; i >= 0; i--) {
        const s = shiftMonth(now.getFullYear(), now.getMonth(), -i);
        const sf = startOfMonthFor(s.year, s.month);
        const st = i === 0 ? new Date() : endOfMonthFor(s.year, s.month);
        const [p, b] = await Promise.all([
          generateProfitLoss(sf, st, lang),
          generateBalanceSheet(endOfMonthFor(s.year, s.month), lang),
        ]);
        labels.push(`${s.month + 1}/${String(s.year).slice(2)}`);
        income.push(p.income.total);
        net.push(p.netProfit);
        assets.push(b.assets.total);
      }
      if (!cancelled) {
        setKpi({
          mtdProfit: plMtd.netProfit, mtdIncome: plMtd.income.total,
          ytdProfit: plYtd.netProfit, ytdIncome: plYtd.income.total,
          assets: bs.assets.total, equity: bs.equity.total,
          ar, ap, cash, liabilities: bs.liabilities.total,
        });
        setTrend({ labels, income, net, assets });
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 pb-20">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{t('rep.title', lang)} — Admin only</p>
      </div>
    );
  }

  const handleSelect = (id: string) => {
    setReportType(id);
    navigate('report-viewer');
  };

  const profit = kpi ? (period === 'mtd' ? kpi.mtdProfit : kpi.ytdProfit) : 0;
  const incomeVal = kpi ? (period === 'mtd' ? kpi.mtdIncome : kpi.ytdIncome) : 0;
  const roe = kpi && kpi.equity !== 0 ? (profit / kpi.equity) * 100 : null;
  const acid = kpi && kpi.liabilities !== 0 ? (kpi.cash + kpi.ar) / kpi.liabilities : null;

  const toggle = (
    <div className="flex gap-1">
      {(['mtd', 'ytd'] as const).map(m => (
        <button
          key={m}
          onClick={(e) => { e.stopPropagation(); setPeriod(m); }}
          className={`h-6 text-[10px] px-2 rounded-full border uppercase ${period === m ? 'bg-red-600 text-white border-red-600' : 'text-muted-foreground border-border'}`}
        >
          {m}
        </button>
      ))}
    </div>
  );

  const cards = kpi ? [
    { label: t('rep.netProfit', lang), big: formatNumber(profit), small: `${t('dash.income', lang)} ${formatNumber(incomeVal)}`, extra: toggle },
    { label: t('rep.assets', lang), big: formatNumber(kpi.assets), small: `${t('rep.equity', lang)} ${formatNumber(kpi.equity)}`, extra: null },
    { label: 'AR', big: formatNumber(kpi.ar), small: `AP ${formatNumber(kpi.ap)}`, extra: null },
    { label: 'ROE', big: roe === null ? '—' : `${roe >= 0 ? '+' : ''}${roe.toFixed(1)}%`, small: `Acid ${acid === null ? '—' : acid.toFixed(2)}x`, extra: toggle },
  ] : [];

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-20 lg:pb-10">
      <h2 className="text-xl md:text-2xl font-bold">{t('rep.title', lang)}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground font-medium truncate">{c.label}</p>
                {c.extra}
              </div>
              <p className="text-lg md:text-2xl font-bold mt-1 tracking-tight">{c.big}</p>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{c.small}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">12M trend · Income + Assets (L) · Net profit (R)</p>
        </div>
        {trend.labels.length > 0 ? (
          <MultiTrendChart
            labels={trend.labels}
            series={[
              { name: 'Income', color: '#dc2626', data: trend.income, axis: 'left' },
              { name: 'Asset', color: '#7c3aed', data: trend.assets, axis: 'left' },
              { name: 'Net profit', color: '#16a34a', data: trend.net, axis: 'right' },
            ]}
            height={190}
          />
        ) : (
          <p className="text-xs text-muted-foreground py-6 text-center">Loading…</p>
        )}
      </Card>

      <div>
        <p className="text-sm font-semibold mb-2 px-1">All reports</p>
        <div className="flex flex-col gap-2">
          {MENU.map((report) => {
            const Icon = report.icon;
            return (
              <motion.div key={report.id} whileTap={{ scale: 0.99 }}>
                <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleSelect(report.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${report.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{t(REPORT_KEY_MAP[report.id] as any, lang)}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{report.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
