'use client';

import React from 'react';
import { useAppStore } from '@/lib/app-store';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { Home, BarChart3, History, Shield, Settings } from 'lucide-react';

export function BottomNav() {
  const { currentPage, navigate } = useAppStore();
  const { userRole, lang } = useAuthStore();
  const isAdmin = userRole === 'admin';

  const items = [
    { id: 'dashboard' as const, icon: Home, label: t('nav.home', lang) },
    { id: 'reports' as const, icon: BarChart3, label: t('nav.reports', lang) },
    { id: 'history' as const, icon: History, label: t('nav.history', lang) },
    ...(isAdmin ? [{ id: 'admin' as const, icon: Shield, label: t('nav.admin', lang) }] : []),
    { id: 'settings' as const, icon: Settings, label: t('nav.settings', lang) },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
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
                  ? 'text-emerald-600'
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
