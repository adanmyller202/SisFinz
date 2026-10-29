/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AccountItem, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';
import {
  X,
  Wallet,
  Building2,
  Plus,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface BalanceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  onNavigateToAccounts?: () => void;
  onOpenNewAccount?: () => void;
}

export const BalanceBreakdownModal: React.FC<BalanceBreakdownModalProps> = ({
  isOpen,
  onClose,
  accounts,
  currency,
  language = 'pt',
  onNavigateToAccounts,
  onOpenNewAccount,
}) => {
  const t = getTranslations(language);

  if (!isOpen) return null;

  const activeAccounts = accounts.filter((a) => a.isActive !== false);
  const totalSum = activeAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {language === 'es'
                  ? 'Detalle del Saldo'
                  : language === 'en'
                  ? 'Balance Breakdown'
                  : 'Detalhamento do Saldo'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Ubicación real de tu dinero en cuentas'
                  : language === 'en'
                  ? 'Real-time money location across accounts'
                  : 'Localização em tempo real do seu dinheiro'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {activeAccounts.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-xl">
                🏦
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {language === 'es'
                  ? 'Aún no tienes cuentas registradas. Registra tus bancos o efectivo para vincular tu saldo.'
                  : language === 'en'
                  ? 'No accounts registered yet. Add your bank accounts or cash to link your main balance.'
                  : 'Você ainda não possui contas cadastradas. Cadastre seus bancos ou dinheiro em espécie.'}
              </p>
              {onOpenNewAccount && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewAccount();
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {language === 'es'
                      ? 'Crear Primera Cuenta'
                      : language === 'en'
                      ? 'Add First Account'
                      : 'Criar Primeira Conta'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                {language === 'es' ? 'Cuentas Activas' : language === 'en' ? 'Active Accounts' : 'Contas Ativas'}
              </div>

              {activeAccounts.map((acc) => {
                const cfg = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.other;
                return (
                  <div
                    key={acc.id}
                    className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                        {cfg.emoji}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate block">
                          {acc.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">
                          {cfg.label[language] || cfg.label.pt}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-black font-mono-numbers text-slate-900 dark:text-white block">
                        {formatCurrency(acc.currentBalance, acc.currency || currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total Consolidation Summary Card */}
          {activeAccounts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 block">
                  {language === 'es' ? 'Saldo Total Consolidado' : language === 'en' ? 'Total Consolidated Balance' : 'Saldo Total Consolidado'}
                </span>
                <span className="text-xs text-emerald-100/90 font-medium block">
                  {activeAccounts.length} {activeAccounts.length === 1 ? (language === 'es' ? 'cuenta activa' : 'conta ativa') : (language === 'es' ? 'cuentas activas' : 'contas ativas')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-base sm:text-lg font-black font-mono-numbers block tracking-tight">
                  {formatCurrency(totalSum, currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-between gap-2 z-10">
          {onOpenNewAccount && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewAccount();
              }}
              className="px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'es' ? 'Nueva Cuenta' : 'Nova Conta'}</span>
            </button>
          )}

          {onNavigateToAccounts && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToAccounts();
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1 ml-auto"
            >
              <span>{language === 'es' ? 'Ir a Contas' : 'Ir para Contas'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
