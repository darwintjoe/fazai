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
import { AnimatePresence, motion } from 'framer-motion';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const { currentPage } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

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
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 pt-4 safe-area-top">
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
