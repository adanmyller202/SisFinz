/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SavingGoal, CurrencyCode, LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTodayStr } from '../utils/finance';
import {
  X,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Target,
  Calendar,
  AlertCircle,
  Check,
  Plus,
} from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  savings: SavingGoal[];
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  defaultSavingId?: string;
  defaultType?: 'deposit' | 'withdrawal';
  onTransferToSaving: (savingId: string, amount: number, date?: string, note?: string) => Promise<void>;
  onWithdrawFromSaving: (savingId: string, amount: number, date?: string, note?: string) => Promise<void>;
  onOpenCreateSaving?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  savings = [],
  currentBalance = 0,
  currency,
  language = 'es',
  defaultSavingId,
  defaultType = 'deposit',
  onTransferToSaving,
  onWithdrawFromSaving,
  onOpenCreateSaving,
}) => {
  const t = getTranslations(language);
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';

  const safeSavings = Array.isArray(savings) ? savings : [];
  const [mode, setMode] = useState<'deposit' | 'withdrawal'>(defaultType);
  const [selectedSavingId, setSelectedSavingId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayStr());
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultType);
      if (defaultSavingId && safeSavings.some((s) => s.id === defaultSavingId)) {
        setSelectedSavingId(defaultSavingId);
      } else if (safeSavings.length > 0) {
        setSelectedSavingId(safeSavings[0].id);
      } else {
        setSelectedSavingId('');
      }
      setAmount('');
      setDate(getTodayStr());
      setNote('');
      setError(null);
    }
  }, [isOpen, defaultSavingId, defaultType, safeSavings]);

  if (!isOpen) return null;

  const selectedGoal = safeSavings.find((s) => s.id === selectedSavingId);
  const parsedAmount = parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0;

  // Real-time calculation previews
  const afterBalance =
    mode === 'deposit'
      ? currentBalance - parsedAmount
      : currentBalance + parsedAmount;

  const afterSavingAmount = selectedGoal
    ? mode === 'deposit'
      ? (selectedGoal.currentAmount || 0) + parsedAmount
      : Math.max(0, (selectedGoal.currentAmount || 0) - parsedAmount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSavingId) {
      setError(language === 'es' ? 'Selecciona una meta de ahorro.' : 'Selecione uma meta de ahorro.');
      return;
    }

    if (parsedAmount <= 0) {
      setError(language === 'es' ? 'Ingresa un monto válido mayor que cero.' : 'Informe um valor maior que zero.');
      return;
    }

    if (mode === 'deposit' && parsedAmount > currentBalance && currentBalance > 0) {
      // Warning if transferring more than available balance
      const proceed = confirm(
        language === 'es'
          ? `El monto a transferir (${formatCurrency(parsedAmount, currency)}) es mayor que tu saldo disponible (${formatCurrency(currentBalance, currency)}). ¿Deseas continuar de todas formas?`
          : `O valor a transferir (${formatCurrency(parsedAmount, currency)}) é maior que seu saldo disponível (${formatCurrency(currentBalance, currency)}). Deseja continuar?`
      );
      if (!proceed) return;
    }

    if (mode === 'withdrawal') {
      const saved = selectedGoal?.currentAmount || 0;
      if (parsedAmount > saved) {
        setError(
          language === 'es'
            ? `No puedes retirar más de lo que tienes ahorrado en esta meta (${formatCurrency(saved, currency)}).`
            : `Não é possível retirar mais do que o valor economizado (${formatCurrency(saved, currency)}).`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === 'deposit') {
        await onTransferToSaving(selectedSavingId, parsedAmount, date, note.trim() || undefined);
      } else {
        await onWithdrawFromSaving(selectedSavingId, parsedAmount, date, note.trim() || undefined);
      }

      onClose();
    } catch (err: any) {
      console.error('Error in transfer/withdrawal:', err);
      setError(err?.message || 'Error al procesar la transferencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick preset amounts
  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleMaxAmount = () => {
    if (mode === 'deposit') {
      if (currentBalance > 0) setAmount(String(currentBalance));
    } else {
      if (selectedGoal && selectedGoal.currentAmount > 0) {
        setAmount(String(selectedGoal.currentAmount));
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (pinned) */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {t.transferModalTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'es'
                  ? 'Transfiere dinero entre tu saldo disponible y tus ahorros'
                  : 'Transfira dinheiro entre saldo e economias'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Modal Body */}
          <div className="p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Direction Toggle: Transfer to Saving VS Withdraw from Saving */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.transferTypeLabel}
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMode('deposit')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'deposit'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span className="truncate">{language === 'es' ? 'Transferir a Ahorro' : 'Guardar em Ahorro'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('withdrawal')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'withdrawal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span className="truncate">{language === 'es' ? 'Retirar al Saldo' : 'Retirar para Saldo'}</span>
              </button>
            </div>
          </div>

          {/* Target Saving Goal Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.selectSavingGoal}
              </label>
              {onOpenCreateSaving && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateSaving();
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{language === 'es' ? 'Nueva meta' : 'Nova meta'}</span>
                </button>
              )}
            </div>

            {safeSavings.length === 0 ? (
              <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'es'
                    ? 'No tienes metas de ahorro creadas todavía.'
                    : 'Você ainda não possui metas de ahorro criadas.'}
                </p>
                {onOpenCreateSaving && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCreateSaving();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'es' ? 'Crear primera meta' : 'Criar primeiro ahorro'}</span>
                  </button>
                )}
              </div>
            ) : (
              <select
                value={selectedSavingId}
                onChange={(e) => setSelectedSavingId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                required
              >
                {safeSavings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon || '🎯'} {s.name} — Ahorrado: {formatCurrency(s.currentAmount, currency)} / Meta: {formatCurrency(s.targetAmount, currency)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.transferAmountLabel}
              </label>
              <button
                type="button"
                onClick={handleMaxAmount}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {mode === 'deposit'
                  ? `${language === 'es' ? 'Todo el saldo' : 'Todo o saldo'} (${formatCurrency(currentBalance, currency)})`
                  : `${language === 'es' ? 'Todo el ahorro' : 'Todo o ahorro'} (${formatCurrency(selectedGoal?.currentAmount || 0, currency)})`}
              </button>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-bold text-slate-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3.5 py-2.5 text-base font-black font-mono-numbers rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
                autoFocus
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[50000, 100000, 200000, 500000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickAmount(val)}
                  className="px-2 py-1 text-[11px] font-bold font-mono-numbers rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  +{formatCurrency(val, currency).replace(/\s/g, '')}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Balance Comparison Card */}
          {selectedGoal && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'es' ? 'Resumen del Movimiento' : 'Resumo da Movimentação'}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Saldo Disponible */}
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-blue-500" />
                    <span>{t.availableBalanceLabel}</span>
                  </div>
                  <div className="mt-1 font-mono-numbers font-black text-sm text-slate-900 dark:text-white truncate">
                    {formatCurrency(afterBalance, currency)}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {mode === 'deposit' ? `-${formatCurrency(parsedAmount, currency)}` : `+${formatCurrency(parsedAmount, currency)}`}
                  </div>
                </div>

                {/* Meta de Ahorro */}
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Target className="w-3 h-3 text-emerald-500" />
                    <span className="truncate">{selectedGoal.name}</span>
                  </div>
                  <div className="mt-1 font-mono-numbers font-black text-sm text-emerald-600 dark:text-emerald-400 truncate">
                    {formatCurrency(afterSavingAmount, currency)}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {mode === 'deposit' ? `+${formatCurrency(parsedAmount, currency)}` : `-${formatCurrency(parsedAmount, currency)}`}
                  </div>
                </div>
              </div>

              {/* Categoría info */}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>
                  {mode === 'deposit'
                    ? (language === 'es'
                        ? 'Se registrará automáticamente en la categoría "Inversiones" para tu gráfico mensual.'
                        : 'Será registrado na categoria "Inversiones" para o gráfico mensal.')
                    : (language === 'es'
                        ? 'El dinero regresará directamente a tu saldo disponible.'
                        : 'O dinheiro retornará para o saldo disponível.')}
                </span>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t.transferDateLabel}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t.transferNoteLabel}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={language === 'es' ? 'Ej: Ahorro quincenal...' : 'Ex: Reserva quinzenal...'}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          </div>

          {/* Fixed Footer Actions (pinned) */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-end gap-2 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'es' ? 'Cancelar' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || safeSavings.length === 0}
              className={`px-4 py-2 text-xs font-bold rounded-xl text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                mode === 'deposit'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? (language === 'es' ? 'Procesando...' : 'Processando...')
                  : mode === 'deposit'
                  ? (language === 'es' ? 'Confirmar Transferencia' : 'Confirmar Transferência')
                  : (language === 'es' ? 'Confirmar Retiro' : 'Confirmar Retirada')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
