'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, LANG_LABELS, type Lang } from '@/lib/i18n';
import { db } from '@/lib/fazai-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { LogOut } from 'lucide-react';

export function SettingsPage() {
  const { lang, setLang, userId, logout } = useAuthStore();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleChangePin = async () => {
    if (newPin.length !== 6 || newPin !== confirmPin) {
      toast({ title: t('common.error', lang), description: 'PINs do not match' });
      return;
    }

    if (!userId) return;

    const user = await db.users.get(userId);
    if (!user || user.pin !== oldPin) {
      toast({ title: t('common.error', lang), description: t('login.wrongPin', lang) });
      return;
    }

    await db.users.update(userId, { pin: newPin });
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    toast({ title: t('common.success', lang) });
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h2 className="text-xl font-bold">{t('nav.settings', lang)}</h2>

      {/* Language */}
      <Card className="p-4">
        <label className="text-sm font-medium">{t('admin.language', lang)}</label>
        <div className="flex gap-2 mt-2">
          {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLang(key)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                lang === key
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-medium'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card className="p-4">
        <label className="text-sm font-medium">{t('admin.theme', lang)}</label>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setTheme('light')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              theme === 'light'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-medium'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {t('admin.light', lang)}
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-medium'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {t('admin.dark', lang)}
          </button>
        </div>
      </Card>

      {/* Change PIN */}
      <Card className="p-4">
        <label className="text-sm font-medium">{t('admin.changePin', lang)}</label>
        <div className="flex flex-col gap-2 mt-2">
          <Input
            type="password"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('admin.oldPin', lang)}
            maxLength={6}
          />
          <Input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('admin.newPin', lang)}
            maxLength={6}
          />
          <Input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('admin.confirmPin', lang)}
            maxLength={6}
          />
          <Button
            onClick={handleChangePin}
            disabled={oldPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6}
            variant="outline"
          >
            {t('admin.changePin', lang)}
          </Button>
        </div>
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        onClick={logout}
        className="w-full"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    </div>
  );
}
