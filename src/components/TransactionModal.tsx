/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  ExpenseItem,
  IncomeItem,
  RecurrenceType,
  CategoryScope,
  SharedUserSummary,
  AccountItem,
  AccountDistribution,
} from '../types';
import { getTodayStr, formatMonthName, getInstallmentPosition } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';
import {
  X,
  Receipt,
  TrendingUp,
  ShoppingBag,
  Check,
  Calendar,
  Repeat,
  Tag,
  Plus,
  AlertCircle,
  Users,
  Landmark,
  CheckCircle2,
} from 'lucide-react';

export type TransactionType = 'bill' | 'expense' | 'income';

export interface EditingTransaction {
  id: string;
  type: TransactionType;
  item: BillItem | ExpenseItem | IncomeItem;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  accounts?: AccountItem[];
  onOpenNewAccount?: () => void;
  selectedMonth?: string;
  initialType?: TransactionType;
  editingTransaction?: EditingTransaction | null;
  getCategoriesFor: (scope: 'bill' | 'income' | 'expense' | 'all') => string[];
  onAddCategory?: (name: string, scope: CategoryScope) => Promise<unknown>;
  onSaveBill: (data: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateBill?: (id: string, partial: Partial<BillItem>) => Promise<any> | void;
  onUpdateBillOccurrence?: (
    id: string,
    targetMonth: string,
    partial: Partial<BillItem>,
    scope: 'this' | 'this_and_future'
  ) => Promise<any> | void;
  onDeleteBill?: (id: string) => Promise<any> | void;
  onSaveIncome: (data: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateIncome?: (id: string, partial: Partial<IncomeItem>) => Promise<any> | void;
  onDeleteIncome?: (id: string) => Promise<any> | void;
  onSaveExpense: (data: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateExpense?: (id: string, partial: Partial<ExpenseItem>) => Promise<any> | void;
  onDeleteExpense?: (id: string) => Promise<any> | void;
  activePartners?: SharedUserSummary[];
  onShareWithPartner?: (params: {
    title: string;
    amount: number;
    dueDate: string;
    dueDay: number;
    category: string;
    notes?: string;
    partnerId: string;
  }) => Promise<any>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  accounts = [],
  onOpenNewAccount,
  selectedMonth,
  initialType = 'bill',
  editingTransaction,
  getCategoriesFor,
  onAddCategory,
  onSaveBill,
  onUpdateBill,
  onUpdateBillOccurrence,
  onDeleteBill,
  onSaveIncome,
  onUpdateIncome,
  onDeleteIncome,
  onSaveExpense,
  onUpdateExpense,
  onDeleteExpense,
  activePartners = [],
  onShareWithPartner,
}) => {
  const t = getTranslations(language);

  // Active transaction type: can be switched directly on this screen at any time!
  const [type, setType] = useState<TransactionType>(initialType);

  // Form Fields
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceMode, setRecurrenceMode] = useState<'forever' | 'limited'>('forever');
  const [monthsCountStr, setMonthsCountStr] = useState<string>('6');

  // Sharing toggle
  const [isSharingActive, setIsSharingActive] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');

  // Status & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Prompt for recurring bill installment edits
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [pendingBillPayload, setPendingBillPayload] = useState<Omit<
    BillItem,
    'id' | 'userId' | 'createdAt' | 'updatedAt'
  > | null>(null);

  // Active accounts filtering
  const activeAccounts = React.useMemo(() => accounts.filter((a) => a.isActive !== false), [accounts]);

  // Account selection fields
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [incomeDistMode, setIncomeDistMode] = useState<'single' | 'multi'>('single');
  const [incomeDistributions, setIncomeDistributions] = useState<Record<string, string>>({});

  // Active categories for the currently chosen type
  const availableCategories = React.useMemo(() => {
    return getCategoriesFor(type);
  }, [type, getCategoriesFor]);

  // Track previous modal open state and editing id to NEVER wipe user inputs on category add/selection!
  const prevIsOpenRef = React.useRef(isOpen);
  const prevEditingIdRef = React.useRef<string | null>(null);

  // Sync state ONLY when modal opens or editing item changes identity
  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const currentEditId = editingTransaction ? `${editingTransaction.type}_${editingTransaction.id}` : null;
    const isEditTargetChanged = currentEditId !== prevEditingIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevEditingIdRef.current = currentEditId;

    if (!isOpen) return;

    // Only re-initialize form fields on initial modal open or switching editing target
    if (isOpening || isEditTargetChanged) {
      if (editingTransaction) {
        const { type: editType, item } = editingTransaction;
        setType(editType);
        setName(item.name || '');
        setAmountStr(String(item.amount || ''));
        setNotes(item.notes || '');

        if (item.accountDistributions && item.accountDistributions.length > 0) {
          setIncomeDistMode('multi');
          const distMap: Record<string, string> = {};
          item.accountDistributions.forEach((d) => {
            distMap[d.accountId] = String(d.amount);
          });
          setIncomeDistributions(distMap);
          setSelectedAccountId(item.accountId || activeAccounts[0]?.id || '');
        } else if (item.accountId) {
          setIncomeDistMode('single');
          setSelectedAccountId(item.accountId);
          setIncomeDistributions({});
        } else {
          setIncomeDistMode('single');
          setSelectedAccountId(activeAccounts[0]?.id || '');
          setIncomeDistributions({});
        }

        if (editType === 'bill') {
          const b = item as BillItem;
          setDate(b.dueDate || getTodayStr());
          setCategory(b.category || '');
          setRecurrence(b.recurrence || 'none');
          if (b.recurrenceMonthsCount && b.recurrenceMonthsCount > 0) {
            setRecurrenceMode('limited');
            setMonthsCountStr(String(b.recurrenceMonthsCount));
          } else {
            setRecurrenceMode('forever');
            setMonthsCountStr('6');
          }
        } else if (editType === 'income') {
          const inc = item as IncomeItem;
          setDate(inc.expectedDate || getTodayStr());
          setCategory(inc.category || '');
          setRecurrence(inc.recurrence || 'none');
          if (inc.recurrenceMonthsCount && inc.recurrenceMonthsCount > 0) {
            setRecurrenceMode('limited');
            setMonthsCountStr(String(inc.recurrenceMonthsCount));
          } else {
            setRecurrenceMode('forever');
            setMonthsCountStr('12');
          }
        } else {
          const exp = item as ExpenseItem;
          setDate(exp.date || getTodayStr());
          setCategory(exp.category || '');
          setRecurrence('none');
        }
      } else {
        setType(initialType);
        setName('');
        setAmountStr('');
        setDate(getTodayStr());
        setNotes('');
        // User requirement: Default recurrence must be 'no repetir nunca' ('none')
        setRecurrence('none');
        setRecurrenceMode('forever');
        setMonthsCountStr(initialType === 'income' ? '12' : '6');
        // User requirement: Default category must be empty -> 'Selecionar categoria' and required
        setCategory('');
        setError(null);
        setIncomeDistMode('single');
        setSelectedAccountId(activeAccounts[0]?.id || '');
        setIncomeDistributions({});
      }

      setIsCreatingCategory(false);
      setNewCategoryName('');
      setShowRecurrencePrompt(false);
      setPendingBillPayload(null);
    }
  }, [isOpen, editingTransaction, initialType, activeAccounts]);

  // Handle switching transaction type directly on the screen (preserves entered name, amount and notes)
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setError(null);

    // If changing to expense, adjust recurrence to none
    if (newType === 'expense') {
      setRecurrence('none');
    }

    // Reset category if not available in new type so user explicitly picks from the new category list
    const newCats = getCategoriesFor(newType);
    if (!newCats.includes(category)) {
      setCategory('');
    }
  };

  if (!isOpen) return null;

  // Inline category quick add
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !onAddCategory) return;
    try {
      setIsSavingCategory(true);
      await onAddCategory(newCategoryName.trim(), type);
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCreatingCategory(false);
    } catch (err) {
      console.error('Error creating inline category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Main Submit Handler
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
          ? 'Por favor, ingresa un monto válido mayor que cero.'
          : language === 'pt'
          ? 'Por favor, informe um valor válido maior que zero.'
          : 'Please enter a valid amount greater than zero.'
      );
      return;
    }
    if (!date) {
      setError(
        language === 'es'
          ? 'Por favor, selecciona una fecha.'
          : language === 'pt'
          ? 'Por favor, selecione uma data.'
          : 'Please select a date.'
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

    const day = date && date.includes('-') ? parseInt(date.split('-')[2], 10) || 1 : 1;
    const startMonth = date.substring(0, 7);
    let recurrenceMonthsCount = 0;
    if (recurrence === 'monthly' && recurrenceMode === 'limited') {
      const parsedM = parseInt(monthsCountStr, 10);
      if (!monthsCountStr || isNaN(parsedM) || parsedM <= 0) {
        setError(
          language === 'es'
            ? 'Por favor, ingrese un número válido de meses (mayor a 0).'
            : language === 'en'
            ? 'Please enter a valid number of months (greater than 0).'
            : 'Por favor, informe uma quantidade válida de meses (maior que 0).'
        );
        return;
      }
      recurrenceMonthsCount = parsedM;
    }

    // Check if user chose to share this bill or expense
    if (isSharingActive && (type === 'bill' || type === 'expense')) {
      if (!selectedPartnerId) {
        setError(t.selectPartnerToShare || 'Selecione uma pessoa para compartilhar.');
        return;
      }
      if (onShareWithPartner) {
        try {
          setIsSubmitting(true);
          await onShareWithPartner({
            title: name.trim(),
            amount: val,
            dueDate: date,
            dueDay: day,
            category: category.trim(),
            notes: notes.trim() || undefined,
            partnerId: selectedPartnerId,
          });
          onClose();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Falha ao enviar solicitação de compartilhamento.');
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
    }

    // 1. BILL
    if (type === 'bill') {
      const payload: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        amount: val,
        dueDate: date,
        dueDay: day,
        category: category.trim(),
        notes: notes.trim() || undefined,
        accountId: selectedAccountId || undefined,
        recurrence,
        recurrenceMonthsCount,
        startMonth,
      };

      // If was editing an existing recurring bill and still a bill:
      if (
        editingTransaction &&
        editingTransaction.type === 'bill' &&
        (editingTransaction.item as BillItem).recurrence === 'monthly' &&
        onUpdateBillOccurrence
      ) {
        setPendingBillPayload(payload);
        setShowRecurrencePrompt(true);
        return;
      }

      try {
        setIsSubmitting(true);
        if (editingTransaction && editingTransaction.type === 'bill' && onUpdateBill) {
          await onUpdateBill(editingTransaction.id, payload);
        } else {
          // If user changed type from expense/income to bill, delete old item
          if (editingTransaction && editingTransaction.type !== 'bill') {
            if (editingTransaction.type === 'expense' && onDeleteExpense) {
              await onDeleteExpense(editingTransaction.id);
            } else if (editingTransaction.type === 'income' && onDeleteIncome) {
              await onDeleteIncome(editingTransaction.id);
            }
          }
          await onSaveBill(payload);
        }
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : language === 'es'
            ? 'Error al guardar la factura.'
            : language === 'pt'
            ? 'Falha ao salvar a fatura.'
            : 'Failed to save bill.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. EXPENSE (Despesa Avulsa)
    if (type === 'expense') {
      const payload: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        amount: val,
        date,
        category: category.trim(),
        notes: notes.trim() || undefined,
        accountId: selectedAccountId || undefined,
      };

      try {
        setIsSubmitting(true);
        if (editingTransaction && editingTransaction.type === 'expense' && onUpdateExpense) {
          await onUpdateExpense(editingTransaction.id, payload);
        } else {
          // If changed from bill/income to expense, delete old record
          if (editingTransaction && editingTransaction.type !== 'expense') {
            if (editingTransaction.type === 'bill' && onDeleteBill) {
              await onDeleteBill(editingTransaction.id);
            } else if (editingTransaction.type === 'income' && onDeleteIncome) {
              await onDeleteIncome(editingTransaction.id);
            }
          }
          await onSaveExpense(payload);
        }
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : language === 'es'
            ? 'Error al guardar el gasto.'
            : language === 'pt'
            ? 'Falha ao salvar despesa.'
            : 'Failed to save expense.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 3. INCOME (Receita)
    if (type === 'income') {
      let finalAccountId = selectedAccountId || undefined;
      let finalDistributions: AccountDistribution[] | undefined = undefined;

      if (incomeDistMode === 'multi') {
        const currentDistTotal = Object.values(incomeDistributions).reduce(
          (sum, strVal) => sum + (parseFloat(strVal.replace(',', '.')) || 0),
          0
        );

        if (Math.abs(currentDistTotal - val) >= 0.01) {
          setError(
            language === 'es'
              ? `Distribuye el monto total de la receta entre las cuentas. La suma debe ser exactamente ${formatCurrency(val, currency)} (Suma actual: ${formatCurrency(currentDistTotal, currency)}).`
              : `Distribua o valor total da receita entre as contas. A soma deve ser exatamente igual a ${formatCurrency(val, currency)} (Soma atual: ${formatCurrency(currentDistTotal, currency)}).`
          );
          return;
        }

        const distList: AccountDistribution[] = Object.entries(incomeDistributions)
          .map(([accId, strVal]) => ({
            accountId: accId,
            amount: parseFloat(strVal.replace(',', '.')) || 0,
          }))
          .filter((d) => d.amount > 0);

        if (distList.length === 0) {
          setError(
            language === 'es'
              ? 'Por favor, asigna un monto a al menos una cuenta.'
              : 'Por favor, informe um valor em pelo menos uma conta.'
          );
          return;
        }

        finalDistributions = distList;
        finalAccountId = distList[0]?.accountId || undefined;
      } else {
        finalAccountId = selectedAccountId || undefined;
        if (selectedAccountId) {
          finalDistributions = [{ accountId: selectedAccountId, amount: val }];
        }
      }

      const payload: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        amount: val,
        expectedDate: date,
        expectedDay: day,
        category: category.trim(),
        notes: notes.trim() || undefined,
        accountId: finalAccountId,
        accountDistributions: finalDistributions,
        recurrence,
        recurrenceMonthsCount,
        startMonth,
      };

      try {
        setIsSubmitting(true);
        if (editingTransaction && editingTransaction.type === 'income' && onUpdateIncome) {
          await onUpdateIncome(editingTransaction.id, payload);
        } else {
          if (editingTransaction && editingTransaction.type !== 'income') {
            if (editingTransaction.type === 'bill' && onDeleteBill) {
              await onDeleteBill(editingTransaction.id);
            } else if (editingTransaction.type === 'expense' && onDeleteExpense) {
              await onDeleteExpense(editingTransaction.id);
            }
          }
          await onSaveIncome(payload);
        }
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : language === 'es'
            ? 'Error al guardar el ingreso.'
            : language === 'pt'
            ? 'Falha ao salvar receita.'
            : 'Failed to save income.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
  };

  // Recurrence confirmation for recurring bills
  const handleApplyRecurrenceEdit = async (scope: 'this' | 'this_and_future') => {
    if (!editingTransaction || !pendingBillPayload || !onUpdateBillOccurrence) return;
    const targetMonth = selectedMonth || pendingBillPayload.dueDate.substring(0, 7);
    try {
      setIsSubmitting(true);
      await onUpdateBillOccurrence(editingTransaction.id, targetMonth, pendingBillPayload, scope);
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
        {/* Header with Switchable Type Tabs (pinned) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                  type === 'bill'
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                    : type === 'income'
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                }`}
              >
                {type === 'bill' && <Receipt className="w-5 h-5" />}
                {type === 'income' && <TrendingUp className="w-5 h-5" />}
                {type === 'expense' && <ShoppingBag className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {editingTransaction ? t.editTransactionTitle : t.newTransactionTitle}
                  </h3>
                  {editingTransaction?.type === 'bill' && (() => {
                    const b = editingTransaction.item as BillItem;
                    if (b.recurrence === 'monthly' && b.recurrenceMonthsCount && b.recurrenceMonthsCount > 1) {
                      const targetM = selectedMonth || (b.dueDate ? b.dueDate.substring(0, 7) : b.startMonth);
                      const label = getInstallmentPosition(b.startMonth, targetM, b.recurrence, b.recurrenceMonthsCount, language as any);
                      return label ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 font-mono-numbers">
                          {label}
                        </span>
                      ) : null;
                    }
                    return null;
                  })()}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.switchTypeHint}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={t.closeBtn}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Type Segmented Switcher (Fatura | Despesa | Receita) */}
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => handleTypeChange('bill')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'bill'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{t.txTypeBill}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{t.txTypeExpense}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{t.txTypeIncome}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-5 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Recurrence Prompt Modal State for Bills */}
        {showRecurrencePrompt ? (
          <div className="p-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
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
                    {formatMonthName(selectedMonth)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApplyRecurrenceEdit('this')}
                className="w-full p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-rose-600">
                    {t.editOnlyThisOption}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                    {t.oneMonthBadge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.editOnlyThisDesc}
                </p>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApplyRecurrenceEdit('this_and_future')}
                className="w-full p-3.5 rounded-2xl border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/40 hover:bg-rose-100/50 text-left transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                    {t.editThisAndFutureOption}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
                    {t.allNextBadge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {t.editThisAndFutureDesc}
                </p>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowRecurrencePrompt(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        ) : (
          /* Form Container */
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
              {/* Nome */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {type === 'bill'
                  ? t.billNameLabel
                  : type === 'income'
                  ? t.incomeNameLabel
                  : t.expenseNameLabel}
              </label>
              <input
                type="text"
                required
                placeholder={
                  type === 'bill'
                    ? t.billPlaceholder
                    : type === 'income'
                    ? t.incomePlaceholder
                    : t.expensePlaceholder
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Valor & Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.amountLabel} ({CURRENCIES[currency]?.symbol || '$'} {currency}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value.replace(/^0+(?=\d)/, ''))}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
                {amountStr && !isNaN(parseFloat(amountStr)) && (
                  <p className="text-[10px] text-slate-400">
                    {formatCurrency(parseFloat(amountStr), currency)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {type === 'bill'
                    ? t.billDueDateLabel
                    : type === 'income'
                    ? t.expectedDateLabel
                    : t.expenseDateLabel}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Categoria com Quick Add */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {t.categoryLabel}
                </label>
                {!isCreatingCategory && onAddCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="text-[10px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.inlineAddCategory}</span>
                  </button>
                )}
              </div>

              {isCreatingCategory ? (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-indigo-300 dark:border-indigo-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {t.createCategoryForPrefix} {type === 'bill' ? t.txTypeBill.toLowerCase() : type === 'income' ? t.txTypeIncome.toLowerCase() : t.txTypeExpense.toLowerCase()}:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder={t.categoryNamePlaceholder}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={isSavingCategory || !newCategoryName.trim()}
                      onClick={handleCreateCategory}
                      className="px-2.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingCategory ? '...' : t.createAndUse}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="p-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white cursor-pointer ${
                      !category
                        ? 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-medium'
                        : 'border-slate-200 dark:border-slate-700 font-semibold'
                    }`}
                  >
                    <option value="" disabled hidden={false}>
                      {t.selectCategoryPlaceholder || (language === 'es' ? 'Seleccionar categoría' : language === 'pt' ? 'Selecionar categoria' : 'Select category')}
                    </option>
                    {availableCategories.map((cat) => (
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

            {/* Account Selector Section (Contas) */}
            <div className="space-y-2 p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-500" />
                  <span>
                    {type === 'expense'
                      ? (language === 'es' ? '¿De cuál cuenta salió este dinero?' : 'De qual conta saiu esse valor?')
                      : type === 'income'
                      ? (language === 'es' ? '¿En cuál cuenta se recibirá este dinero?' : 'Em qual conta esse valor será recebido?')
                      : (language === 'es' ? 'Cuenta de pago (opcional)' : 'Conta de pagamento (opcional)')}
                  </span>
                </label>

                {onOpenNewAccount && (
                  <button
                    type="button"
                    onClick={onOpenNewAccount}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === 'es' ? 'Nueva Cuenta' : 'Nova Conta'}</span>
                  </button>
                )}
              </div>

              {type === 'income' && activeAccounts.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5 pb-1">
                  <button
                    type="button"
                    onClick={() => setIncomeDistMode('single')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      incomeDistMode === 'single'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {language === 'es' ? '1 sola cuenta' : '1 conta específica'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncomeDistMode('multi')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      incomeDistMode === 'multi'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {language === 'es' ? 'Distribuir en varias cuentas' : 'Distribuir em várias contas'}
                  </button>
                </div>
              )}

              {/* Single Account Dropdown Mode */}
              {(type !== 'income' || incomeDistMode === 'single') && (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white cursor-pointer font-semibold"
                >
                  <option value="">
                    {language === 'es' ? 'Sin cuenta específica' : 'Sem conta específica'}
                  </option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji || '🏦'} {acc.name} ({formatCurrency(acc.currentBalance, acc.currency)})
                    </option>
                  ))}
                </select>
              )}

              {/* Multi-Account Income Distribution Mode */}
              {type === 'income' && incomeDistMode === 'multi' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'es'
                      ? 'Ingresa cuánto monto irá a cada cuenta:'
                      : 'Informe quanto do valor total irá para cada conta:'}
                  </p>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain pr-0.5">
                    {activeAccounts.map((acc) => {
                      const valStr = incomeDistributions[acc.id] || '';
                      return (
                        <div key={acc.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                            <span>{ACCOUNT_TYPE_CONFIG[acc.type]?.emoji || '🏦'}</span>
                            <span>{acc.name}</span>
                          </span>

                          <div className="w-28 sm:w-32 relative">
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={valStr}
                              onChange={(e) => {
                                const valInput = e.target.value;
                                setIncomeDistributions((prev) => ({
                                  ...prev,
                                  [acc.id]: valInput,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 text-xs text-right font-mono-numbers font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Distribution Live Feedback Badge */}
                  {(() => {
                    const totalVal = parseFloat(amountStr.replace(',', '.')) || 0;
                    const currentSum = Object.values(incomeDistributions).reduce((sum, str) => sum + (parseFloat(str.replace(',', '.')) || 0), 0);
                    const isExact = Math.abs(currentSum - totalVal) < 0.01;

                    return (
                      <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        isExact
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold'
                      }`}>
                        <div className="font-semibold">
                          {isExact ? (
                            <span>✓ {language === 'es' ? 'Distribución exacta:' : 'Distribuição exata:'}</span>
                          ) : (
                            <span>⚠️ {language === 'es' ? 'La suma debe ser exactamente $' + totalVal.toLocaleString() : 'A soma deve ser exatamente igual a R$' + totalVal.toLocaleString()}</span>
                          )}
                        </div>
                        <div className="font-mono-numbers font-bold">
                          {formatCurrency(currentSum, currency)} / {formatCurrency(totalVal, currency)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Recorrência (Para Fatura e Receita) */}
            {(type === 'bill' || type === 'income') && (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                    {t.recurrenceLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Default: Não repetir nunca (Única) */}
                  <button
                    type="button"
                    onClick={() => setRecurrence('none')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      recurrence === 'none'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.recurrenceNone}</div>
                    <div className="text-[10px] text-slate-500">{t.singleOccurrenceDesc}</div>
                  </button>

                  {/* Mensal */}
                  <button
                    type="button"
                    onClick={() => setRecurrence('monthly')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      recurrence === 'monthly'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.recurrenceMonthly}</div>
                    <div className="text-[10px] text-slate-500">{t.repeatEveryMonthDesc}</div>
                  </button>
                </div>

                {recurrence === 'monthly' && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="txRecurrenceMode"
                          value="forever"
                          checked={recurrenceMode === 'forever'}
                          onChange={() => setRecurrenceMode('forever')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{t.repeatForever}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="txRecurrenceMode"
                          value="limited"
                          checked={recurrenceMode === 'limited'}
                          onChange={() => setRecurrenceMode('limited')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{t.endAfterMonths}</span>
                      </label>
                    </div>

                    {recurrenceMode === 'limited' && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.monthsQty}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={monthsCountStr}
                          onChange={(e) => setMonthsCountStr(e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''))}
                          onFocus={(e) => e.target.select()}
                          placeholder="1"
                          className="w-20 px-2.5 py-1 text-xs font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono-numbers"
                        />
                        <span className="text-xs text-slate-500">{t.monthsLabel}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {t.notesLabel}
              </label>
              <input
                type="text"
                placeholder={t.notesPlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Compartilhar esta fatura/gasto? */}
            {(type === 'bill' || type === 'expense') && activePartners.length > 0 && (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {t.shareThisBillPrompt}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSharingActive}
                      onChange={(e) => {
                        setIsSharingActive(e.target.checked);
                        if (e.target.checked && !selectedPartnerId && activePartners.length > 0) {
                          setSelectedPartnerId(activePartners[0].uid);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {isSharingActive && (
                  <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-2 animate-in fade-in duration-200">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                      {t.selectPartnerToShare}:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activePartners.map((p) => (
                        <button
                          key={p.uid}
                          type="button"
                          onClick={() => setSelectedPartnerId(p.uid)}
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 text-xs transition-all cursor-pointer ${
                            selectedPartnerId === p.uid
                              ? 'border-emerald-500 bg-white dark:bg-slate-800 font-bold text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {p.displayName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{p.displayName}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      * {language === 'es' ? 'Se enviará una solicitud que quedará PENDIENTE hasta que la persona acepte.' : 'Uma solicitação será enviada e ficará PENDENTE até o aceite da pessoa.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            </div>

            {/* Fixed Bottom Action Bar (pinned) */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-end gap-2.5 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  type === 'bill'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : type === 'income'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? t.savingBtn
                    : `${t.saveBtn} ${type === 'bill' ? t.txTypeBill : type === 'income' ? t.txTypeIncome : t.txTypeExpense}`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
