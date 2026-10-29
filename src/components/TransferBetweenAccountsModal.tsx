/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AccountItem, CurrencyCode, LanguageCode } from '../types';
import { getTodayStr } from '../utils/finance';
import { formatCurrency } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';
import {
  X,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  Check,
  Info,
  Loader2,
  FileText,
} from 'lucide-react';

interface TransferBetweenAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  onExecuteTransfer: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
}

export const TransferBetweenAccountsModal: React.FC<TransferBetweenAccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  currency,
  language = 'pt',
  onExecuteTransfer,
}) => {
  const t = getTranslations(language);

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (activeAccounts.length >= 2) {
      setFromAccountId(activeAccounts[0].id);
      setToAccountId(activeAccounts[1].id);
    } else if (activeAccounts.length === 1) {
      setFromAccountId(activeAccounts[0].id);
      setToAccountId('');
    } else {
      setFromAccountId('');
      setToAccountId('');
    }

    setAmountStr('');
    setDate(getTodayStr());
    setNotes('');
    setError(null);
  }, [isOpen, activeAccounts.length]);

  if (!isOpen) return null;

  const fromAccountObj = activeAccounts.find((a) => a.id === fromAccountId);
  const toAccountObj = activeAccounts.find((a) => a.id === toAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromAccountId || !toAccountId) {
      setError(
        language === 'es'
          ? 'Por favor, selecciona las cuentas de origen y destino.'
          : language === 'en'
          ? 'Please select source and destination accounts.'
          : 'Selecione as contas de origem e destino.'
      );
      return;
    }

    if (fromAccountId === toAccountId) {
      setError(
        language === 'es'
          ? 'La cuenta de origen y destino no pueden ser la misma.'
          : language === 'en'
          ? 'Source and destination account cannot be the same.'
          : 'A conta de origem e destino não podem ser a mesma.'
      );
      return;
    }

    const parsedAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    if (parsedAmount <= 0) {
      setError(
        language === 'es'
          ? 'El monto a transferir debe ser mayor a cero.'
          : language === 'en'
          ? 'Transfer amount must be greater than zero.'
          : 'O valor da transferência deve ser maior que zero.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onExecuteTransfer({
        fromAccountId,
        toAccountId,
        amount: parsedAmount,
        date,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao executar transferência.');
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {language === 'es' ? 'Transferir Entre Cuentas' : language === 'en' ? 'Transfer Between Accounts' : 'Transferir Entre Contas'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Mueve dinero de una cuenta a otra sin generar gasto ni ingreso'
                  : language === 'en'
                  ? 'Move money between accounts without creating income or expense'
                  : 'Movimente dinheiro sem alterar seus relatórios de gastos'}
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
            {activeAccounts.length < 2 && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'es'
                    ? 'Necesitas al menos 2 cuentas activas para realizar transferencias. Crea otra cuenta primero.'
                    : language === 'en'
                    ? 'You need at least 2 active accounts to make transfers. Create another account first.'
                    : 'Você precisa de pelo menos 2 contas ativas para transferir. Crie outra conta primeiro.'}
                </span>
              </div>
            )}

            {/* From Account (De) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{language === 'es' ? 'De (Cuenta de Origen)' : language === 'en' ? 'From (Source Account)' : 'De (Conta de Origem)'}</span>
                {fromAccountObj && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono-numbers font-bold">
                    {language === 'es' ? 'Saldo actual:' : 'Saldo atual:'} {formatCurrency(fromAccountObj.currentBalance, fromAccountObj.currency || currency)}
                  </span>
                )}
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id} disabled={acc.id === toAccountId}>
                    {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji || '🏦'} {acc.name} ({formatCurrency(acc.currentBalance, acc.currency)})
                  </option>
                ))}
              </select>
            </div>

            {/* Direction Arrow */}
            <div className="flex items-center justify-center -my-2 py-1">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                ↓
              </div>
            </div>

            {/* To Account (Para) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{language === 'es' ? 'Para (Cuenta de Destino)' : language === 'en' ? 'To (Destination Account)' : 'Para (Conta de Destino)'}</span>
                {toAccountObj && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono-numbers font-bold">
                    {language === 'es' ? 'Saldo actual:' : 'Saldo atual:'} {formatCurrency(toAccountObj.currentBalance, toAccountObj.currency || currency)}
                  </span>
                )}
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                    {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji || '🏦'} {acc.name} ({formatCurrency(acc.currentBalance, acc.currency)})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'es' ? 'Monto a Transferir' : language === 'en' ? 'Transfer Amount' : 'Valor a Transferir'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono-numbers font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'es' ? 'Fecha' : language === 'en' ? 'Date' : 'Data'}</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === 'es' ? 'Observación (opcional)' : 'Observação (opcional)'}</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Depósito no banco, Retirada em efectivo..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Explanatory Info Card */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {language === 'es'
                  ? 'Esta transferencia NO afectará el informe mensual de gastos e ingresos. Únicamente reajusta los saldos entre tus cuentas.'
                  : 'Esta transferência NÃO altera seu relatório mensal de gastos ou receitas. Apenas ajusta os saldos das suas contas.'}
              </span>
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
              disabled={isSubmitting || activeAccounts.length < 2}
              className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'es' ? 'Transferiendo...' : 'Transferindo...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{language === 'es' ? 'Confirmar Transferencia' : 'Confirmar Transferência'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
