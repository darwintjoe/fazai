'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { createIncomeTransaction, createExpenseTransaction } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Bot, User, Check, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface PendingTransaction {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  accountId: string;
  counterparty: string;
  opponentAccountId: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  transaction?: PendingTransaction | null;
  confirmed?: boolean;
}

function formatAmount(n: number): string {
  return n.toLocaleString('id-ID');
}

interface AiChatProps {
  /** "button" = small header button, undefined = standalone (no trigger, panel controlled externally) */
  mode?: 'button';
}

export function AiChat({ mode }: AiChatProps) {
  const { lang, user } = useAuthStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      db.accounts.filter(a => a.isActive).toArray().then(setAccounts);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    // Delay to avoid the opening click immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isOpen]);

  const getAccountDisplayName = useCallback((accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return accountId;
    if (lang === 'id' && acc.nameId) return acc.nameId;
    if (lang === 'zh' && acc.nameZh) return acc.nameZh;
    return acc.name;
  }, [accounts, lang]);

  const handleConfirmTransaction = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.transaction) return;

    setConfirming(String(msgIndex));
    try {
      const tx = msg.transaction;
      const userId = user?.id || 'admin-1';
      const today = new Date();

      if (tx.type === 'income') {
        await createIncomeTransaction({
          amount: tx.amount,
          counterparty: tx.counterparty,
          incomeAccountId: tx.accountId,
          opponentAccountId: tx.opponentAccountId,
          description: tx.description,
          date: today,
          userId,
        });
      } else {
        await createExpenseTransaction({
          amount: tx.amount,
          counterparty: tx.counterparty,
          expenseAccountId: tx.accountId,
          opponentAccountId: tx.opponentAccountId,
          description: tx.description,
          date: today,
          userId,
        });
      }

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, confirmed: true } : m
      ));

      const successMsg = lang === 'id'
        ? '✓ Transaksi berhasil dicatat!'
        : lang === 'zh'
        ? '✓ 交易已成功记录！'
        : '✓ Transaction recorded successfully!';

      toast({ title: successMsg, description: `${tx.type === 'income' ? '+' : '-'} ${formatAmount(tx.amount)} — ${tx.description}` });
    } catch (err) {
      const errorMsg = lang === 'id'
        ? 'Gagal mencatat transaksi. Silakan coba lagi.'
        : lang === 'zh'
        ? '记录交易失败，请重试。'
        : 'Failed to record transaction. Please try again.';
      toast({ title: errorMsg, variant: 'destructive' });
    } finally {
      setConfirming(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const accountsPayload = accounts.map(a => ({
        id: a.id,
        name: a.name,
        nameId: a.nameId,
        nameZh: a.nameZh,
        type: a.type,
        code: a.code,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          lang,
          accounts: accountsPayload,
        }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that.',
        transaction: data.transaction || null,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong.',
        transaction: null,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header button trigger (for top bar) */}
      {mode === 'button' && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('ai.title', lang)}</span>
        </button>
      )}

      {/* Chat Panel with backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Semi-transparent backdrop - click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setIsOpen(false)}
            />
            {/* Panel */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-16 right-2 sm:right-4 z-50 w-[calc(100%-16px)] sm:w-96 max-h-[70vh] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  <span className="font-semibold text-sm">{t('ai.title', lang)}</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4 min-h-[200px] max-h-[50vh]">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <p className="mb-2">💡</p>
                    <p className="font-medium">
                      {lang === 'id' ? 'Ketik transaksi dengan bahasa sehari-hari!' : lang === 'zh' ? '用日常语言记录交易！' : 'Record transactions in everyday language!'}
                    </p>
                    <p className="text-xs mt-2">
                      {lang === 'id'
                        ? 'Contoh: "beli makan 5000", "terima gaji 1 juta"'
                        : lang === 'zh'
                        ? '例如："买饭50"、"收到工资1万"'
                        : 'e.g., "lunch 25k", "got salary 5000"'
                      }
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                          <Bot className="w-3 h-3 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div className="max-w-[85%]">
                        <div className={`px-3 py-2 rounded-xl text-sm ${
                          msg.role === 'user'
                            ? 'bg-red-600 text-white'
                            : 'bg-muted'
                        }`}>
                          {msg.content}
                        </div>

                        {/* Transaction confirmation card */}
                        {msg.role === 'assistant' && msg.transaction && (
                          <Card className={`mt-2 p-3 border-2 ${
                            msg.confirmed
                              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
                              : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              {msg.transaction.type === 'income' ? (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold">
                                  <ArrowDownLeft className="w-3 h-3" />
                                  {lang === 'id' ? 'Pendapatan' : lang === 'zh' ? '收入' : 'Income'}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold">
                                  <ArrowUpRight className="w-3 h-3" />
                                  {lang === 'id' ? 'Pengeluaran' : lang === 'zh' ? '支出' : 'Expense'}
                                </div>
                              )}
                              {msg.confirmed && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                                  <Check className="w-3 h-3" />
                                  {lang === 'id' ? 'Tercatat' : lang === 'zh' ? '已记录' : 'Recorded'}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-xs">
                                  {lang === 'id' ? 'Jumlah' : lang === 'zh' ? '金额' : 'Amount'}
                                </span>
                                <span className={`font-bold ${msg.transaction.type === 'income' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {msg.transaction.type === 'income' ? '+' : '-'} {formatAmount(msg.transaction.amount)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-xs">
                                  {lang === 'id' ? 'Akun' : lang === 'zh' ? '账户' : 'Account'}
                                </span>
                                <span className="font-medium text-xs">{getAccountDisplayName(msg.transaction.accountId)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-xs">
                                  {lang === 'id' ? 'Keterangan' : lang === 'zh' ? '描述' : 'Description'}
                                </span>
                                <span className="text-xs">{msg.transaction.description}</span>
                              </div>
                              {msg.transaction.counterparty && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground text-xs">
                                    {lang === 'id' ? 'Pihak' : lang === 'zh' ? '对方' : 'Counterparty'}
                                  </span>
                                  <span className="text-xs">{msg.transaction.counterparty}</span>
                                </div>
                              )}
                            </div>

                            {!msg.confirmed && (
                              <Button
                                size="sm"
                                className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white h-8 text-xs"
                                onClick={() => handleConfirmTransaction(idx)}
                                disabled={confirming === String(idx)}
                              >
                                {confirming === String(idx) ? (
                                  <span className="flex items-center gap-1">
                                    <span className="animate-spin">⏳</span>
                                    {lang === 'id' ? 'Menyimpan...' : lang === 'zh' ? '保存中...' : 'Saving...'}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    {lang === 'id' ? 'Konfirmasi & Catat' : lang === 'zh' ? '确认并记录' : 'Confirm & Record'}
                                  </span>
                                )}
                              </Button>
                            )}
                          </Card>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                        <Bot className="w-3 h-3 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="bg-muted px-3 py-2 rounded-xl text-sm text-muted-foreground">
                        {t('ai.thinking', lang)}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      lang === 'id' ? 'Ketik: "beli makan 5000"...'
                      : lang === 'zh' ? '输入："买饭50"...'
                      : 'Type: "lunch 25k"...'
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="text-sm"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    size="icon"
                    className="bg-red-600 hover:bg-red-700 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
