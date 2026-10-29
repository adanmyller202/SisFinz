import React from 'react';
import { ChallengeGoal, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { triggerCelebration } from '../utils/storage';
import { getTranslations } from '../utils/i18n';
import { Trophy, X, PartyPopper } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: ChallengeGoal;
  savedAmount: number;
  currency: CurrencyCode;
  language?: LanguageCode;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  goal,
  savedAmount,
  currency,
  language = 'pt',
}) => {
  const t = getTranslations(language);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-emerald-500/30 overflow-y-auto overscroll-contain max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] text-center p-6 sm:p-8 transform scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          aria-label={t.closeBtn}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 text-3xl mb-4 animate-bounce">
          🏆
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          {t.celebrationTitle}
        </span>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
          🎉 {formatCurrency(savedAmount, currency)}!
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
          {t.celebrationSubtitle}
        </p>

        <div className="my-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">{t.celebrationTotalSaved}</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono-numbers">
            {formatCurrency(savedAmount, currency)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center justify-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> {goal.title} (100%)
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => triggerCelebration('major')}
            className="flex-1 py-3 px-4 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PartyPopper className="w-4 h-4" /> 🎉
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
          >
            {t.celebrationContinueBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
