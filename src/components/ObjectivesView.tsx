import React from 'react';
import { ChallengeGoal, CurrencyCode, ChallengeSquare, LanguageCode } from '../types';
import { formatCurrency, getGoalSquares, getGoalSavedAmount } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { DashboardStats } from './DashboardStats';
import { SquareGrid } from './SquareGrid';
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';

interface ObjectivesViewProps {
  goals: ChallengeGoal[];
  activeGoal: ChallengeGoal | null;
  activeGoalSquares: ChallengeSquare[];
  currency: CurrencyCode;
  language?: LanguageCode;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  financialProgressPercent: number;
  completedSquaresCount: number;
  totalSquaresCount: number;
  squaresProgressPercent: number;
  onSwitchGoal: (id: string) => void;
  onOpenNewGoalModal: () => void;
  onOpenEditGoalModal: () => void;
  onOpenAvulsoModal: () => void;
  onDeleteGoal: (id: string) => void;
  onSquareClick: (squareId: number) => void;
  selectedSquareId: number | null;
  onReturnToFinance?: () => void;
}

export const ObjectivesView: React.FC<ObjectivesViewProps> = ({
  goals,
  activeGoal,
  activeGoalSquares,
  currency,
  language = 'pt',
  savedAmount,
  targetAmount,
  remainingAmount,
  financialProgressPercent,
  completedSquaresCount,
  totalSquaresCount,
  squaresProgressPercent,
  onSwitchGoal,
  onOpenNewGoalModal,
  onOpenEditGoalModal,
  onOpenAvulsoModal,
  onDeleteGoal,
  onSquareClick,
  selectedSquareId,
  onReturnToFinance,
}) => {
  const t = getTranslations(language);

  const activeGoalCurrency = activeGoal?.currency || currency;

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-16 md:pb-6">
      {/* Return to Finance Button */}
      {onReturnToFinance && (
        <button
          type="button"
          onClick={onReturnToFinance}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{language === 'es' ? 'Volver al Control Financiero' : 'Voltar ao Controle Financeiro'}</span>
        </button>
      )}

      {/* 1. Header & Quick Creation Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                {t.myGoals}
              </h2>
              {goals.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                  {goals.length} {goals.length === 1 ? 'meta' : 'metas'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'pt'
                ? 'Desafio dos quadrados e economia progressiva'
                : language === 'es'
                ? 'Desafío de los cuadrados y ahorro progresivo'
                : 'Square challenge and progressive savings'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNewGoalModal}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addGoalBtn}</span>
        </button>
      </div>

      {/* 2. Goal Switcher Pills (Essential for Mobile!) */}
      {goals.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {goals.map((g) => {
            const isActive = activeGoal?.id === g.id;
            const cur = g.currency || currency;
            const saved = getGoalSavedAmount(g);
            const pct = g.totalTarget > 0 ? Math.min(100, Math.round((saved / g.totalTarget) * 100)) : 0;

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSwitchGoal(g.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span className="text-sm">{g.icon || '🎯'}</span>
                <span>{g.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-numbers ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Empty State if No Goals */}
      {goals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center space-y-4 max-w-lg mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <Target className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {t.noGoalsActive}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'pt'
                ? 'Defina seu primeiro objetivo financeiro (ex: Viagem, Carro, Reserva de Emergência) e economize aos poucos completando os quadrados do desafio!'
                : language === 'es'
                ? '¡Define tu primer objetivo financiero (ej: Viaje, Auto, Fondo de Emergencia) y ahorra poco a poco completando los cuadrados del desafío!'
                : 'Set your first financial goal (e.g. Travel, Car, Emergency Fund) and save gradually by checking off challenge squares!'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewGoalModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addGoalBtn}</span>
          </button>
        </div>
      ) : activeGoal ? (
        <div className="space-y-4">
          {/* Active Goal Stats Hero Card */}
          <DashboardStats
            goal={activeGoal}
            savedAmount={savedAmount}
            targetAmount={targetAmount}
            remainingAmount={remainingAmount}
            financialProgressPercent={financialProgressPercent}
            completedSquaresCount={completedSquaresCount}
            totalSquaresCount={totalSquaresCount}
            squaresProgressPercent={squaresProgressPercent}
            currency={activeGoalCurrency}
            language={language}
            onEditGoalClick={onOpenEditGoalModal}
            onAddAvulsoClick={onOpenAvulsoModal}
          />

          {/* Interactive Squares Challenge Grid */}
          <SquareGrid
            goal={activeGoal}
            currency={activeGoalCurrency}
            language={language}
            onSquareClick={onSquareClick}
            selectedSquareId={selectedSquareId}
            onAddAvulsoClick={onOpenAvulsoModal}
          />

          {/* Mobile Goal Management Actions */}
          <div className="flex items-center justify-between pt-2 px-1 text-xs">
            <button
              type="button"
              onClick={onOpenEditGoalModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.editGoalTitle || t.editItem || (language === 'es' ? 'Editar Meta' : 'Editar Meta')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const confirmed = window.confirm(
                  language === 'pt'
                    ? `Deseja realmente excluir a meta "${activeGoal.title}"?`
                    : language === 'es'
                    ? `¿Realmente deseas eliminar la meta "${activeGoal.title}"?`
                    : `Do you really want to delete the goal "${activeGoal.title}"?`
                );
                if (confirmed) {
                  onDeleteGoal(activeGoal.id);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === 'es' ? 'Eliminar Meta' : language === 'pt' ? 'Excluir Meta' : 'Delete Goal'}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
