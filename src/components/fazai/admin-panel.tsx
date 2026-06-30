'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { AdminUsers } from './admin-users';
import { AdminAccounts } from './admin-accounts';
import { AdminCustomEntry } from './admin-custom-entry';
import { AdminBackup } from './admin-backup';
import { AdminAiSettings } from './admin-ai-settings';
import { AdminPosConnections } from './admin-pos-connections';
import { Users, BookOpen, PenTool, Database, Bot, Store } from 'lucide-react';
import { motion } from 'framer-motion';

const ADMIN_TABS = [
  { id: 'admin-users', icon: Users, labelKey: 'admin.users' as const },
  { id: 'admin-accounts', icon: BookOpen, labelKey: 'admin.accounts' as const },
  { id: 'admin-custom', icon: PenTool, labelKey: 'admin.customTransaction' as const },
  { id: 'admin-pos', icon: Store, labelKey: 'admin.pos' as const },
  { id: 'admin-ai', icon: Bot, labelKey: 'admin.aiSettings' as const },
  { id: 'admin-backup', icon: Database, labelKey: 'admin.backup' as const },
];

export function AdminPanel() {
  const { lang, userRole } = useAuthStore();
  const { currentPage } = useAppStore();
  const [activeTab, setActiveTab] = useState<string>(currentPage.startsWith('admin-') ? currentPage : 'admin-users');

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        <p>Access denied</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h2 className="text-xl font-bold">{t('admin.title', lang)}</h2>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(tab.labelKey, lang)}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {activeTab === 'admin-users' && <AdminUsers />}
        {activeTab === 'admin-accounts' && <AdminAccounts />}
        {activeTab === 'admin-custom' && <AdminCustomEntry />}
        {activeTab === 'admin-pos' && <AdminPosConnections />}
        {activeTab === 'admin-ai' && <AdminAiSettings />}
        {activeTab === 'admin-backup' && <AdminBackup />}
      </motion.div>
    </div>
  );
}
