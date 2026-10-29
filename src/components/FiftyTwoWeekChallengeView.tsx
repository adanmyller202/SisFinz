/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FiftyTwoWeekChallenge, CurrencyCode, LanguageCode, ExpenseItem } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Target,
  PiggyBank,
  Check,
  RotateCcw,
  Trash2,
  ChevronRight,
  AlertCircle,
  Award,
  Wallet,
  Loader2,
} from 'lucide-react';

interface FiftyTwoWeekChallengeViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  activeChallenge: FiftyTwoWeekChallenge | null;
  challenges: FiftyTwoWeekChallenge[];
  onSelectChallenge: (id: string) => void;
  onCreateChallenge: (params: { initialAmount: number; startDate: string; title?: string }) => Promise<any>;
  onCompleteWeek: (
    challengeId: string,
    weekNumber: number,
    addExpenseFn: (exp: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>
  ) => Promise<void>;
  onUndoWeek: (
    challengeId: string,
    weekNumber: number,
    deleteExpenseFn: (expenseId: string) => Promise<void>
  ) => Promise<void>;
  onDeleteChallenge: (challengeId: string) => Promise<void>;
  onAddExpense: (exp: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onReturnToFinance: () => void;
}

export const FiftyTwoWeekChallengeView: React.FC<FiftyTwoWeekChallengeViewProps> = ({
  currency,
  language = 'pt',
  activeChallenge,
  challenges,
  onSelectChallenge,
  onCreateChallenge,
  onCompleteWeek,
  onUndoWeek,
  onDeleteChallenge,
  onAddExpense,
  onDeleteExpense,
  onReturnToFinance,
}) => {
  const t = getTranslations(language);

  // Form creation mode vs Challenge Dashboard mode
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Challenge creation form state
  const [initialAmountStr, setInitialAmountStr] = useState<string>('1000');
  const [startDateInput, setStartDateInput] = useState<string>(new Date().toISOString().slice(0, 10));
  const [titleInput, setTitleInput] = useState<string>('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Modals state
  const [weekToConfirm, setWeekToConfirm] = useState<number | null>(null);
  const [weekToUndo, setWeekToUndo] = useState<number | null>(null);
  const [isSubmittingWeek, setIsSubmittingWeek] = useState<boolean>(false);

  // Week list filter: 'all' | 'pending' | 'completed'
  const [weekFilter, setWeekFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const parsedInitialAmount = useMemo(() => {
    return parseFloat(initialAmountStr.replace(',', '.')) || 0;
  }, [initialAmountStr]);

  // Calculated values for creation form
  const creationTotalTarget = useMemo(() => {
    return Math.round(parsedInitialAmount * 1378);
  }, [parsedInitialAmount]);

  // Handle Challenge Creation
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedInitialAmount <= 0) return;
    try {
      setIsSubmittingCreate(true);
      await onCreateChallenge({
        initialAmount: parsedInitialAmount,
        startDate: startDateInput,
        title: titleInput.trim() || undefined,
      });
      setIsCreatingNew(false);
    } catch (err) {
      console.error('Error creating 52-week challenge:', err);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Derived metrics for active challenge
  const metrics = useMemo(() => {
    if (!activeChallenge) return null;

    const completedWeeksSet = new Set(activeChallenge.completedWeeks);
    let totalSaved = 0;
    for (const w of activeChallenge.completedWeeks) {
      totalSaved += activeChallenge.initialAmount * w;
    }

    const remainingAmount = Math.max(0, activeChallenge.totalTarget - totalSaved);
    const progressPercent =
      activeChallenge.totalTarget > 0
        ? Math.min(100, (totalSaved / activeChallenge.totalTarget) * 100)
        : 0;

    // Calculate current week based on start date
    const startMs = new Date(activeChallenge.startDate).getTime();
    const todayMs = new Date().getTime();
    const diffDays = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
    const currentCalculatedWeek = Math.max(1, Math.min(52, Math.floor(diffDays / 7) + 1));

    // Next uncompleted week number
    let nextUncompletedWeek = 1;
    for (let w = 1; w <= 52; w++) {
      if (!completedWeeksSet.has(w)) {
        nextUncompletedWeek = w;
        break;
      }
    }

    const nextWeekAmount = activeChallenge.initialAmount * nextUncompletedWeek;

    return {
      completedWeeksSet,
      completedCount: activeChallenge.completedWeeks.length,
      totalSaved,
      remainingAmount,
      progressPercent,
      currentCalculatedWeek,
      nextUncompletedWeek,
      nextWeekAmount,
    };
  }, [activeChallenge]);

  // List of all 52 weeks with calculated dates and amounts
  const allWeeksList = useMemo(() => {
    if (!activeChallenge) return [];

    const list = [];
    const startDateObj = new Date(activeChallenge.startDate);

    for (let w = 1; w <= 52; w++) {
      const weekAmount = Math.round(activeChallenge.initialAmount * w);
      const weekDateObj = new Date(startDateObj);
      weekDateObj.setDate(weekDateObj.getDate() + (w - 1) * 7);
      const weekDateStr = weekDateObj.toISOString().slice(0, 10);

      // Format date for display
      const formattedDate = weekDateObj.toLocaleDateString(
        language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'pt-BR',
        { day: '2-digit', month: '2-digit', year: 'numeric' }
      );

      const isCompleted = activeChallenge.completedWeeks.includes(w);
      const isCurrentWeek = metrics?.currentCalculatedWeek === w;

      list.push({
        weekNumber: w,
        amount: weekAmount,
        dateStr: weekDateStr,
        formattedDate,
        isCompleted,
        isCurrentWeek,
      });
    }

    return list;
  }, [activeChallenge, language, metrics]);

  // Filtered weeks
  const filteredWeeks = useMemo(() => {
    return allWeeksList.filter((w) => {
      if (weekFilter === 'completed') return w.isCompleted;
      if (weekFilter === 'pending') return !w.isCompleted;
      return true;
    });
  }, [allWeeksList, weekFilter]);

  // Handle Confirm Week Completion
  const handleConfirmWeekSubmit = async () => {
    if (!activeChallenge || weekToConfirm === null) return;
    try {
      setIsSubmittingWeek(true);
      await onCompleteWeek(activeChallenge.id, weekToConfirm, onAddExpense);
      setWeekToConfirm(null);
    } catch (err) {
      console.error('Error confirming week:', err);
    } finally {
      setIsSubmittingWeek(false);
    }
  };

  // Handle Undo Week Completion
  const handleUndoWeekSubmit = async () => {
    if (!activeChallenge || weekToUndo === null) return;
    try {
      setIsSubmittingWeek(true);
      await onUndoWeek(activeChallenge.id, weekToUndo, onDeleteExpense);
      setWeekToUndo(null);
    } catch (err) {
      console.error('Error undoing week:', err);
    } finally {
      setIsSubmittingWeek(false);
    }
  };

  // Quick preset initial values
  const presets = [100, 500, 1000, 5000, 10000];

  // If no challenge exists or user clicked "+ Iniciar Novo Desafio", render Creation Screen
  if (!activeChallenge || isCreatingNew) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Top Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReturnToFinance}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.backBtn || 'Voltar'}</span>
          </button>

          {challenges.length > 0 && isCreatingNew && (
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              {language === 'es' ? 'Ver desafío activo' : 'Ver desafio ativo'}
            </button>
          )}
        </div>

        {/* Creation Card Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {t.challenge52Title || 'Desafio de 52 Semanas'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.challenge52Subtitle || 'Aposte no seu futuro economizando um valor crescente a cada semana do ano.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-5">
            {/* Challenge Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.goalNameLabel || 'Título do Desafio (opcional)'}
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Ex: Desafio 52 Semanas 2026"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Initial Weekly Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.challenge52InitialAmount || 'Monto Inicial Semanal (Semana 1) *'}
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={initialAmountStr}
                onChange={(e) => setInitialAmountStr(e.target.value.replace(/^0+(?=\d)/, ''))}
                onFocus={(e) => e.target.select()}
                placeholder="1000"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono-numbers"
              />

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  {language === 'es' ? 'Sugerencias:' : 'Sugestões:'}
                </span>
                {[100, 500, 1000, 2000, 5000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInitialAmountStr(String(p))}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-xl border transition-all cursor-pointer font-mono-numbers ${
                      parsedInitialAmount === p
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {formatCurrency(p, currency)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                {t.challenge52InitialAmountHelp || 'Ex: $1.000 → Semana 1: $1.000, Semana 2: $2.000 ... Semana 52: $52.000'}
              </p>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.challenge52StartDate || 'Fecha de Inicio del Desafío *'}
              </label>
              <input
                type="date"
                required
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Real-time Calculation Summary Box */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.challenge52TotalTarget || 'Monto Total Objetivo (52 Semanas)'}:
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono-numbers">
                  {formatCurrency(creationTotalTarget, currency)}
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <div>
                  <span>Semana 1:</span>{' '}
                  <strong className="text-slate-900 dark:text-white font-mono-numbers">
                    {formatCurrency(parsedInitialAmount || 0, currency)}
                  </strong>
                </div>
                <div>
                  <span>Semana 52:</span>{' '}
                  <strong className="text-slate-900 dark:text-white font-mono-numbers">
                    {formatCurrency((parsedInitialAmount || 0) * 52, currency)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              type="submit"
              disabled={isSubmittingCreate || parsedInitialAmount <= 0}
              className="w-full py-3.5 px-4 text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-2xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmittingCreate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.savingBtn || 'Criando...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t.challenge52CreateNewBtn || 'Iniciar Desafío de 52 Semanas'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Challenge Dashboard Screen
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & SWITCH CHALLENGE CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReturnToFinance}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title={t.backBtn || 'Voltar'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {activeChallenge.title}
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  activeChallenge.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {activeChallenge.status === 'completed' ? 'Desafio Concluído 🎉' : 'Em Andamento'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {t.challenge52InitialAmount || 'Monto inicial'}: {formatCurrency(activeChallenge.initialAmount, currency)}/sem • {language === 'es' ? 'Inicio:' : 'Início:'} {activeChallenge.startDate}
            </p>
          </div>
        </div>

        {/* Switch / Create New Challenge Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {challenges.length > 1 && (
            <select
              value={activeChallenge.id}
              onChange={(e) => onSelectChallenge(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.challenge52CreateNewBtn || 'Novo Desafio'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS GRID (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Total Objetivo */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.challenge52TotalTarget || 'Monto Total Objetivo'}
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1 text-base sm:text-xl font-black font-mono-numbers text-slate-900 dark:text-white truncate">
            {formatCurrency(activeChallenge.totalTarget, currency)}
          </div>
          <div className="text-[10px] text-slate-400">
            52 semanas acumuladas
          </div>
        </div>

        {/* Card 2: Total Ahorrado */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.challenge52SavedTotal || 'Total Ahorrado'}
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1 text-base sm:text-xl font-black font-mono-numbers text-emerald-600 dark:text-emerald-400 truncate">
            {formatCurrency(metrics?.totalSaved || 0, currency)}
          </div>
          <div className="text-[10px] text-slate-400">
            {metrics?.completedCount || 0} de 52 semanas completadas
          </div>
        </div>

        {/* Card 3: Dinero Restante */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.challenge52Remaining || 'Dinero Restante'}
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1 text-base sm:text-xl font-black font-mono-numbers text-rose-600 dark:text-rose-400 truncate">
            {formatCurrency(metrics?.remainingAmount || 0, currency)}
          </div>
          <div className="text-[10px] text-slate-400">
            {52 - (metrics?.completedCount || 0)} semanas restantes
          </div>
        </div>

        {/* Card 4: Semana Actual & Próximo Ahorro */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.challenge52CurrentWeek || 'Semana Actual'} ({metrics?.currentCalculatedWeek})
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1 text-base sm:text-xl font-black font-mono-numbers text-amber-600 dark:text-amber-400 truncate">
            {formatCurrency(metrics?.nextWeekAmount || 0, currency)}
          </div>
          <div className="text-[10px] text-slate-400">
            {t.challenge52NextAmount || 'Próximo a ahorrar'} (Semana {metrics?.nextUncompletedWeek})
          </div>
        </div>
      </div>

      {/* 3. PROGRESS BAR BANNER */}
      <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-extrabold text-slate-900 dark:text-white">
              {t.challenge52Progress || 'Progreso del Desafío'}
            </span>
          </div>

          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono-numbers">
            {(metrics?.progressPercent || 0).toFixed(1)}%
          </span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${metrics?.progressPercent || 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {metrics?.completedCount} {language === 'es' ? 'de 52 semanas completadas' : 'de 52 semanas concluídas'}
          </span>
          <span className="font-bold font-mono-numbers">
            {formatCurrency(metrics?.totalSaved || 0, currency)} / {formatCurrency(activeChallenge.totalTarget, currency)}
          </span>
        </div>
      </div>

      {/* 4. 52 WEEKS GRID & FILTER */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        {/* Header & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{language === 'es' ? 'Las 52 Semanas del Desafío' : 'As 52 Semanas do Desafio'}</span>
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setWeekFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                weekFilter === 'all'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterAll || 'Todas'} (52)
            </button>
            <button
              type="button"
              onClick={() => setWeekFilter('pending')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                weekFilter === 'pending'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterPending || 'Pendientes'} ({52 - (metrics?.completedCount || 0)})
            </button>
            <button
              type="button"
              onClick={() => setWeekFilter('completed')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                weekFilter === 'completed'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterPaid || 'Completadas'} ({metrics?.completedCount || 0})
            </button>
          </div>
        </div>

        {/* 52 Weeks Grid (Responsive) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
          {filteredWeeks.map((w) => {
            return (
              <button
                key={w.weekNumber}
                type="button"
                onClick={() => {
                  if (w.isCompleted) {
                    setWeekToUndo(w.weekNumber);
                  } else {
                    setWeekToConfirm(w.weekNumber);
                  }
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] ${
                  w.isCompleted
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 shadow-2xs'
                    : w.isCurrentWeek
                    ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-sm ring-2 ring-amber-400/50'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Top Row: Week Badge */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-md ${
                      w.isCompleted
                        ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                        : w.isCurrentWeek
                        ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Sem {w.weekNumber}
                  </span>

                  {w.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : w.isCurrentWeek ? (
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                  ) : null}
                </div>

                {/* Middle: Amount */}
                <div className="my-0.5">
                  <div
                    className={`text-xs sm:text-sm font-extrabold font-mono-numbers ${
                      w.isCompleted
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatCurrency(w.amount, currency)}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {w.formattedDate}
                  </span>
                </div>

                {/* Bottom: Action Label */}
                <div className="text-[9px] font-extrabold uppercase tracking-tight flex items-center justify-between">
                  <span
                    className={
                      w.isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : w.isCurrentWeek
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400'
                    }
                  >
                    {w.isCompleted
                      ? (t.challenge52StatusCompleted || 'Concluído')
                      : w.isCurrentWeek
                      ? 'Atual'
                      : (t.challenge52StatusPending || 'Pendente')}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. CONFIRMATION MODAL TO COMPLETE A WEEK */}
      {weekToConfirm !== null && (() => {
        const weekAmount = Math.round(activeChallenge.initialAmount * weekToConfirm);
        const start = new Date(activeChallenge.startDate);
        start.setDate(start.getDate() + (weekToConfirm - 1) * 7);
        const dateStr = start.toLocaleDateString(
          language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'pt-BR',
          { day: '2-digit', month: '2-digit', year: 'numeric' }
        );

        return (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {t.challenge52ConfirmDepositTitle || 'Confirmar Economia da Semana'} {weekToConfirm}
              </h3>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                    {t.amountLabel || 'Valor a Guardar'}
                  </span>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono-numbers">
                    {formatCurrency(weekAmount, currency)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    {language === 'es' ? 'Fecha programada:' : 'Data programada:'} {dateStr}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <div className="flex items-start gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {t.challenge52InvestmentNotice ||
                        "Este valor será registrado automaticamente como uma saída na categoria 'Investimentos' para constar nos seus relatórios."}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  disabled={isSubmittingWeek}
                  onClick={() => setWeekToConfirm(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {t.cancelBtn || 'Cancelar'}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingWeek}
                  onClick={handleConfirmWeekSubmit}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingWeek && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.confirmBtn || 'Confirmar'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. UNDO MODAL TO REOPEN A WEEK */}
      {weekToUndo !== null && (() => {
        const weekAmount = Math.round(activeChallenge.initialAmount * weekToUndo);

        return (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {t.challenge52UndoTitle || 'Desfazer Semana'} {weekToUndo}
              </h3>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <p>
                  {language === 'es'
                    ? `¿Deseas reabrir la Semana ${weekToUndo} (${formatCurrency(weekAmount, currency)})?`
                    : `Deseja reabrir a Semana ${weekToUndo} (${formatCurrency(weekAmount, currency)})?`}
                </p>
                <p className="text-[11px] text-slate-400 italic">
                  {t.challenge52UndoDesc ||
                    "Ao reabrir a semana, o lançamento correspondente na categoria 'Investimentos' será removido das suas despesas."}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  disabled={isSubmittingWeek}
                  onClick={() => setWeekToUndo(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {t.cancelBtn || 'Cancelar'}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingWeek}
                  onClick={handleUndoWeekSubmit}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingWeek && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.undoDepositBtn || 'Desfazer'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
