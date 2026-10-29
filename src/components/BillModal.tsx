/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BillItem, CurrencyCode, RecurrenceType, LanguageCode } from '../types';
import { getTodayStr, formatMonthName } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { X, Receipt, Check, Calendar, Repeat, Tag, Plus, AlertCircle } from 'lucide-react';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  selectedMonth?: string;
  editingBill?: BillItem | null;
  categories: string[];
  onAddCategory?: (name: string, scope: 'bill' | 'income' | 'expense' | 'all') => Promise<unknown>;
  onSave: (data: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate?: (id: string, partial: Partial<BillItem>) => Promise<void>;
  onUpdateOccurrence?: (
    id: string,
    targetMonth: string,
    partial: Partial<BillItem>,
    scope: 'this' | 'this_and_future'
  ) => Promise<void>;
}

export const BillModal: React.FC<BillModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  selectedMonth,
  editingBill,
  categories,
  onAddCategory,
  onSave,
  onUpdate,
  onUpdateOccurrence,
}) => {
  const t = getTranslations(language);

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceMode, setRecurrenceMode] = useState<'forever' | 'limited'>('forever');
  const [monthsCount, setMonthsCount] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Prompt for recurring installment edits
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{
    name: string;
    amount: number;
    dueDate: string;
    dueDay: number;
    category: string;
    notes?: string;
    recurrence: RecurrenceType;
    recurrenceMonthsCount: number;
    startMonth: string;
  } | null>(null);

  const prevIsOpenRef = React.useRef(isOpen);
  const prevEditingIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const currentEditId = editingBill ? editingBill.id : null;
    const isEditTargetChanged = currentEditId !== prevEditingIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevEditingIdRef.current = currentEditId;

    if (!isOpen) return;

    if (isOpening || isEditTargetChanged) {
      if (editingBill) {
        setName(editingBill.name);
        setAmountStr(String(editingBill.amount));
        setDueDate(editingBill.dueDate);
        setCategory(editingBill.category || '');
        setNotes(editingBill.notes || '');
        setRecurrence(editingBill.recurrence);
        if (editingBill.recurrenceMonthsCount && editingBill.recurrenceMonthsCount > 0) {
          setRecurrenceMode('limited');
          setMonthsCount(editingBill.recurrenceMonthsCount);
        } else {
          setRecurrenceMode('forever');
        }
      } else {
        setName('');
        setAmountStr('');
        setDueDate(getTodayStr());
        setCategory('');
        setNotes('');
        setRecurrence('none');
        setRecurrenceMode('forever');
        setMonthsCount(6);
        setError(null);
      }
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setShowRecurrencePrompt(false);
      setPendingPayload(null);
    }
  }, [editingBill, isOpen]);

  if (!isOpen) return null;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !onAddCategory) return;
    try {
      setIsSavingCategory(true);
      await onAddCategory(newCategoryName.trim(), 'bill');
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCreatingCategory(false);
    } catch (err) {
      console.error('Error creating inline category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amountStr.replace(',', '.'));
    if (!name.trim()) {
      setError(t.nameLabel + (language === 'es' ? ' es obligatorio.' : language === 'pt' ? ' é obrigatório.' : ' is required.'));
      return;
    }
    if (isNaN(val) || val <= 0) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa un valor válido mayor que cero.'
          : language === 'pt'
          ? 'Por favor, informe um valor válido maior que zero.'
          : 'Please enter a valid amount greater than zero.'
      );
      return;
    }
    if (!dueDate) {
      setError(
        language === 'es'
          ? 'Por favor, selecciona la fecha de vencimiento.'
          : language === 'pt'
          ? 'Por favor, selecione a data de vencimento.'
          : 'Please select the due date.'
      );
      return;
    }
    if (!category || !category.trim() || category === 'Selecionar categoria' || category === 'Seleccionar categoría' || category === 'Select category') {
      setError(
        t.selectCategoryRequiredError ||
          (language === 'es'
            ? 'Por favor, seleccione una categoría. Este campo es obligatorio.'
            : language === 'pt'
            ? 'Por favor, selecione uma categoria. Este campo é obrigatório.'
            : 'Please select a category. This field is required.')
      );
      return;
    }

    const dueDay = dueDate ? parseInt(dueDate.split('-')[2], 10) || 1 : 1;
    const startMonth = dueDate.substring(0, 7);
    const recurrenceMonthsCount =
      recurrence === 'monthly' && recurrenceMode === 'limited' ? Number(monthsCount) : 0;

    const payload = {
      name: name.trim(),
      amount: val,
      dueDate,
      dueDay,
      category: category.trim(),
      notes: notes.trim() || undefined,
      recurrence,
      recurrenceMonthsCount,
      startMonth,
    };

    // If editing an existing recurring bill, ask user how to apply the changes
    if (editingBill && editingBill.recurrence === 'monthly' && onUpdateOccurrence) {
      setPendingPayload(payload);
      setShowRecurrencePrompt(true);
      return;
    }

    // Standard save / update for non-recurring or new bill
    try {
      setIsSubmitting(true);
      if (editingBill && onUpdate) {
        await onUpdate(editingBill.id, payload);
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a fatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyRecurrenceEdit = async (scope: 'this' | 'this_and_future') => {
    if (!editingBill || !pendingPayload || !onUpdateOccurrence) return;
    const targetMonth = selectedMonth || editingBill.dueDate.substring(0, 7);
    try {
      setIsSubmitting(true);
      await onUpdateOccurrence(editingBill.id, targetMonth, pendingPayload, scope);
      setShowRecurrencePrompt(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar fatura parcelada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden">
        {/* Header (pinned) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingBill ? t.editBillModalTitle : t.newBillModalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aluguel, Academia, Internet, Cartão, etc.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Recurrence Prompt Modal State */}
        {showRecurrencePrompt ? (
          <div className="p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  {t.recurringEditPromptTitle}
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {t.recurringEditPromptSubtitle}
                </p>
                {selectedMonth && (
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    Mês de referência: {formatMonthName(selectedMonth)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Editar somente esta fatura */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApplyRecurrenceEdit('this')}
                className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">
                    {t.editOnlyThisOption}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                    1 mês
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.editOnlyThisDesc}
                </p>
              </button>

              {/* Option 2: Editar esta e todas as próximas */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApplyRecurrenceEdit('this_and_future')}
                className="w-full p-4 rounded-2xl border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/40 hover:bg-rose-100/50 text-left transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-rose-700 dark:text-rose-300">
                    {t.editThisAndFutureOption}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
                    Próximas
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {t.editThisAndFutureDesc}
                </p>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowRecurrencePrompt(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        ) : (
          /* Form Container */
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.nameLabel} *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Aluguel, Academia, Internet, Plano de saúde..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Valor & Vencimento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.amountLabel} ({CURRENCIES[currency]?.symbol || '$'} {currency}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full px-4 py-3 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                  />
                </div>
                {amountStr && !isNaN(parseFloat(amountStr)) && (
                  <p className="text-[10px] text-slate-400">
                    {formatCurrency(parseFloat(amountStr), currency)}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {t.dueDateLabel} *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Categoria com Quick Add */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {t.categoryLabel}
                </label>
                {!isCreatingCategory && onAddCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.inlineAddCategory}</span>
                  </button>
                )}
              </div>

              {/* Inline category input if open */}
              {isCreatingCategory ? (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-rose-300 dark:border-rose-900 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Criar nova categoria para faturas:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ex: Pet / Veterinário, Condomínio..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      disabled={isSavingCategory || !newCategoryName.trim()}
                      onClick={handleCreateCategory}
                      className="px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingCategory ? '...' : t.createAndUse}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="px-2 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    required
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      if (error) setError(null);
                    }}
                    className={`w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white cursor-pointer ${
                      !category
                        ? 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-medium'
                        : 'border-slate-200 dark:border-slate-700 font-semibold'
                    }`}
                  >
                    <option value="" disabled hidden={false}>
                      {t.selectCategoryPlaceholder || (language === 'es' ? 'Seleccionar categoría' : language === 'pt' ? 'Selecionar categoria' : 'Select category')}
                    </option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {!category && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      * {t.selectCategoryPlaceholder || 'Selecionar categoria'} ({language === 'es' ? 'obligatoria' : 'obrigatória'})
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Recorrência */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {t.recurrenceLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecurrence('monthly')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    recurrence === 'monthly'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold ring-1 ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{t.recurrenceMonthly}</div>
                  <div className="text-[10px] text-slate-500">Repete todo mês</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRecurrence('none')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    recurrence === 'none'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold ring-1 ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{t.recurrenceNone}</div>
                  <div className="text-[10px] text-slate-500">Apenas neste vencimento</div>
                </button>
              </div>

              {/* Opções de Recorrência Mensal */}
              {recurrence === 'monthly' && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="billRecurrenceMode"
                        value="forever"
                        checked={recurrenceMode === 'forever'}
                        onChange={() => setRecurrenceMode('forever')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>{t.repeatForever}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="billRecurrenceMode"
                        value="limited"
                        checked={recurrenceMode === 'limited'}
                        onChange={() => setRecurrenceMode('limited')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>{t.endAfterMonths}</span>
                    </label>
                  </div>

                  {recurrenceMode === 'limited' && (
                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        {t.monthsQty}:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={monthsCount}
                        onChange={(e) => setMonthsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-24 px-3 py-1.5 text-xs font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                      />
                      <span className="text-xs text-slate-500">meses</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.notesLabel}
              </label>
              <input
                type="text"
                placeholder="Ex: Chave Pix, código de barras, parcelado em 10x..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
              />
            </div>

            </div>

            {/* Fixed Bottom Action Bar (pinned) */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-end gap-3 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? '...' : t.saveBtn}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
