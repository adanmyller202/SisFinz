/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  IncomeItem,
  ExpenseItem,
  ChallengeGoal,
  MonthlyStatusRecord,
} from '../types';
import { askMone, MoneContext, MoneResponse, MoneActionItem } from '../utils/moneEngine';
import { getTranslations } from '../utils/i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
import {
  Send,
  X,
  Bot,
  User,
  Loader2,
  Trash2,
  WifiOff,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'mone';
  text: string;
  timestamp: string;
}

interface MoneChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[];
  goals: ChallengeGoal[];
  currency: CurrencyCode;
  language?: LanguageCode;
  onAddExpense?: (expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateExpense?: (expenseId: string, partial: Partial<ExpenseItem>) => Promise<any> | void;
  onDeleteExpense?: (expenseId: string) => Promise<any> | void;
  onAddBill?: (billData: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateBill?: (billId: string, partial: Partial<BillItem>) => Promise<any> | void;
  onDeleteBill?: (billId: string) => Promise<any> | void;
  onToggleBillPaid?: (billId: string, month: string, isPaid: boolean) => Promise<any> | void;
  onAddIncome?: (incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateIncome?: (incomeId: string, partial: Partial<IncomeItem>) => Promise<any> | void;
  onDeleteIncome?: (incomeId: string) => Promise<any> | void;
  onToggleIncomeReceived?: (incomeId: string, month: string, isReceived: boolean) => Promise<any> | void;
  onUpdateCurrentBalance?: (newBalance: number) => Promise<any> | void;
  onCreateGoal?: (goalData: {
    title: string;
    icon: string;
    targetAmount: number;
    initialValue: number;
    currency: CurrencyCode;
    notes?: string;
  }) => Promise<any> | void;
}

export const MoneChatModal: React.FC<MoneChatModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  bills,
  incomes,
  expenses,
  statusRecords,
  goals,
  currency,
  language = 'pt',
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onToggleBillPaid,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onToggleIncomeReceived,
  onUpdateCurrentBalance,
  onCreateGoal,
}) => {
  const t = getTranslations(language);
  const { isOnline } = useSyncStatus();

  const initialGreeting = React.useMemo(() => {
    if (language === 'pt') {
      return 'Como posso ajudar com suas finanças hoje?';
    } else if (language === 'es') {
      return '¿Cómo puedo ayudarte con tus finanzas hoy?';
    } else {
      return 'How can I help with your finances today?';
    }
  }, [language]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'mone',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [lastActionItem, setLastActionItem] = useState<MoneActionItem | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const moneContext: MoneContext = {
    currentBalance,
    bills,
    incomes,
    expenses,
    statusRecords,
    goals,
    currency,
    language,
    lastActionItem,
    handlers: {
      onAddExpense,
      onUpdateExpense,
      onDeleteExpense,
      onAddBill,
      onUpdateBill,
      onDeleteBill,
      onToggleBillPaid,
      onAddIncome,
      onUpdateIncome,
      onDeleteIncome,
      onToggleIncomeReceived,
      onUpdateCurrentBalance,
      onCreateGoal,
    },
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if (!isOnline) {
      const offlineMsg: ChatMessage = {
        id: 'msg_offline_' + Date.now(),
        sender: 'mone',
        text:
          language === 'pt'
            ? 'O assistente inteligente Mone precisa de conexão com a internet para gerar respostas com inteligência artificial. Suas faturas, despesas, receitas, metas e transferências continuam funcionando normalmente offline e serão sincronizadas assim que a internet voltar.'
            : language === 'es'
            ? 'El asistente inteligente Mone requiere conexión a internet para generar respuestas con IA. Tus facturas, gastos, ingresos, metas y transferencias siguen funcionando con normalidad sin conexión y se sincronizarán al reconectar.'
            : 'The Mone AI assistant requires an internet connection. Your bills, expenses, incomes, goals, and transfers continue working offline normally and will sync when reconnected.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTimeout(() => {
        setMessages((prev) => [...prev, offlineMsg]);
        setIsLoading(false);
      }, 300);
      return;
    }

    try {
      const historyItems = [...messages, userMsg].map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const response: MoneResponse = await askMone(query, {
        ...moneContext,
        history: historyItems,
        lastActionItem,
      });

      if (response.createdItem) {
        setLastActionItem(response.createdItem);
      }

      const moneMsg: ChatMessage = {
        id: 'msg_mone_' + Date.now(),
        sender: 'mone',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, moneMsg]);
    } catch (err) {
      console.error('Error asking Mone:', err);
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'mone',
        text:
          language === 'pt'
            ? 'Não foi possível concluir a ação. Por favor, tente novamente.'
            : language === 'es'
            ? 'No fue posible completar la acción. Intenta de nuevo.'
            : 'Could not complete the action. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        sender: 'mone',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLastActionItem(null);
  };

  const quickSuggestions = [
    'Gastei 2500 de Uber agora',
    'Recebi 50 mil de salário',
    'Paguei a academia',
    'Comprei um tênis de 200 mil em 5 vezes',
    'Quanto gastei com transporte este mês?',
    'Tenho algo para pagar em novembro?',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full h-[calc(100dvh-1.5rem)] sm:h-[620px] max-h-[calc(100dvh-1.5rem)] sm:max-h-[620px] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header (pinned) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Mone</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 ${
                      isOnline
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    }`}
                  >
                    {!isOnline && <WifiOff className="w-2.5 h-2.5" />}
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                  </span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'pt'
                  ? 'Assistente Financeiro Inteligente'
                  : language === 'es'
                  ? 'Asistente Financiero Inteligente'
                  : 'Smart Financial Assistant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={language === 'pt' ? 'Limpar conversa' : language === 'es' ? 'Limpiar chat' : 'Clear chat'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={t.closeBtn}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {messages.map((msg) => {
            const isMone = msg.sender === 'mone';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[90%] sm:max-w-[85%] ${
                  isMone ? 'self-start' : 'self-end ml-auto flex-row-reverse'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isMone
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isMone ? <Bot className="w-4 h-4" /> : <User className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`rounded-2xl p-3 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                    isMone
                      ? 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100'
                      : 'bg-emerald-600 text-white font-medium'
                  }`}
                >
                  <div className="space-y-1.5 whitespace-pre-wrap">
                    {msg.text.split('\n\n').map((para, i) => (
                      <p key={i}>
                        {para.split('\n').map((line, j) => {
                          const parts = line.split(/(\*\*.*?\*\*)/g);
                          return (
                            <span key={j} className="block">
                              {parts.map((p, k) => {
                                if (p.startsWith('**') && p.endsWith('**')) {
                                  return (
                                    <strong key={k} className="font-extrabold text-slate-900 dark:text-white">
                                      {p.slice(2, -2)}
                                    </strong>
                                  );
                                }
                                return p;
                              })}
                            </span>
                          );
                        })}
                      </p>
                    ))}
                  </div>

                  <span
                    className={`block text-[9px] mt-1.5 text-right font-medium ${
                      isMone ? 'text-slate-400' : 'text-emerald-200'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 max-w-[85%] self-start animate-pulse">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center gap-2 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>
                  {language === 'pt'
                    ? 'Mone está processando...'
                    : language === 'es'
                    ? 'Mone está procesando...'
                    : 'Mone is processing...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
          {quickSuggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(sug)}
              disabled={isLoading}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              language === 'pt'
                ? 'Converse com Mone (ex: Gastei 2500 de Uber, Recebi 50 mil)...'
                : language === 'es'
                ? 'Habla con Mone (ej: Gasté 2500 en Uber, Recibí 50 mil)...'
                : 'Chat with Mone (e.g. Spent 2500 on Uber, Received 50k)...'
            }
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-2 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">
              {language === 'pt' ? 'Enviar' : language === 'es' ? 'Enviar' : 'Send'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
