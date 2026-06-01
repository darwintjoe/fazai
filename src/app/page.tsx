'use client';

import React, { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { PinLogin } from '@/components/fazai/pin-login';
import { Dashboard } from '@/components/fazai/dashboard';
import { TransactionForm } from '@/components/fazai/transaction-form';
import { History } from '@/components/fazai/history';
import { Reports } from '@/components/fazai/reports';
import { ReportViewer } from '@/components/fazai/report-viewer';
import { AdminPanel } from '@/components/fazai/admin-panel';
import { BottomNav } from '@/components/fazai/bottom-nav';
import { AiChat } from '@/components/fazai/ai-chat';
import { SettingsPage } from '@/components/fazai/settings';
import { UserGuide } from '@/components/fazai/user-guide';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { t } from '@/lib/i18n';
import { runStartupMaintenance } from '@/lib/ledger-engine';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function Home() {
  const { isAuthenticated, logout, lang, userName, userRole } = useAuthStore();
  const { currentPage } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  // Run startup maintenance (rollover summaries, archive old tx) when app loads
  React.useEffect(() => {
    if (isAuthenticated) {
      runStartupMaintenance();
    }
  }, [isAuthenticated]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinLogin />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'income':
        return <TransactionForm type="income" />;
      case 'expense':
        return <TransactionForm type="expense" />;
      case 'history':
        return <History />;
      case 'reports':
        return <Reports />;
      case 'report-viewer':
        return <ReportViewer />;
      case 'admin':
      case 'admin-users':
      case 'admin-accounts':
      case 'admin-custom':
      case 'admin-settings':
      case 'admin-backup':
        return <AdminPanel />;
      case 'settings':
        return <SettingsPage />;
      case 'guide':
        return <UserGuide standalone />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top-right header with user info and logout */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 h-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{userName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 capitalize">
              {userRole}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('nav.logout', lang)}
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-3 safe-area-top">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
      <AiChat />
    </div>
  );
}
