import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LanguageCode } from '../types';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { OTPRecoveryModal } from './OTPRecoveryModal';
import { Lock, Mail, User as UserIcon, ArrowRight, Sparkles, CheckCircle2, AlertCircle, Globe } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot_password';

interface AuthScreenProps {
  language?: LanguageCode;
  onSelectLanguage?: (lang: LanguageCode) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language = 'pt',
  onSelectLanguage,
}) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(language);
  const t = getTranslations(currentLang);

  const { signUp, signIn, signInWithGoogle, resetPassword, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setLocalError(null);
    setResetSuccess(null);
    clearAuthError();
  };

  const handleLanguageChange = (l: LanguageCode) => {
    setCurrentLang(l);
    onSelectLanguage?.(l);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSuccess(null);
    clearAuthError();

    if (!email.trim()) {
      setLocalError(t.authErrorEmailRequired);
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setLocalError(t.authErrorNameRequired);
        return;
      }
      if (password.length < 6) {
        setLocalError(t.authErrorPasswordShort);
        return;
      }
      if (password !== confirmPassword) {
        setLocalError(t.authErrorPasswordMismatch);
        return;
      }

      setIsSubmitting(true);
      try {
        await signUp(name, email, password, keepSignedIn);
      } catch {
        // Error is set in context
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'login') {
      if (!password) {
        setLocalError(t.authErrorPasswordRequired);
        return;
      }

      setIsSubmitting(true);
      try {
        await signIn(email, password, keepSignedIn);
      } catch {
        // Error is set in context
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'forgot_password') {
      setIsSubmitting(true);
      try {
        await resetPassword(email);
        setResetSuccess(t.authResetLinkSent);
      } catch {
        // Error is handled in context
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle(keepSignedIn);
    } catch {
      // Handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative box-border overflow-y-auto pt-safe pb-safe">
      {/* Background radial glow */}
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

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 my-auto">
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
              {mode === 'login' && t.authLoginSubtitle}
              {mode === 'signup' && t.authSignupSubtitle}
              {mode === 'forgot_password' && t.authForgotSubtitle}
            </p>
          </div>
        </div>

        {/* Tab switch for Login / Signup */}
        {mode !== 'forgot_password' && (
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.authLoginTab}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.authSignupTab}
            </button>
          </div>
        )}

        {/* Feedback alerts */}
        {displayError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{resetSuccess}</span>
          </div>
        )}

        {/* Form */}
        {mode !== 'forgot_password' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.authNameLabel}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder={t.authNamePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.authEmailLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder={t.authEmailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.authPasswordLabel}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    {t.authForgotLink}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder={t.authPasswordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.authConfirmPasswordLabel}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder={t.authPasswordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="keepSignedIn"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
              />
              <label
                htmlFor="keepSignedIn"
                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
              >
                {t.keepMeSignedIn || 'Manter conectado'}
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>
                {isSubmitting
                  ? t.savingBtn
                  : mode === 'login'
                  ? t.authSubmitLogin
                  : mode === 'signup'
                  ? t.authSubmitSignup
                  : t.authSubmitForgot}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <OTPRecoveryModal onClose={() => switchMode('login')} language={currentLang} />
        )}

        {/* Divider */}
        {mode !== 'forgot_password' && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-slate-400">
              <span className="bg-white dark:bg-slate-900 px-2 font-bold">
                {currentLang === 'pt' ? 'ou' : currentLang === 'es' ? 'o' : 'or'}
              </span>
            </div>
          </div>
        )}

        {/* Google sign-in */}
        {mode !== 'forgot_password' && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isSubmitting ? t.savingBtn : t.authGoogleButton}</span>
          </button>
        )}

        {/* Bottom links */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === 'forgot_password' ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              {t.authBackToLogin}
            </button>
          ) : mode === 'login' ? (
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              {t.authNoAccount}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              {t.authHaveAccount}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
