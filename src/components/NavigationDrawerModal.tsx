import React, { useEffect } from 'react';
import { LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { getTranslations } from '../utils/i18n';
import {
  Wallet,
  PiggyBank,
  Target,
  Bot,
  Settings,
  User as UserIcon,
  X,
  Sparkles,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  ShieldCheck,
  Tag,
  PieChart as PieChartIcon,
  Users,
  Award,
  FileText,
  Landmark,
} from 'lucide-react';

interface NavigationDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: 'finance' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts';
  onChangeView: (view: 'finance' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts') => void;
  goalsCount: number;
  savingsCount: number;
  sharedPendingCount?: number;
  onOpenMoneChat: () => void;
  onOpenSettingsModal: () => void;
  onOpenProfileModal: () => void;
  language?: LanguageCode;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const NavigationDrawerModal: React.FC<NavigationDrawerModalProps> = ({
  isOpen,
  onClose,
  currentView,
  onChangeView,
  goalsCount,
  savingsCount,
  sharedPendingCount = 0,
  onOpenMoneChat,
  onOpenSettingsModal,
  onOpenProfileModal,
  language = 'pt',
  darkMode,
  onToggleDarkMode,
}) => {
  const t = getTranslations(language);
  const { user, signOutUser } = useAuth();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectView = (view: 'finance' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts') => {
    onChangeView(view);
    onClose();
  };

  const handleAction = (actionFn: () => void) => {
    onClose();
    actionFn();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-start bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[100dvh] overflow-hidden animate-in slide-in-from-left duration-250 ease-out pt-safe pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header with SisFinz Logo and Close Button (pinned) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <img
                src="/assets/aistudio/image_89b2520a.jpeg"
                alt="SisFinz Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-none bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
                SisFinz
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                {language === 'es' ? 'Menú Principal' : language === 'en' ? 'Main Menu' : 'Menu Principal'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card in Drawer */}
        {user && (
          <div className="p-3.5 mx-3 mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {user.displayName
                  ? user.displayName.charAt(0).toUpperCase()
                  : user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400 truncate block">
                  {user.email}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAction(onOpenProfileModal)}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
            >
              {language === 'es' ? 'Ver' : 'Ver'}
            </button>
          </div>
        )}

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-1.5 min-h-0">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'es' ? 'Módulos Financieros' : language === 'en' ? 'Financial Modules' : 'Módulos Financeiros'}
          </div>

          {/* 1. Controle Financeiro */}
          <button
            type="button"
            onClick={() => handleSelectView('finance')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'finance'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'finance'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm block">{t.financialControl}</span>
                <span
                  className={`text-[10px] block ${
                    currentView === 'finance' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Facturas, ingresos y gastos'
                    : language === 'en'
                    ? 'Bills, incomes, and expenses'
                    : 'Faturas, receitas e despesas'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 1.2. Contas & Saldos */}
          <button
            type="button"
            onClick={() => handleSelectView('accounts')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'accounts'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'accounts'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm block">
                  {language === 'es' ? 'Cuentas y Saldos' : language === 'en' ? 'Accounts & Balances' : 'Contas & Saldos'}
                </span>
                <span
                  className={`text-[10px] block ${
                    currentView === 'accounts' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Bancos, efectivo y transferencias'
                    : language === 'en'
                    ? 'Banks, cash, and transfers'
                    : 'Bancos, efectivo e transferências'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 1.5. Contas Compartilhadas */}
          <button
            type="button"
            onClick={() => handleSelectView('shared_accounts')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'shared_accounts'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'shared_accounts'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm">{t.sharedAccounts}</span>
                  {sharedPendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-rose-500 text-white font-bold text-[10px] animate-pulse">
                      {sharedPendingCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] block ${
                    currentView === 'shared_accounts' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Dividir facturas y gastos comunes'
                    : language === 'en'
                    ? 'Share bills and split expenses'
                    : 'Divisão de faturas e gastos'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 2. Ahorros (Metas de Economia) */}
          <button
            type="button"
            onClick={() => handleSelectView('savings')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'savings'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'savings'
                    ? 'bg-white/20 text-white'
                    : 'bg-teal-100 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400'
                }`}
              >
                <PiggyBank className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm">{t.tabSavings}</span>
                  {savingsCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono-numbers ${
                        currentView === 'savings'
                          ? 'bg-white/25 text-white'
                          : 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300'
                      }`}
                    >
                      {savingsCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] block ${
                    currentView === 'savings' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Cofrinhos e reserva de emergência'
                    : language === 'en'
                    ? 'Savings pots and emergency fund'
                    : 'Cofrinhos e reserva de emergência'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 3. Objetivos (Desafio dos Quadrados) */}
          <button
            type="button"
            onClick={() => handleSelectView('goals')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'goals'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'goals'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm">{t.myGoals}</span>
                  {goalsCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono-numbers ${
                        currentView === 'goals'
                          ? 'bg-white/25 text-white'
                          : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {goalsCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] block ${
                    currentView === 'goals' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Desafío interactivo de cuadrados'
                    : language === 'en'
                    ? 'Interactive squares challenge'
                    : 'Desafio interativo dos quadrados'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 3.5. Desafio de 52 Semanas */}
          <button
            type="button"
            onClick={() => handleSelectView('challenge_52')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'challenge_52'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'challenge_52'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm block">
                  {t.challenge52Title || 'Desafío de 52 Semanas'}
                </span>
                <span
                  className={`text-[10px] block ${
                    currentView === 'challenge_52' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Ahorro progresivo semanal durante 1 año'
                    : language === 'en'
                    ? 'Weekly progressive savings for 1 year'
                    : 'Economia semanal progressiva por 1 ano'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 4. Gráfico Mensual */}
          <button
            type="button"
            onClick={() => handleSelectView('report')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'report'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'report'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm block">
                  {language === 'es' ? 'Gráfico Mensual' : language === 'en' ? 'Monthly Chart' : 'Gráfico Mensal'}
                </span>
                <span
                  className={`text-[10px] block ${
                    currentView === 'report' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Distribución y gastos por categoría'
                    : language === 'en'
                    ? 'Distribution and spending by category'
                    : 'Distribuição e gastos por categoria'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 5. Categorías */}
          <button
            type="button"
            onClick={() => handleSelectView('categories')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'categories'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'categories'
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm block">{t.tabCategories}</span>
                <span
                  className={`text-[10px] block ${
                    currentView === 'categories' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Gestión de categorías'
                    : language === 'en'
                    ? 'Category management'
                    : 'Gerenciamento de categorias'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          {/* 6. Mone (Assistente IA) */}
          <button
            type="button"
            onClick={() => handleAction(onOpenMoneChat)}
            className="w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 text-slate-800 dark:text-slate-100 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold">{t.moneAssistant}</span>
                  <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {language === 'es'
                    ? 'Preguntas y consultas automáticas'
                    : language === 'en'
                    ? 'Ask questions and record expenses'
                    : 'Dúvidas e lançamentos inteligentes'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Section: Más / Mais */}
          <div className="pt-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'es' ? 'Más' : language === 'en' ? 'More' : 'Mais'}
          </div>

          {/* Informe (Financial Report) */}
          <button
            type="button"
            onClick={() => handleSelectView('full_report')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left ${
              currentView === 'full_report'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  currentView === 'full_report'
                    ? 'bg-white/20 text-white'
                    : 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400'
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm block font-bold">
                  {t.fullReportTitle || 'Informe'}
                </span>
                <span
                  className={`text-[10px] block ${
                    currentView === 'full_report' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {language === 'es'
                    ? 'Informe financiero completo y detallado'
                    : language === 'en'
                    ? 'Full financial report and summary'
                    : 'Relatório financeiro completo e detalhado'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          <div className="pt-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'es' ? 'Preferencias & Cuenta' : language === 'en' ? 'Settings & Account' : 'Preferências & Conta'}
          </div>

          {/* 5. Configurações */}
          <button
            type="button"
            onClick={() => handleAction(onOpenSettingsModal)}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer text-left font-semibold text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <span>{t.settings}</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>

          {/* 6. Perfil */}
          <button
            type="button"
            onClick={() => handleAction(onOpenProfileModal)}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer text-left font-semibold text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <span>{t.profile}</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>
        </div>

        {/* Drawer Footer with Theme Toggle & Sign Out (pinned) */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
                <span>{darkMode ? (t.lightModeLabel || 'Modo Claro') : (t.darkModeLabel || 'Modo Escuro')}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono-numbers">
                {darkMode ? 'Dark' : 'Light'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              signOutUser();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
