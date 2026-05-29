'use client';

import React from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { FileText, PieChart, TrendingUp, DollarSign, BookOpen, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

const REPORT_TYPES = [
  { id: 'trial-balance', icon: FileText, color: 'from-blue-500 to-indigo-600' },
  { id: 'balance-sheet', icon: PieChart, color: 'from-purple-500 to-violet-600' },
  { id: 'profit-loss', icon: TrendingUp, color: 'from-emerald-500 to-teal-600' },
  { id: 'cash-flow', icon: DollarSign, color: 'from-amber-500 to-orange-600' },
  { id: 'ledger', icon: BookOpen, color: 'from-rose-500 to-pink-600' },
] as const;

const REPORT_KEY_MAP: Record<string, string> = {
  'trial-balance': 'rep.trialBalance',
  'balance-sheet': 'rep.balanceSheet',
  'profit-loss': 'rep.profitLoss',
  'cash-flow': 'rep.cashFlow',
  'ledger': 'rep.ledger',
};

export function Reports() {
  const { lang, userRole } = useAuthStore();
  const { navigate, setReportType } = useAppStore();

  // Restrict reports to Admin only
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

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h2 className="text-xl font-bold">{t('rep.title', lang)}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORT_TYPES.map((report) => {
          const Icon = report.icon;
          return (
            <motion.div
              key={report.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleSelect(report.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${report.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {t(REPORT_KEY_MAP[report.id] as any, lang)}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
