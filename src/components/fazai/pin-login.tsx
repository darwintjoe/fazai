'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, LANG_LABELS, type Lang } from '@/lib/i18n';
import { db, seedDatabase } from '@/lib/fazai-db';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Globe, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserGuide } from '@/components/fazai/user-guide';

const DEVICE_ID_KEY = 'pos_device_id_FAZAI';

export function PinLogin() {
  const { login, lang, setLang } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [seeding, setSeeding] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const readDeviceId = () => {
      const id = typeof window !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
      setDeviceId(id);
    };
    readDeviceId();
    window.addEventListener('storage', readDeviceId);
    return () => window.removeEventListener('storage', readDeviceId);
  }, []);

  const handlePinSubmit = useCallback(async (pinValue: string) => {
    if (pinValue.length !== 6) return;

    try {
      const user = await db.users.where('pin').equals(pinValue).first();
      if (user) {
        login(user.id, user.name, user.role);
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 1500);
      }
    } catch {
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 1500);
    }
  }, [login]);

  useEffect(() => {
    seedDatabase().then(() => setSeeding(false)).catch(() => setSeeding(false));
  }, []);

  useEffect(() => {
    if (pin.length === 6) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handlePinSubmit(pin);
    }
  }, [pin, handlePinSubmit]);

  if (seeding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 mb-8"
      >
        <img src="/FAZAI.jpg" alt="FAZAI" className="w-20 h-20 rounded-2xl shadow-lg object-cover" />
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-red-600 to-amber-600 bg-clip-text text-transparent">
          {t('login.title', lang)}
        </h1>
        <p className="text-muted-foreground text-sm">Simple Accounting</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl shadow-xl border p-8 w-full max-w-sm"
      >
        <p className="text-center text-sm text-muted-foreground mb-6">
          {t('login.enterPin', lang)}
        </p>

        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={pin}
            onChange={setPin}
            containerClassName="gap-2"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-red-500 text-sm mb-4"
          >
            {t('login.wrongPin', lang)}
          </motion.p>
        )}

        <Button
          onClick={() => handlePinSubmit(pin)}
          disabled={pin.length !== 6}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
        >
          {t('login.unlock', lang)}
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex items-center gap-2"
      >
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t('login.selectLanguage', lang)}:</span>
        {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setLang(key)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              lang === key
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={() => setShowGuide(true)}
        className="mt-4 flex items-center gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium transition-colors"
      >
        <BookOpen className="w-4 h-4" />
        {t('guide.title', lang)}
      </motion.button>

      {showGuide && (
        <UserGuide overlay onClose={() => setShowGuide(false)} />
      )}

      {deviceId && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <span className="font-mono text-[10px] text-muted-foreground/40 select-all">
            {deviceId}
          </span>
        </div>
      )}
    </div>
  );
}
