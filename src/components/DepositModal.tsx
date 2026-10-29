import React from 'react';
import { CurrencyCode, ChallengeSquare, LanguageCode } from '../types';
import { formatCurrencyExact, formatShortDate } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { CheckCircle2, AlertCircle, X, RotateCcw, Sparkles } from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  square: ChallengeSquare | null;
  currency: CurrencyCode;
  language?: LanguageCode;
  isCompleted: boolean;
  depositDate?: string;
  onClose: () => void;
  onConfirm: (squareId: number) => void;
  onUndo: (squareId: number) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  square,
  currency,
  language = 'pt',
  isCompleted,
  depositDate,
  onClose,
  onConfirm,
  onUndo,
}) => {
  const t = getTranslations(language);

  if (!isOpen || !square) return null;

  const formattedAmount = formatCurrencyExact(square.value, currency);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100 flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (pinned) */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${
                isCompleted
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
              }`}
            >
              #{square.id}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.depositModalTitle} #{square.id}
                </h3>
                {square.isAdjustment && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    {t.finalAdjustmentBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isCompleted ? t.depositCompletedDesc : t.depositPendingDesc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {/* Valor card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.requiredValueLabel}
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-numbers mt-1">
              {formattedAmount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {t.depositInstructionsPrefix} <strong>{formattedAmount}</strong> {t.depositInstructionsSuffix}
            </p>
          </div>

          {/* Estado: Já concluído */}
          {isCompleted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    {t.depositAlreadyConfirmed}
                  </p>
                  {depositDate && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {t.depositRegisteredAt} {formatShortDate(depositDate)}
                    </p>
                  )}
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                    {t.depositSummedDescPrefix} {formattedAmount} {t.depositSummedDescSuffix}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUndo(square.id);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t.undoDepositBtn}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  {t.closeBtn}
                </button>
              </div>
            </div>
          ) : (
            /* Estado: Não concluído */
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {t.depositPendingWarning}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="sm:w-1/3 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm(square.id);
                    onClose();
                  }}
                  className="sm:w-2/3 px-4 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t.confirmDepositBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
