import React, { useState, useMemo } from 'react';
import { CurrencyCode, ChallengeGoal, LanguageCode } from '../types';
import {
  formatCurrency,
  CURRENCIES,
  recalculatePendingSquares,
  getGoalSavedAmount,
} from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { Zap, X, CheckCircle2, Calculator, Sparkles } from 'lucide-react';

interface AvulsoDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: ChallengeGoal;
  currency: CurrencyCode;
  language?: LanguageCode;
  onConfirmAvulso: (amount: number, note?: string) => void;
}

export const AvulsoDepositModal: React.FC<AvulsoDepositModalProps> = ({
  isOpen,
  onClose,
  goal,
  currency,
  language = 'pt',
  onConfirmAvulso,
}) => {
  const t = getTranslations(language);
  const [amountInput, setAmountInput] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const currencyConfig = CURRENCIES[currency] || CURRENCIES.BRL;

  const currentSaved = useMemo(() => getGoalSavedAmount(goal), [goal]);
  const currentRemaining = Math.max(0, goal.totalTarget - currentSaved);

  const numericAmount = Math.max(0, parseFloat(amountInput.replace(/[^0-9]/g, '')) || 0);

  // Quick preset chips according to currency
  const quickPresets = useMemo(() => {
    if (currency === 'ARS') {
      return [1000, 5000, 10000, 25000, 50000, 100000];
    }
    if (currency === 'BRL') {
      return [20, 50, 100, 200, 500, 1000];
    }
    return [10, 20, 50, 100, 200, 500];
  }, [currency]);

  // Recalculation preview
  const newSaved = currentSaved + numericAmount;
  const newRemaining = Math.max(0, goal.totalTarget - newSaved);

  // Preview recalculated squares
  const previewRecalculated = useMemo(() => {
    if (numericAmount <= 0) return null;
    const squares = recalculatePendingSquares(goal, newRemaining);
    const newPending = squares.filter((s) => !goal.completedSquares.includes(s.id));
    return newPending;
  }, [goal, numericAmount, newRemaining]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setError(
        language === 'pt'
          ? 'Por favor, digite um valor maior que zero.'
          : language === 'es'
          ? 'Por favor, ingresa un monto mayor a cero.'
          : 'Please enter an amount greater than zero.'
      );
      return;
    }

    onConfirmAvulso(numericAmount, note.trim() || undefined);
    setAmountInput('');
    setNote('');
    setError(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
              <Zap className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t.avulsoModalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {goal.title} ({formatCurrency(goal.totalTarget, currency)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Modal Content */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl">
              {error}
            </div>
          )}

          {/* Explanatory banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-bold flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {t.avulsoModalTitle}
            </span>
            {t.avulsoModalSubtitle}
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              {t.avulsoAmountLabel}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-extrabold text-slate-400 font-mono-numbers pointer-events-none">
                {currencyConfig.symbol}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="0"
                value={amountInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setAmountInput(raw);
                  setError(null);
                }}
                className="w-full pl-12 pr-4 py-3 text-xl sm:text-2xl rounded-2xl border-2 border-emerald-500/40 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono-numbers font-black focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-hidden"
              />
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {quickPresets.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setAmountInput(val.toString());
                    setError(null);
                  }}
                  className="px-2.5 py-1 text-xs font-mono-numbers font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  +{formatCurrency(val, currency)}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t.notesLabel}
            </label>
            <input
              type="text"
              placeholder={t.notesPlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Real-time Impact Card */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                {t.totalTargetSummary}:
              </span>
              <span className="text-emerald-400 font-bold font-mono-numbers">
                +{formatCurrency(numericAmount, currency)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">{t.totalTargetSummary}</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono-numbers mt-0.5 block">
                  {formatCurrency(newSaved, currency)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatCurrency(currentSaved, currency)}
                </span>
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">{t.toReceive}</span>
                <span className="text-base font-extrabold text-slate-200 font-mono-numbers mt-0.5 block">
                  {formatCurrency(newRemaining, currency)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatCurrency(currentRemaining, currency)}
                </span>
              </div>
            </div>

            {/* Recalculated Squares Preview */}
            {previewRecalculated && previewRecalculated.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="text-emerald-400 font-semibold font-mono-numbers">
                    {previewRecalculated.length} {t.squaresCountSummary}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono-numbers">
                  {previewRecalculated.slice(0, 4).map((sq) => (
                    <span
                      key={sq.id}
                      className="px-2 py-1 bg-emerald-950/60 text-emerald-300 rounded-lg shrink-0 border border-emerald-800/70"
                    >
                      #{sq.id}: {formatCurrency(sq.value, currency)}
                    </span>
                  ))}
                  {previewRecalculated.length > 4 && (
                    <span className="text-slate-500 px-1">...</span>
                  )}
                  {previewRecalculated.length > 4 && (
                    <span className="px-2 py-1 bg-emerald-950/60 text-emerald-300 rounded-lg shrink-0 border border-emerald-800/70">
                      #{previewRecalculated[previewRecalculated.length - 1].id}:{' '}
                      {formatCurrency(
                        previewRecalculated[previewRecalculated.length - 1].value,
                        currency
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          </div>

          {/* Fixed Action buttons (pinned) */}
          <div className="flex items-center justify-end gap-3 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.confirmAvulsoBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
