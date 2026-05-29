'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t, LANG_LABELS, type Lang } from '@/lib/i18n';
import { db, seedDatabase } from '@/lib/fazai-db';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export function PinLogin() {
  const { login, lang, setLang } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [seeding, setSeeding] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 mb-8"
      >
        <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
          <img src="/icon-192x192.png" alt="FAZAI" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          FAZAI
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
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
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
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
