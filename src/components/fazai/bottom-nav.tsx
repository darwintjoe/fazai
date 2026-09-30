'use client';

import React from 'react';
import { useAppStore } from '@/lib/app-store';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { Home, BarChart3, History, Shield, Settings, Users } from 'lucide-react';

export function BottomNav() {
  const { currentPage, navigate } = useAppStore();
  const { userRole, lang } = useAuthStore();
  const isAdmin = userRole === 'admin';

  const items = [
    { id: 'dashboard' as const, icon: Home, label: t('nav.home', lang) },
    ...(isAdmin ? [{ id: 'reports' as const, icon: BarChart3, label: t('nav.reports', lang) }] : []),
    { id: 'history' as const, icon: History, label: t('nav.history', lang) },
    { id: 'contacts' as const, icon: Users, label: t('nav.contacts', lang) },
    ...(isAdmin ? [{ id: 'admin' as const, icon: Shield, label: t('nav.admin', lang) }] : []),
    { id: 'settings' as const, icon: Settings, label: t('nav.settings', lang) },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id ||
            (item.id === 'admin' && currentPage.startsWith('admin')) ||
            (item.id === 'reports' && currentPage === 'report-viewer');
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
                isActive
                  ? 'text-red-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function SidebarNav() {
  const { currentPage, navigate } = useAppStore();
  const { userRole, lang } = useAuthStore();
  const isAdmin = userRole === 'admin';

  const items = [
    { id: 'dashboard' as const, icon: Home, label: t('nav.home', lang) },
    ...(isAdmin ? [{ id: 'reports' as const, icon: BarChart3, label: t('nav.reports', lang) }] : []),
    { id: 'history' as const, icon: History, label: t('nav.history', lang) },
    { id: 'contacts' as const, icon: Users, label: t('nav.contacts', lang) },
    ...(isAdmin ? [{ id: 'admin' as const, icon: Shield, label: t('nav.admin', lang) }] : []),
    { id: 'settings' as const, icon: Settings, label: t('nav.settings', lang) },
  ];

  return (
    <aside className="hidden lg:flex w-60 xl:w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] py-6 pr-2">
      <nav className="flex flex-col gap-1 w-full">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id ||
            (item.id === 'admin' && currentPage.startsWith('admin')) ||
            (item.id === 'reports' && currentPage === 'report-viewer');
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
