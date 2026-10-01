'use client';

import React from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, type TranslationKeys } from '@/lib/i18n';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, BookOpen, Rocket, Users, Wallet, BarChart3, Database, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface GuideSection {
  id: string;
  titleKey: keyof TranslationKeys;
  descKey: keyof TranslationKeys;
  icon: React.ElementType;
}

const guideSections: GuideSection[] = [
  {
    id: 'first',
    titleKey: 'guide.first',
    descKey: 'guide.first.desc',
    icon: Rocket,
  },
  {
    id: 'setup',
    titleKey: 'guide.setup',
    descKey: 'guide.setup.desc',
    icon: Users,
  },
  {
    id: 'daily',
    titleKey: 'guide.daily',
    descKey: 'guide.daily.desc',
    icon: Wallet,
  },
  {
    id: 'check',
    titleKey: 'guide.check',
    descKey: 'guide.check.desc',
    icon: BarChart3,
  },
  {
    id: 'safe',
    titleKey: 'guide.safe',
    descKey: 'guide.safe.desc',
    icon: Database,
  },
  {
    id: 'fix',
    titleKey: 'guide.fix',
    descKey: 'guide.fix.desc',
    icon: Shield,
  },
];

interface UserGuideProps {
  /** If true, renders as a standalone page with back navigation */
  standalone?: boolean;
  /** If true, renders as a full-screen overlay with close button */
  overlay?: boolean;
  /** Close callback for overlay mode */
  onClose?: () => void;
}

export function UserGuide({ standalone = false, overlay = false, onClose }: UserGuideProps) {
  const { lang } = useAuthStore();
  const { navigate, previousPage } = useAppStore();

  const handleBack = () => {
    if (previousPage) {
      navigate(previousPage);
    } else {
      navigate('settings');
    }
  };

  const wrapperClass = overlay
    ? 'fixed inset-0 z-[100] bg-background overflow-y-auto'
    : 'flex flex-col gap-4 md:gap-6 pb-20 lg:pb-10';

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className="flex items-center gap-3 px-1 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
        {standalone && (
          <button
            onClick={handleBack}
            className="p-1 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {overlay && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-bold">{t('guide.title', lang)}</h2>
        </div>
      </div>

      {/* Content */}
      <div className={overlay ? 'px-4 md:px-6 md:max-w-3xl md:mx-auto md:pb-8' : ''}>
        <Accordion type="multiple" className="w-full">
          {guideSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <AccordionItem value={section.id}>
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="font-medium text-sm">{t(section.titleKey, lang)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-11 pr-2">
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {t(section.descKey, lang)}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            );
          })}
        </Accordion>
      </div>

      {/* Close button for overlay mode */}
      {overlay && (
        <div className="px-4 md:px-6 md:max-w-3xl md:mx-auto pb-8 pt-4">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            {t('common.close', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
