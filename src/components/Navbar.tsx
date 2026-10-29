import React, { useState } from 'react';
import { ChallengeGoal, CurrencyCode, LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { SyncStatusBadge } from './SyncStatusBadge';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Menu,
  Sun,
  Moon,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';

interface NavbarProps {
  onOpenMenu: () => void;
  currentView: 'finance' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts';
  goals: ChallengeGoal[];
  activeGoal: ChallengeGoal | null;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSelectCurrency: (currency: CurrencyCode) => void;
  onOpenNewGoalModal: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  hasPendingNotifications?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMenu,
  currentView,
  goals,
  currency,
  language = 'pt',
  onSelectCurrency,
  onOpenNewGoalModal,
  darkMode,
  onToggleDarkMode,
  hasPendingNotifications = false,
}) => {
  const t = getTranslations(language);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-2xs print:hidden pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left Side: 3-Bars Hamburger Button + SisFinz Logo + Brand Name + Sync Status Badge */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          {/* Hamburger 3-Bars Button (Always visible on all screens and accounts) */}
          <button
            type="button"
            onClick={onOpenMenu}
            className="relative p-2 rounded-xl text-slate-800 dark:text-slate-100 bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
            title={language === 'es' ? 'Menú principal (3 barritas)' : language === 'en' ? 'Main menu (3 bars)' : 'Menu principal (3 barras)'}
            aria-label={language === 'es' ? 'Abrir menú principal' : 'Abrir menu principal'}
          >
            <Menu className="w-5 h-5 text-slate-800 dark:text-slate-100" />
            {hasPendingNotifications && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* Logo & Brand Name */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-slate-200/60 dark:border-slate-800 shrink-0">
              <img
                src="/assets/aistudio/image_89b2520a.jpeg"
                alt="SisFinz Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
              SisFinz
            </span>
          </div>

          {/* Discreet Sync Status Badge */}
          <SyncStatusBadge language={language} />
        </div>

        {/* Right Side: Quick Tools (PWA Install, New Goal Shortcut, Currency Switcher, Theme Toggle) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* PWA Install Button (auto-hides when already running standalone) */}
          <PWAInstallButton language={language} variant="compact" />

          {/* Quick Add Goal button (visible on goals view or desktop) */}
          {currentView === 'goals' && (
            <button
              type="button"
              onClick={onOpenNewGoalModal}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              title={t.addGoalBtn}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.addGoalBtn}</span>
              <span className="sm:hidden">{t.addGoalBtnShort}</span>
            </button>
          )}

          {/* Currency Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCurrencyMenuOpen(!currencyMenuOpen)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              title={t.currency}
            >
              <span className="text-sm">{CURRENCIES[currency]?.flag || '💱'}</span>
              <span className="hidden sm:inline">{currency}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {currencyMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCurrencyMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t.currencySettingLabel}
                  </div>
                  {(Object.keys(CURRENCIES) as CurrencyCode[]).map((cCode) => {
                    const cur = CURRENCIES[cCode];
                    const isSelected = currency === cCode;
                    return (
                      <button
                        key={cCode}
                        type="button"
                        onClick={() => {
                          onSelectCurrency(cCode);
                          setCurrencyMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{cur.flag}</span>
                          <span>{cur.symbol} {cur.name}</span>
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Dark / Light Mode toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={darkMode ? (t.lightModeLabel || 'Modo Claro') : (t.darkModeLabel || 'Modo Escuro')}
            aria-label={darkMode ? (t.lightModeLabel || 'Modo Claro') : (t.darkModeLabel || 'Modo Escuro')}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
