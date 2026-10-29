/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SavingGoal, SavingTransaction, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  PiggyBank,
  Plus,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Target,
  AlertTriangle,
} from 'lucide-react';

interface SavingsSectionProps {
  savings: SavingGoal[];
  transactions?: SavingTransaction[];
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  onOpenCreateModal: () => void;
  onOpenEditModal: (goal: SavingGoal) => void;
  onOpenTransferModal: (goalId?: string, type?: 'deposit' | 'withdrawal') => void;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

export const SavingsSection: React.FC<SavingsSectionProps> = ({
  savings = [],
  transactions = [],
  currentBalance = 0,
  currency,
  language = 'es',
  onOpenCreateModal,
  onOpenEditModal,
  onOpenTransferModal,
  onDeleteGoal,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const safeSavings = Array.isArray(savings) ? savings : [];
  const totalSaved = safeSavings.reduce((sum, s) => sum + (s?.currentAmount || 0), 0);
  const totalTarget = safeSavings.reduce((sum, s) => sum + (s?.targetAmount || 0), 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const handleDelete = async (goal: SavingGoal) => {
    if (confirm(`${t.deleteConfirmSaving} "${goal.name}"?`)) {
      try {
        setDeletingId(goal.id);
        await onDeleteGoal(goal.id);
      } catch (err) {
        console.error('Error deleting saving goal:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Helper for deadline calculations
  const getDeadlineInfo = (deadlineStr?: string) => {
    if (!deadlineStr) return null;
    try {
      const targetDate = new Date(`${deadlineStr}T23:59:59`);
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const formatted = new Date(`${deadlineStr}T12:00:00`).toLocaleDateString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      return {
        formatted,
        diffDays,
        isOverdue: diffDays < 0,
        isToday: diffDays === 0,
      };
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Header with Overview & Primary Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {t.savingsTitle}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {t.savingsSubtitle}
              </p>
            </div>
          </div>

          {/* Action Buttons: "+ Nuevo Ahorro" & "Transferir" */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenTransferModal()}
              disabled={safeSavings.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.transferBtn}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newSavingGoalBtn}</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
          {/* Total Ahorrado */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {t.totalSavedInSavings}
            </span>
            <div className="text-base sm:text-lg font-black font-mono-numbers text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(totalSaved, currency)}
            </div>
            <span className="text-[10px] text-slate-400">
              {overallPercentage}% {language === 'es' ? 'del total' : 'do total'}
            </span>
          </div>

          {/* Total Metas */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {language === 'es' ? 'Monto Objetivo Total' : 'Total das Metas'}
            </span>
            <div className="text-base sm:text-lg font-black font-mono-numbers text-slate-900 dark:text-white truncate">
              {formatCurrency(totalTarget, currency)}
            </div>
            <span className="text-[10px] text-slate-400">
              {safeSavings.length} {language === 'es' ? 'metas creadas' : 'metas criadas'}
            </span>
          </div>

          {/* Falta por Ahorrar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {t.remainingLabel}
            </span>
            <div className="text-base sm:text-lg font-black font-mono-numbers text-amber-600 dark:text-amber-400 truncate">
              {formatCurrency(Math.max(0, totalTarget - totalSaved), currency)}
            </div>
            <span className="text-[10px] text-slate-400">
              {language === 'es' ? 'Para completar todas' : 'Para atingir todas'}
            </span>
          </div>

          {/* Saldo Disponible en Cuenta */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {t.availableBalanceLabel}
            </span>
            <div className="text-base sm:text-lg font-black font-mono-numbers text-blue-600 dark:text-blue-400 truncate">
              {formatCurrency(currentBalance, currency)}
            </div>
            <span className="text-[10px] text-slate-400">
              {language === 'es' ? 'Listo para transferir' : 'Pronto para transferir'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Grid of Saving Goals */}
      {safeSavings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl shadow-xs">
            🎯
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              {t.noSavingsYet}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {t.noSavingsYetDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newSavingGoalBtn}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {safeSavings.map((goal) => {
            const current = goal.currentAmount || 0;
            const target = goal.targetAmount || 1;
            const percent = Math.min(100, Math.round((current / target) * 100));
            const remaining = Math.max(0, target - current);
            const isCompleted = current >= target;
            const deadlineInfo = getDeadlineInfo(goal.deadline);

            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800/80 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Top: Icon, Title & Edit/Delete Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xl shrink-0 shadow-xs">
                      {goal.icon || '🎯'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                          {goal.name}
                        </h3>
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>100%</span>
                          </span>
                        )}
                      </div>

                      {/* Deadline badge */}
                      {deadlineInfo ? (
                        <div
                          className={`flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${
                            deadlineInfo.isOverdue
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{deadlineInfo.formatted}</span>
                          <span className="text-[10px]">
                            •{' '}
                            {deadlineInfo.isOverdue
                              ? t.overdueDeadline
                              : `${deadlineInfo.diffDays} ${t.daysRemaining}`}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {t.noDeadline}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Header Edit / Delete buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenEditModal(goal)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title={t.editItem}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(goal)}
                      disabled={deletingId === goal.id}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer disabled:opacity-50"
                      title={t.deleteItem}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {t.savedAmountLabel}
                      </span>
                      <div className="text-lg sm:text-xl font-black font-mono-numbers text-emerald-600 dark:text-emerald-400 tracking-tight">
                        {formatCurrency(current, currency)}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {t.targetAmountLabel}
                      </span>
                      <div className="text-xs sm:text-sm font-bold font-mono-numbers text-slate-700 dark:text-slate-300">
                        {formatCurrency(target, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>
                      {percent}% {t.progressLabel.toLowerCase()}
                    </span>
                    <span>
                      {isCompleted
                        ? t.goalCompleted
                        : `${t.remainingLabel}: ${formatCurrency(remaining, currency)}`}
                    </span>
                  </div>
                </div>

                {/* Notes preview if any */}
                {goal.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 line-clamp-2">
                    "{goal.notes}"
                  </p>
                )}

                {/* Footer Action Buttons: Transferir (Depositar) & Retirar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenTransferModal(goal.id, 'deposit')}
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>{t.savingCardActionTransfer}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenTransferModal(goal.id, 'withdrawal')}
                    disabled={current <= 0}
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                    <span>{t.savingCardActionWithdraw}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
