import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, CheckCircle2, Loader2, X, AlertCircle, ArrowRight } from 'lucide-react';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';

interface OTPRecoveryModalProps {
  onClose: () => void;
  language: LanguageCode;
}

export const OTPRecoveryModal: React.FC<OTPRecoveryModalProps> = ({ onClose, language }) => {
  const t = getTranslations(language);
  const { resetPassword } = useAuth();
  
  const [step, setStep] = useState<'email' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    
    setLoading(true);
    setError(null);
    try {
      await resetPassword(cleanEmail);
      setStep('success');
    } catch (e: any) {
      console.error('Password reset failed:', e);
      setError(e.message || t.otpErrorRequest);
    } finally {
      setLoading(false);
    }
  };

  const successMessage = language === 'es'
    ? 'Enviamos un enlace a tu e-mail. Revisa también el spam.'
    : 'Enviamos um link para o seu e-mail. Verifique também o spam.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {step === 'success' ? t.otpSuccessTitle : t.otpRecoveryTitle}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}
        
        {step === 'email' ? (
          <div className="space-y-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'es' 
                ? 'Introduce tu correo electrónico para recibir un enlace de restablecimiento de contraseña.' 
                : 'Informe seu e-mail para receber um link de redefinição de senha.'}
            </p>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                placeholder={t.otpEmailPlaceholder} 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-hidden transition-all"
              />
            </div>
            <button 
              onClick={handleResetPassword} 
              disabled={loading || !email.trim()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" /> 
                  <span>{t.authSubmitForgot || 'Enviar Link'}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center py-4 space-y-6 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-50 dark:border-emerald-900/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                {successMessage}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t.otpBackToLogin}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {step !== 'success' && (
          <button 
            onClick={onClose} 
            className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-2"
          >
            {t.cancelBtn}
          </button>
        )}
      </div>
    </div>
  );
};
