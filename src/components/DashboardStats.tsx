import React from 'react';
import { ChallengeGoal, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { Target, TrendingUp, PiggyBank, Clock, CheckCircle, Zap } from 'lucide-react';

interface DashboardStatsProps {
  goal: ChallengeGoal;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  financialProgressPercent: number;
  completedSquaresCount: number;
  totalSquaresCount: number;
  squaresProgressPercent: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  onEditGoalClick: () => void;
  onAddAvulsoClick: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  goal,
  savedAmount,
  targetAmount,
  remainingAmount,
  financialProgressPercent,
  completedSquaresCount,
  totalSquaresCount,
  squaresProgressPercent,
  currency,
  language = 'pt',
  onEditGoalClick,
  onAddAvulsoClick,
}) => {
  const isFinished = completedSquaresCount >= totalSquaresCount && totalSquaresCount > 0;

  return (
    <div className="space-y-4">
      {/* Primary Hero Card - White Background in light mode, harmonious with the entire app */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-7 shadow-xs border border-slate-200 dark:border-slate-800">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <span className="text-3xl sm:text-4xl p-2.5 bg-emerald-50 dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-slate-700/80 flex items-center justify-center shadow-xs">
                {goal.icon}
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {language === 'es' ? 'Mi Meta' : language === 'pt' ? 'Minha Meta' : 'My Goal'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  {goal.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {goal.startAmount
                    ? `${language === 'es' ? 'Monto inicial:' : language === 'pt' ? 'Valor inicial:' : 'Initial amount:'} ${formatCurrency(goal.startAmount, currency)} · ${totalSquaresCount} ${language === 'es' ? 'depósitos' : language === 'pt' ? 'depósitos' : 'deposits'}`
                    : goal.startNumber && goal.endNumber
                    ? `${language === 'es' ? 'Desafío de' : language === 'pt' ? 'Desafio de' : 'Challenge from'} ${goal.startNumber} ${language === 'es' ? 'a' : language === 'pt' ? 'a' : 'to'} ${goal.endNumber}`
                    : `${totalSquaresCount} ${language === 'es' ? 'depósitos' : language === 'pt' ? 'depósitos' : 'deposits'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={onAddAvulsoClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-300/80 dark:border-amber-800/80 rounded-xl transition-colors cursor-pointer shadow-xs"
                title={
                  language === 'es'
                    ? 'Agregar monto extra y recalcular cuadrados restantes'
                    : language === 'pt'
                    ? 'Adicionar valor avulso e recalcular quadrados restantes'
                    : 'Add extra amount and recalculate remaining squares'
                }
              >
                <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{language === 'es' ? '+ Monto Extra' : language === 'pt' ? '+ Valor Avulso' : '+ Extra Amount'}</span>
              </button>
              <button
                type="button"
                onClick={onEditGoalClick}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                {language === 'es' ? 'Editar' : language === 'pt' ? 'Editar' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Key Metric Numbers - 3 Clean Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-5">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {language === 'es' ? 'Monto de la Meta' : language === 'pt' ? 'Valor da Meta' : 'Target Amount'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono-numbers mt-1 tracking-tight">
                {formatCurrency(targetAmount, currency)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {language === 'es'
                  ? `Suma de ${totalSquaresCount} depósitos`
                  : language === 'pt'
                  ? `Soma de ${totalSquaresCount} depósitos`
                  : `Sum of ${totalSquaresCount} deposits`}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <PiggyBank className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {language === 'es' ? 'Total Ahorrado' : language === 'pt' ? 'Total Economizado' : 'Total Saved'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono-numbers mt-1 tracking-tight">
                {formatCurrency(savedAmount, currency)}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold mt-1">
                {financialProgressPercent.toFixed(2)}% {language === 'es' ? 'completado' : language === 'pt' ? 'concluído' : 'completed'}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {language === 'es' ? 'Monto Restante' : language === 'pt' ? 'Valor Restante' : 'Remaining Amount'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-200 font-mono-numbers mt-1 tracking-tight">
                {formatCurrency(remainingAmount, currency)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {language === 'es'
                  ? `Faltan ${totalSquaresCount - completedSquaresCount} cuadrados`
                  : language === 'pt'
                  ? `Faltam ${totalSquaresCount - completedSquaresCount} quadrados`
                  : `${totalSquaresCount - completedSquaresCount} squares remaining`}
              </p>
            </div>
          </div>

          {/* Dual Progress Bars */}
          <div className="mt-6 space-y-3.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Financial Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {language === 'es' ? 'Progreso Financiero' : language === 'pt' ? 'Progresso Financeiro' : 'Financial Progress'}
                </span>
                <span className="font-mono-numbers font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                  {formatCurrency(savedAmount, currency)} / {formatCurrency(targetAmount, currency)} ({financialProgressPercent.toFixed(2)}%)
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out shadow-xs"
                  style={{ width: `${Math.min(100, Math.max(0, financialProgressPercent))}%` }}
                />
              </div>
            </div>

            {/* Squares Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  {language === 'es' ? 'Cuadrados Completados' : language === 'pt' ? 'Quadrados Concluídos' : 'Completed Squares'}
                </span>
                <span className="font-mono-numbers font-medium text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white font-bold">{completedSquaresCount}</strong> {language === 'es' ? 'de' : language === 'pt' ? 'de' : 'of'} {totalSquaresCount} ({squaresProgressPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, squaresProgressPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {isFinished && (
            <div className="mt-5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-bold">
                  {language === 'es' ? '¡Felicitaciones! ¡Meta 100% Completada!' : language === 'pt' ? 'Parabéns! Meta 100% Completa!' : 'Congratulations! Goal 100% Complete!'}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                  {language === 'es'
                    ? `¡Has ahorrado con éxito ${formatCurrency(targetAmount, currency)} completando todos los ${totalSquaresCount} cuadrados!`
                    : language === 'pt'
                    ? `Você economizou com sucesso ${formatCurrency(targetAmount, currency)} completando todos os ${totalSquaresCount} quadrados!`
                    : `You successfully saved ${formatCurrency(targetAmount, currency)} by completing all ${totalSquaresCount} squares!`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
