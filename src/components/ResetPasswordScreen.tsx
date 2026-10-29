import React, { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/config';
import { LanguageCode } from '../types';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResetPasswordScreenProps {
  oobCode: string;
  language?: LanguageCode;
  onSelectLanguage?: (lang: LanguageCode) => void;
  onSuccess: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  oobCode,
  language = 'pt',
  onSelectLanguage,
  onSuccess,
}) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(language);
  const t = getTranslations(currentLang);

  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [codeValid, setCodeValid] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (isMounted) {
          setUserEmail(email);
          setCodeValid(true);
          setIsLoadingCode(false);
        }
      })
      .catch((err) => {
        console.error('Invalid or expired password reset code:', err);
        if (isMounted) {
          setCodeValid(false);
          setIsLoadingCode(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [oobCode]);

  const handleLanguageChange = (l: LanguageCode) => {
    setCurrentLang(l);
    onSelectLanguage?.(l);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!newPassword) {
      setLocalError(t.authErrorPasswordRequired);
      return;
    }
    if (newPassword.length < 6) {
      setLocalError(t.authErrorPasswordShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError(t.authErrorPasswordMismatch);
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao redefinir a senha.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-xl shadow-cyan-500/20 border border-slate-200/50 dark:border-slate-800 transition-transform hover:scale-105">
            <img
              src="/assets/aistudio/image_89b2520a.jpeg"
              alt="SisFinz Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              SisFinz
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.resetPasswordTitle}
            </p>
          </div>
        </div>

        {isLoadingCode ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Validando link de recuperação...</p>
          </div>
        ) : !codeValid ? (
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-rose-500 mb-1" />
              <p className="font-semibold">{t.invalidOrExpiredLink}</p>
            </div>
            <button
              type="button"
              onClick={onSuccess}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span>{t.requestNewLinkBtn || (currentLang === 'es' ? 'Pedir uno nuevo' : 'Solicitar novo link')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : isSuccess ? (
          <div className="space-y-6 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-50 dark:border-emerald-900/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight">
                {currentLang === 'es' ? '¡Contraseña actualizada!' : 'Senha redefinida!'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.passwordResetSuccessMsg}
              </p>
            </div>
            <button
              type="button"
              onClick={onSuccess}
              className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span>{t.authBackToLogin}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {userEmail && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-[11px] text-slate-400 block">Conta:</span>
                <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{userEmail}</span>
              </div>
            )}

            {localError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.newPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.confirmNewPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? t.savingBtn : t.resetPasswordBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
