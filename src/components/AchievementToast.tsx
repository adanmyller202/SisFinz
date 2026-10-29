import React, { useEffect } from 'react';
import { Achievement, LanguageCode } from '../types';
import { Sparkles, X } from 'lucide-react';

interface AchievementToastProps {
  achievement: Achievement | null;
  language?: LanguageCode;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  language = 'pt',
  onClose,
}) => {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-2xl shrink-0">
          {achievement.icon}
        </div>

        <div className="flex-1 pr-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Sparkles className="w-3 h-3" />
            <span>
              {language === 'es'
                ? '¡Logro Desbloqueado!'
                : language === 'pt'
                ? 'Conquista Desbloqueada!'
                : 'Achievement Unlocked!'}
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
            {achievement.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {achievement.description}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 self-start cursor-pointer"
          aria-label={
            language === 'es'
              ? 'Cerrar notificación'
              : language === 'pt'
              ? 'Fechar notificação'
              : 'Close notification'
          }
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
