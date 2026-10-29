import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LanguageCode } from '../types';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { Mail, RefreshCw, CheckCircle2, LogOut, AlertCircle } from 'lucide-react';

interface EmailVerificationScreenProps {
  language?: LanguageCode;
  onSelectLanguage?: (lang: LanguageCode) => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  language = 'pt',
  onSelectLanguage,
}) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(language);
  const t = getTranslations(currentLang);

  const { user, sendVerificationEmail, reloadUser, signOutUser, authError, clearAuthError } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLanguageChange = (l: LanguageCode) => {
    setCurrentLang(l);
    onSelectLanguage?.(l);
  };

  const handleResend = async () => {
    clearAuthError();
    setSuccessMessage(null);
    setIsResending(true);
    try {
      await sendVerificationEmail();
      setSuccessMessage(t.verificationEmailSent);
    } catch (err: unknown) {
      // handled in context
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerified = async () => {
    clearAuthError();
    setSuccessMessage(null);
    setIsChecking(true);
    try {
      const verified = await reloadUser();
      if (!verified) {
        setSuccessMessage(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsChecking(false);
    }
  };

  const displayError = authError;

  return (
    <div className="min-h-[100dvh] min-h-screen flex items-center justify-center p-4 py-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative pt-safe pb-safe overflow-y-auto">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      {/* Language Switcher Bar at Top Right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {(Object.keys(LANGUAGES) as LanguageCode[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => handleLanguageChange(l)}
            className={`px-2 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              currentLang === l
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{LANGUAGES[l].flag}</span>
            <span className="uppercase text-[10px]">{l}</span>
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 text-center">
        {/* Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
          <Mail className="w-8 h-8 animate-bounce" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t.verifyEmailTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.verifyEmailSubtitle}
          </p>
          {user?.email && (
            <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {user.email}
            </div>
          )}
        </div>

        {displayError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={isChecking}
            onClick={handleCheckVerified}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isChecking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{t.alreadyVerifiedBtn}</span>
          </button>

          <button
            type="button"
            disabled={isResending}
            onClick={handleResend}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
            <span>{t.resendVerificationBtn}</span>
          </button>

          <button
            type="button"
            onClick={signOutUser}
            className="w-full py-2.5 px-4 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
