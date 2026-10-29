/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AccountItem, AccountType, CurrencyCode, LanguageCode } from '../types';
import { CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import {
  X,
  Building2,
  Wallet,
  Banknote,
  Vault,
  Box,
  Check,
  AlertCircle,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  editingAccount?: AccountItem | null;
  onSave: (params: {
    name: string;
    type: AccountType;
    currency: CurrencyCode;
    initialBalance: number;
    notes?: string;
  }) => Promise<void>;
}

export const ACCOUNT_TYPE_CONFIG: Record<
  AccountType,
  { label: Record<LanguageCode, string>; icon: React.FC<{ className?: string }>; emoji: string }
> = {
  bank: {
    label: { pt: 'Banco', es: 'Banco', en: 'Bank' },
    icon: Building2,
    emoji: '🏦',
  },
  wallet: {
    label: { pt: 'Carteira Digital', es: 'Billetera Digital', en: 'Digital Wallet' },
    icon: Wallet,
    emoji: '💳',
  },
  cash: {
    label: { pt: 'Efectivo / Dinheiro', es: 'Efectivo', en: 'Cash' },
    icon: Banknote,
    emoji: '💵',
  },
  safe: {
    label: { pt: 'Caixa / Cofre', es: 'Caja', en: 'Safe / Box' },
    icon: Vault,
    emoji: '💰',
  },
  other: {
    label: { pt: 'Outro', es: 'Otro', en: 'Other' },
    icon: Box,
    emoji: '📦',
  },
};

const SUGGESTED_NAMES = [
  'Efectivo',
  'Banco Galicia',
  'Santander',
  'BBVA',
  'Mercado Pago',
  'Nubank',
  'Bradesco',
  'Itaú',
  'Caixa',
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  editingAccount,
  onSave,
}) => {
  const t = getTranslations(language);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency);
  const [initialBalanceStr, setInitialBalanceStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingAccount) {
      setName(editingAccount.name || '');
      setType(editingAccount.type || 'bank');
      setSelectedCurrency(editingAccount.currency || currency);
      setInitialBalanceStr(String(editingAccount.initialBalance ?? 0));
      setNotes(editingAccount.notes || '');
    } else {
      setName('');
      setType('bank');
      setSelectedCurrency(currency);
      setInitialBalanceStr('0');
      setNotes('');
    }
    setError(null);
  }, [isOpen, editingAccount, currency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa el nombre de la cuenta.'
          : language === 'en'
          ? 'Please enter account name.'
          : 'Por favor, informe o nome da conta.'
      );
      return;
    }

    const parsedInitial = parseFloat(initialBalanceStr.replace(',', '.')) || 0;

    try {
      setIsSubmitting(true);
      await onSave({
        name: name.trim(),
        type,
        currency: selectedCurrency,
        initialBalance: parsedInitial,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              {ACCOUNT_TYPE_CONFIG[type]?.emoji || '🏦'}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {editingAccount
                  ? language === 'es'
                    ? 'Editar Cuenta'
                    : language === 'en'
                    ? 'Edit Account'
                    : 'Editar Conta'
                  : language === 'es'
                  ? 'Nueva Cuenta'
                  : language === 'en'
                  ? 'New Account'
                  : 'Nova Conta'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Registra dónde está tu dinero disponible'
                  : language === 'en'
                  ? 'Record where your available money is stored'
                  : 'Cadastre onde seu dinheiro está guardado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
            {/* Account Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'es' ? 'Tipo de Cuenta' : language === 'en' ? 'Account Type' : 'Tipo de Conta'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).map((tKey) => {
                  const cfg = ACCOUNT_TYPE_CONFIG[tKey];
                  const isSelected = type === tKey;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => {
                        setType(tKey);
                        if (tKey === 'cash' && !name) {
                          setName('Efectivo');
                        }
                      }}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-base">{cfg.emoji}</span>
                      <span className="text-xs truncate">{cfg.label[language] || cfg.label.pt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Name & Suggested Chips */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'es' ? 'Nombre de la Cuenta' : language === 'en' ? 'Account Name' : 'Nome da Conta'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Banco Galicia, Mercado Pago, Efectivo..."
                required
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />

              {/* Suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {SUGGESTED_NAMES.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => {
                      setName(sName);
                      if (sName === 'Efectivo') setType('cash');
                      else if (sName === 'Mercado Pago') setType('wallet');
                      else setType('bank');
                    }}
                    className="px-2 py-1 text-[10px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    + {sName}
                  </button>
                ))}
              </div>
            </div>

            {/* Initial Balance & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'es' ? 'Saldo Inicial' : language === 'en' ? 'Initial Balance' : 'Saldo Inicial'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {CURRENCIES[selectedCurrency]?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={initialBalanceStr}
                    onChange={(e) => setInitialBalanceStr(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono-numbers font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.currencySettingLabel || 'Moeda'}
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                >
                  {(Object.keys(CURRENCIES) as CurrencyCode[]).map((cCode) => (
                    <option key={cCode} value={cCode}>
                      {CURRENCIES[cCode].flag} {cCode} ({CURRENCIES[cCode].symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-end gap-2.5 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'es' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? t.savingBtn
                  : editingAccount
                  ? language === 'es'
                    ? 'Guardar Cambios'
                    : 'Salvar Alterações'
                  : language === 'es'
                  ? 'Crear Cuenta'
                  : 'Criar Conta'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
