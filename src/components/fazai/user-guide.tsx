'use client';

import React from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t, type TranslationKeys } from '@/lib/i18n';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { ArrowLeft, BookOpen, Lightbulb, BarChart3, Users, Shield, Database, Bot, Wallet, LayoutDashboard, Rocket, ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface GuideSection {
  id: string;
  titleKey: keyof TranslationKeys;
  descKey: keyof TranslationKeys;
  icon: React.ElementType;
  subSections?: { titleKey: keyof TranslationKeys; descKey?: keyof TranslationKeys }[];
}

const guideSections: GuideSection[] = [
  {
    id: 'getting-started',
    titleKey: 'guide.gettingStarted',
    descKey: 'guide.defaultPin',
    icon: Rocket,
  },
  {
    id: 'overview',
    titleKey: 'guide.overview',
    descKey: 'guide.overview.desc',
    icon: BookOpen,
  },
  {
    id: 'login',
    titleKey: 'guide.login',
    descKey: 'guide.login.desc',
    icon: Shield,
  },
  {
    id: 'dashboard',
    titleKey: 'guide.dashboard',
    descKey: 'guide.dashboard.desc',
    icon: LayoutDashboard,
  },
  {
    id: 'income-expense',
    titleKey: 'guide.incomeExpense',
    descKey: 'guide.incomeExpense.desc',
    icon: Wallet,
  },
  {
    id: 'accounts',
    titleKey: 'guide.accounts',
    descKey: 'guide.accounts.desc',
    icon: Database,
  },
  {
    id: 'reports',
    titleKey: 'guide.reports',
    descKey: 'guide.reports.desc',
    icon: BarChart3,
    subSections: [
      { titleKey: 'guide.reports.bs' },
      { titleKey: 'guide.reports.tb' },
      { titleKey: 'guide.reports.pl' },
      { titleKey: 'guide.reports.cf' },
      { titleKey: 'guide.reports.ledger' },
    ],
  },
  {
    id: 'admin',
    titleKey: 'guide.admin',
    descKey: 'guide.admin.desc',
    icon: Users,
  },
  {
    id: 'backup',
    titleKey: 'guide.backup',
    descKey: 'guide.backup.desc',
    icon: Database,
    subSections: [
      { titleKey: 'guide.factoryReset', descKey: 'guide.factoryResetDesc' },
    ],
  },
  {
    id: 'ai',
    titleKey: 'guide.ai',
    descKey: 'guide.ai.desc',
    icon: Bot,
  },
  {
    id: 'migration',
    titleKey: 'guide.migration',
    descKey: 'guide.migration.desc',
    icon: ArrowRightLeft,
  },
  {
    id: 'tips',
    titleKey: 'guide.tips',
    descKey: 'guide.tips.desc',
    icon: Lightbulb,
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
    : 'flex flex-col gap-4 pb-20';

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
      <div className={overlay ? 'px-4' : ''}>
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
                      {section.subSections && section.subSections.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {section.subSections.map((sub, subIndex) => (
                            <Card key={subIndex} className="p-3 bg-muted/50">
                              <p className="text-sm font-medium text-foreground mb-1">
                                {t(sub.titleKey, lang)}
                              </p>
                              {sub.descKey && (
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {t(sub.descKey, lang)}
                                </p>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
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
        <div className="px-4 pb-8 pt-4">
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
