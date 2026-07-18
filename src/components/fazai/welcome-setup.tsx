'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { db } from '@/lib/fazai-db';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface WelcomeSetupProps {
  onComplete: () => void;
}

export function WelcomeSetup({ onComplete }: WelcomeSetupProps) {
  const { lang, userId } = useAuthStore();
  const [ownerName, setOwnerName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const pinsMatch = pin.length === 6 && confirmPin.length === 6 && pin === confirmPin;
  const canSave = ownerName.trim().length > 0 && pinsMatch;

  const handlePinChange = (value: string, field: 'pin' | 'confirmPin') => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (field === 'pin') {
      setPin(digits);
    } else {
      setConfirmPin(digits);
    }
  };

  // Show mismatch when both fields are fully filled (6 digits) but don't match
  const showMismatch = pin.length === 6 && confirmPin.length === 6 && pin !== confirmPin;

  const handleSave = async () => {
    if (!canSave || !userId) return;
    setSaving(true);
    try {
      // Save owner name to settings
      await db.settings.put({ key: 'owner-name', value: ownerName.trim() });
      // Update PIN (no old PIN verification)
      await db.users.update(userId, { pin });
      onComplete();
    } catch (err) {
      console.error('[WelcomeSetup] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex flex-col items-center justify-center p-4"
      >
        <div className="w-full max-w-sm flex flex-col gap-6">
          {/* Title */}
          <div className="text-center">
            <img src="/FAZAI.jpg" alt="FAZAI" className="w-16 h-16 rounded-2xl shadow-lg object-cover mx-auto mb-3" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-amber-600 bg-clip-text text-transparent">
              {t('setup.welcomeTitle', lang)}
            </h1>
          </div>

          {/* Owner Name Section */}
          <div className="bg-card rounded-2xl shadow-xl border p-6">
            <p className="text-center text-sm text-muted-foreground mb-4">
              {t('setup.ownerCaption', lang)}
            </p>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={t('setup.ownerPlaceholder', lang)}
              className="text-center text-lg font-semibold"
              autoFocus
            />
            <p className="text-center text-xs text-muted-foreground mt-3">
              {t('setup.ownerDesc', lang)}
            </p>
          </div>

          {/* PIN Section */}
          <div className="bg-card rounded-2xl shadow-xl border p-6">
            <p className="text-center text-sm font-medium mb-4">
              {t('setup.setPin', lang)}
            </p>
            <div className="flex flex-col gap-3">
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, 'pin')}
                placeholder="••••••"
                maxLength={6}
                className="text-center text-lg tracking-[0.5em]"
              />
              <Input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, 'confirmPin')}
                placeholder="••••••"
                maxLength={6}
                className="text-center text-lg tracking-[0.5em]"
              />
            </div>
            {showMismatch && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-red-500 text-xs mt-2"
              >
                {lang === 'id' ? 'PIN tidak cocok' : lang === 'zh' ? 'PIN码不匹配' : 'PINs do not match'}
              </motion.p>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-6 text-base font-semibold"
          >
            {saving
              ? t('common.loading', lang)
              : t('common.save', lang)}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
