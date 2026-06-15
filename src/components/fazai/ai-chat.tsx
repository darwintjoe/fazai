'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { t } from '@/lib/i18n';
import { db, type Account } from '@/lib/fazai-db';
import { createIncomeTransaction, createExpenseTransaction, deleteTransaction, getDashboardSummary } from '@/lib/ledger-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle, X, Send, Bot, User, Check, ArrowDownLeft, ArrowUpRight, Trash2, TrendingUp, BarChart3, BookOpen, AlertTriangle } from 'lucide-react';
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

interface DeleteAction {
  transactionId: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  transaction?: PendingTransaction | null;
  deleteAction?: DeleteAction | null;
  confirmed?: boolean;
  deleted?: boolean;
  fallback?: boolean;
}

function formatAmount(n: number): string {
  return n.toLocaleString('id-ID');
}

interface AiChatProps {
  /** "button" = small header button, undefined = standalone */
  mode?: 'button';
}

export function AiChat({ mode }: AiChatProps) {
  const { lang, userId } = useAuthStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track client-side mount for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      db.accounts.filter(a => a.isActive).toArray().then(setAccounts);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  /** Fetch financial context from the database to send to the AI */
  const fetchFinancialContext = useCallback(async (): Promise<string> => {
    try {
      const [allAccounts, recentTx, summaries, dashboardData] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.orderBy('date').reverse().limit(20).toArray(),
        db.accountMonthlySummaries.toArray(),
        getDashboardSummary(),
      ]);

      const res = await fetch('/api/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: allAccounts.map(a => ({
            id: a.id, code: a.code, name: a.name,
            nameId: a.nameId, nameZh: a.nameZh,
            type: a.type, isActive: a.isActive,
          })),
          recentTransactions: recentTx.map(tx => ({
            id: tx.id, date: tx.date, description: tx.description,
            counterparty: tx.counterparty, type: tx.type,
            entries: tx.entries,
          })),
          monthlySummaries: summaries.map(s => ({
            accountId: s.accountId, year: s.year, month: s.month,
            totalDebit: s.totalDebit, totalCredit: s.totalCredit,
          })),
          currentBalance: dashboardData.totalBalance,
          todayIncome: dashboardData.todayIncome,
          todayExpense: dashboardData.todayExpense,
          lang,
        }),
      });

      const data = await res.json();
      return data.context || '';
    } catch (e) {
      console.error('Failed to fetch financial context:', e);
      return '';
    }
  }, [lang]);

  const getAccountDisplayName = useCallback((accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return accountId;
    if (lang === 'id' && acc.nameId) return acc.nameId;
    if (lang === 'zh' && acc.nameZh) return acc.nameZh;
    return acc.name;
  }, [accounts, lang]);

  /** Get accounts filtered by type for the dropdown */
  const getAccountsByType = useCallback((type: 'income' | 'expense') => {
    return accounts.filter(a => a.type === type && a.parentId);
  }, [accounts]);

  /** Get cash/bank accounts for the opponent account dropdown */
  const getCashBankAccounts = useCallback(() => {
    return accounts.filter(a => (a.type === 'cashBank' || a.type === 'asset') && a.parentId && a.isActive);
  }, [accounts]);

  /** Handle account change in the transaction card */
  const handleAccountChange = useCallback((msgIndex: number, newAccountId: string) => {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex || !m.transaction) return m;
      return {
        ...m,
        transaction: {
          ...m.transaction,
          accountId: newAccountId,
        },
      };
    }));
  }, []);

  /** Handle opponent account change in the transaction card */
  const handleOpponentAccountChange = useCallback((msgIndex: number, newAccountId: string) => {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex || !m.transaction) return m;
      return {
        ...m,
        transaction: {
          ...m.transaction,
          opponentAccountId: newAccountId,
        },
      };
    }));
  }, []);

  const handleConfirmTransaction = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.transaction) return;

    setConfirming(`tx-${msgIndex}`);
    try {
      const tx = msg.transaction;
      const currentUserId = userId || 'admin-1';
      const today = new Date();

      if (tx.type === 'income') {
        await createIncomeTransaction({
          amount: tx.amount,
          counterparty: tx.counterparty,
          incomeAccountId: tx.accountId,
          opponentAccountId: tx.opponentAccountId,
          description: tx.description,
          date: today,
          userId: currentUserId,
        });
      } else {
        await createExpenseTransaction({
          amount: tx.amount,
          counterparty: tx.counterparty,
          expenseAccountId: tx.accountId,
          opponentAccountId: tx.opponentAccountId,
          description: tx.description,
          date: today,
          userId: currentUserId,
        });
      }

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, confirmed: true } : m
      ));

      // Notify dashboard & other components to refresh
      useAppStore.getState().bumpTxVersion();

      const successMsg = lang === 'id'
        ? '✓ Transaksi berhasil dicatat!'
        : lang === 'zh'
        ? '✓ 交易已成功记录！'
        : '✓ Transaction recorded successfully!';

      toast({ title: successMsg, description: `${tx.type === 'income' ? '+' : '-'} ${formatAmount(tx.amount)} — ${tx.description}` });
    } catch (_err) {
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

  const handleConfirmDelete = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.deleteAction) return;

    setConfirming(`del-${msgIndex}`);
    try {
      await deleteTransaction(msg.deleteAction.transactionId);

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, deleted: true } : m
      ));

      // Notify dashboard & other components to refresh
      useAppStore.getState().bumpTxVersion();

      const successMsg = lang === 'id'
        ? '✓ Transaksi berhasil dihapus!'
        : lang === 'zh'
        ? '✓ 交易已成功删除！'
        : '✓ Transaction deleted successfully!';

      toast({ title: successMsg });
    } catch (_err) {
      const errorMsg = lang === 'id'
        ? 'Gagal menghapus transaksi.'
        : lang === 'zh'
        ? '删除交易失败。'
        : 'Failed to delete transaction.';
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
      // Fetch fresh financial context with each message
      const financialContext = await fetchFinancialContext();

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
          financialContext,
        }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that.',
        transaction: data.transaction || null,
        deleteAction: data.deleteAction || null,
        fallback: data.fallback || false,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong.',
        transaction: null,
        deleteAction: null,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const closePanel = useCallback(() => setIsOpen(false), []);

  /** Render assistant message with simple markdown-like formatting */
  const renderAssistantContent = (content: string) => {
    // Split by newlines and render
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Bold text **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return <span key={j}>{part}</span>;
      });

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ')) {
        return (
          <div key={i} className="flex gap-1.5 ml-1">
            <span className="text-red-400 shrink-0">•</span>
            <span>{rendered}</span>
          </div>
        );
      }

      // Numbered items (1. 2. etc.)
      if (/^\d+[\.\)]\s/.test(line.trim())) {
        return (
          <div key={i} className="ml-1">
            {rendered}
          </div>
        );
      }

      // Empty line = paragraph break
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }

      return <div key={i}>{rendered}</div>;
    });
  };

  /** Render the ledger entry section showing debit/credit */
  const renderLedgerEntry = (tx: PendingTransaction) => {
    const debitAccount = tx.type === 'expense'
      ? getAccountDisplayName(tx.accountId)       // Expense account debited
      : getAccountDisplayName(tx.opponentAccountId); // Cash/Bank debited
    const creditAccount = tx.type === 'income'
      ? getAccountDisplayName(tx.accountId)        // Income account credited
      : getAccountDisplayName(tx.opponentAccountId); // Cash/Bank credited

    return (
      <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-1 mb-1.5">
          <BookOpen className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            {t('ai.ledger', lang)}
          </span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-foreground">{debitAccount}</span>
            <span className="text-green-600 dark:text-green-400 font-semibold">{formatAmount(tx.amount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground pl-3">{creditAccount}</span>
            <span className="text-red-600 dark:text-red-400 font-semibold">{formatAmount(tx.amount)}</span>
          </div>
        </div>
      </div>
    );
  };

  const panelContent = (
    <>
      {/* Semi-transparent backdrop — click to close */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closePanel}
            className="fixed inset-0 z-40 bg-black/20"
          />
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ai-chat-panel"
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-16 right-2 sm:right-4 z-50 w-[calc(100%-16px)] sm:w-96 max-h-[75vh] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold text-sm">{t('ai.title', lang)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">
                  {lang === 'id' ? 'Cerdas' : lang === 'zh' ? '智能' : 'Smart'}
                </span>
              </div>
              <button onClick={closePanel} className="p-1 hover:bg-white/20 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-6">
                  <div className="flex justify-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                  <p className="font-semibold text-foreground mb-2">
                    {lang === 'id' ? 'Asisten Keuangan Cerdas' : lang === 'zh' ? '智能财务助手' : 'Smart Financial Assistant'}
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <p>
                      {lang === 'id'
                        ? '📊 "Berapa total pengeluaran bulan ini?"'
                        : lang === 'zh'
                        ? '📊 "这个月总共花了多少？"'
                        : '📊 "How much did I spend this month?"'}
                    </p>
                    <p>
                      {lang === 'id'
                        ? '💰 "Berapa saldo saya sekarang?"'
                        : lang === 'zh'
                        ? '💰 "我现在余额多少？"'
                        : '💰 "What\'s my balance?"'}
                    </p>
                    <p>
                      {lang === 'id'
                        ? '📈 "Bandingkan dengan bulan lalu"'
                        : lang === 'zh'
                        ? '📈 "跟上月对比"'
                        : '📈 "Compare with last month"'}
                    </p>
                    <p>
                      {lang === 'id'
                        ? '🗑️ "Hapus transaksi terakhir"'
                        : lang === 'zh'
                        ? '🗑️ "删除最后一笔交易"'
                        : '🗑️ "Delete my last transaction"'}
                    </p>
                    <p>
                      {lang === 'id'
                        ? '💡 "Beli makan 5000"'
                        : lang === 'zh'
                        ? '💡 "买饭50"'
                        : '💡 "lunch 25k"'}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-red-600 dark:text-red-400" />
                      </div>
                    )}
                    <div className="max-w-[85%]">
                      <div className={`px-3 py-2 rounded-xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-red-600 text-white'
                          : 'bg-muted'
                      }`}>
                        {msg.role === 'user' ? msg.content : renderAssistantContent(msg.content)}
                      </div>

                      {/* Transaction confirmation card */}
                      {msg.role === 'assistant' && msg.transaction && (
                        <Card className={`mt-2 p-3 border-2 ${
                          msg.confirmed
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
                            : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                            {msg.fallback && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-[10px] font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                {t('ai.keywordFallback', lang)}
                              </div>
                            )}
                            {msg.confirmed && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                                <Check className="w-3 h-3" />
                                {lang === 'id' ? 'Tercatat' : lang === 'zh' ? '已记录' : 'Recorded'}
                              </div>
                            )}
                          </div>

                          {/* Keyword fallback warning */}
                          {msg.fallback && !msg.confirmed && (
                            <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {t('ai.verifyAccount', lang)}
                            </p>
                          )}

                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground text-xs">
                                {lang === 'id' ? 'Jumlah' : lang === 'zh' ? '金额' : 'Amount'}
                              </span>
                              <span className={`font-bold ${msg.transaction.type === 'income' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                {msg.transaction.type === 'income' ? '+' : '-'} {formatAmount(msg.transaction.amount)}
                              </span>
                            </div>

                            {/* Account — editable dropdown before confirmation */}
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-muted-foreground text-xs shrink-0">
                                {lang === 'id' ? 'Akun' : lang === 'zh' ? '账户' : 'Account'}
                              </span>
                              {msg.confirmed ? (
                                <span className="font-medium text-xs">{getAccountDisplayName(msg.transaction.accountId)}</span>
                              ) : (
                                <Select
                                  value={msg.transaction.accountId}
                                  onValueChange={(value) => handleAccountChange(idx, value)}
                                >
                                  <SelectTrigger className="h-7 text-xs border-amber-300 dark:border-amber-700 bg-white dark:bg-card w-auto min-w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAccountsByType(msg.transaction.type).map(acc => (
                                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                        {getAccountDisplayName(acc.id)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {/* Opponent Account (Cash/Bank) — editable dropdown before confirmation */}
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-muted-foreground text-xs shrink-0">
                                {t('form.opponentAccount', lang)}
                              </span>
                              {msg.confirmed ? (
                                <span className="font-medium text-xs">{getAccountDisplayName(msg.transaction.opponentAccountId)}</span>
                              ) : (
                                <Select
                                  value={msg.transaction.opponentAccountId}
                                  onValueChange={(value) => handleOpponentAccountChange(idx, value)}
                                >
                                  <SelectTrigger className="h-7 text-xs border-amber-300 dark:border-amber-700 bg-white dark:bg-card w-auto min-w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getCashBankAccounts().map(acc => (
                                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                        {getAccountDisplayName(acc.id)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
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

                          {/* Ledger Entry (debit/credit view) */}
                          {renderLedgerEntry(msg.transaction)}

                          {!msg.confirmed && (
                            <Button
                              size="sm"
                              className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white h-8 text-xs"
                              onClick={() => handleConfirmTransaction(idx)}
                              disabled={confirming === `tx-${idx}`}
                            >
                              {confirming === `tx-${idx}` ? (
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

                      {/* Delete confirmation card */}
                      {msg.role === 'assistant' && msg.deleteAction && (
                        <Card className={`mt-2 p-3 border-2 ${
                          msg.deleted
                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
                            : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Trash2 className="w-4 h-4 text-red-500" />
                            <span className="text-xs font-semibold">
                              {msg.deleted
                                ? (lang === 'id' ? 'Transaksi Dihapus' : lang === 'zh' ? '交易已删除' : 'Transaction Deleted')
                                : (lang === 'id' ? 'Konfirmasi Hapus' : lang === 'zh' ? '确认删除' : 'Confirm Deletion')
                              }
                            </span>
                            {msg.deleted && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold">
                                <Check className="w-3 h-3" />
                                {lang === 'id' ? 'Selesai' : lang === 'zh' ? '完成' : 'Done'}
                              </div>
                            )}
                          </div>

                          {!msg.deleted && (
                            <p className="text-xs text-muted-foreground mb-2">
                              {lang === 'id'
                                ? 'Transaksi ini akan dihapus secara permanen.'
                                : lang === 'zh'
                                ? '此交易将被永久删除。'
                                : 'This transaction will be permanently deleted.'}
                            </p>
                          )}

                          {!msg.deleted && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full h-8 text-xs"
                              onClick={() => handleConfirmDelete(idx)}
                              disabled={confirming === `del-${idx}`}
                            >
                              {confirming === `del-${idx}` ? (
                                <span className="flex items-center gap-1">
                                  <span className="animate-spin">⏳</span>
                                  {lang === 'id' ? 'Menghapus...' : lang === 'zh' ? '删除中...' : 'Deleting...'}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {lang === 'id' ? 'Ya, Hapus' : lang === 'zh' ? '确认删除' : 'Yes, Delete'}
                                </span>
                              )}
                            </Button>
                          )}
                        </Card>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0 mt-0.5">
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
                    <div className="bg-muted px-3 py-2 rounded-xl text-sm text-muted-foreground flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      {t('ai.thinking', lang)}
                    </div>
                  </div>
                )}
              </div>
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t shrink-0">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    lang === 'id' ? 'Ketik: "berapa saldo saya?" atau "beli makan 5000"...'
                    : lang === 'zh' ? '输入："我余额多少？" 或 "买饭50"...'
                    : 'Type: "what\'s my balance?" or "lunch 25k"...'
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
        )}
      </AnimatePresence>
    </>
  );

  return (
    <>
      {/* Header button trigger — always visible, toggles panel */}
      {mode === 'button' && (
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isOpen
              ? 'text-red-600'
              : 'text-muted-foreground hover:text-red-600'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('ai.title', lang)}</span>
        </button>
      )}

      {/* Portal the panel into document.body to escape the header's backdrop-blur containing block */}
      {mounted && createPortal(panelContent, document.body)}
    </>
  );
}
