/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyCode, BillItem, IncomeItem, ExpenseItem, LanguageCode, ChallengeGoal, SavingGoal, SharedUserSummary, SharedBill } from '../types';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { useCategories } from '../hooks/useCategories';
import { useSavings } from '../hooks/useSavings';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, getGoalSavedAmount } from '../utils/currency';
import { formatMonthName, formatDayMonthLabel } from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { BalanceModal } from './BalanceModal';
import { BalanceBreakdownModal } from './BalanceBreakdownModal';
import { TransactionModal, TransactionType, EditingTransaction } from './TransactionModal';
import { CategoryManager } from './CategoryManager';
import { UpcomingBillsView } from './UpcomingBillsView';
import { SavingsSection } from './SavingsSection';
import { SavingGoalModal } from './SavingGoalModal';
import { TransferModal } from './TransferModal';
import { MonthlyReportSection } from './MonthlyReportSection';
import { ErrorBoundary } from './ErrorBoundary';
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Plus,
  Receipt,
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  Sparkles,
  Tag,
  CalendarRange,
  X,
  Bot,
  Target,
  PiggyBank,
  ArrowRightLeft,
  PieChart as PieChartIcon,
  Eye,
} from 'lucide-react';

interface FinanceDashboardProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  onOpenMoneChat?: () => void;
  goals?: ChallengeGoal[];
  activeGoal?: ChallengeGoal | null;
  onNavigateToGoals?: () => void;
  onNavigateToAccounts?: () => void;
  initialTab?: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report';
  onReturnToFinance?: () => void;
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
  onToggleBillPaidCustom?: (billId: string, month: string, isPaid: boolean) => Promise<any> | void;
  onDeleteBillCustom?: (billId: string) => Promise<any> | void;
  onDeleteBillOccurrenceCustom?: (
    billId: string,
    targetMonth: string,
    scope: 'this' | 'this_and_future'
  ) => Promise<any> | void;
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({
  currency,
  language = 'pt',
  onOpenMoneChat,
  goals,
  activeGoal,
  onNavigateToGoals,
  onNavigateToAccounts,
  initialTab,
  onReturnToFinance,
  activePartners = [],
  onShareWithPartner,
  onToggleBillPaidCustom,
  onDeleteBillCustom,
  onDeleteBillOccurrenceCustom,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);

  const handleToggleBill = async (billId: string, month: string, isPaid: boolean) => {
    if (onToggleBillPaidCustom) {
      await onToggleBillPaidCustom(billId, month, isPaid);
    } else {
      await toggleBillPaid(billId, month, isPaid);
    }
  };

  const {
    selectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    loading,

    // Data lists
    bills,
    incomes,
    expenses,
    monthBills,
    monthIncomes,
    monthExpenses,
    timelineItems,
    statusRecords,

    // KPIs
    currentBalance,
    totalReceivedMonth,
    totalSpentMonth,
    toReceive,
    toPay,
    totalIncomeMonth,
    totalExpensesMonth,
    forecastBalance,

    // Operations
    updateCurrentBalance,
    addBill,
    updateBill,
    updateBillOccurrence,
    deleteBill,
    deleteBillOccurrence,
    toggleBillPaid,

    addIncome,
    updateIncome,
    deleteIncome,
    toggleIncomeReceived,

    addExpense,
    updateExpense,
    deleteExpense,
    sharedBills,
  } = useFinanceControl();

  const { user } = useAuth();
  const userId = user?.uid;

  // Accounts Hook (Single Source of Truth for main balance when accounts exist)
  const { accounts, totalBalance: accountsTotalBalance, adjustAccountBalanceForFinancialItem } = useAccounts();
  const [isBalanceBreakdownOpen, setIsBalanceBreakdownOpen] = useState(false);

  const effectiveCurrentBalance = accounts.length > 0 ? accountsTotalBalance : currentBalance;

  // Unified Categories Hook (Supports editing and deleting predefined + custom)
  const {
    allDisplayCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    resetPredefinedCategories,
    getCategoriesFor,
  } = useCategories();

  // Navigation tab inside Finance: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report'
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report'
  >(initialTab || 'timeline');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Savings Hook & State
  const {
    savings,
    transactions: savingTransactions,
    loading: savingsLoading,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    transferToSaving,
    withdrawFromSaving,
  } = useSavings();

  const [isSavingGoalModalOpen, setIsSavingGoalModalOpen] = useState(false);
  const [savingGoalToEdit, setSavingGoalToEdit] = useState<SavingGoal | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultSavingId, setTransferDefaultSavingId] = useState<string | undefined>(undefined);
  const [transferDefaultType, setTransferDefaultType] = useState<'deposit' | 'withdrawal'>('deposit');

  const handleOpenTransfer = (savingId?: string, type: 'deposit' | 'withdrawal' = 'deposit') => {
    setTransferDefaultSavingId(savingId);
    setTransferDefaultType(type);
    setIsTransferModalOpen(true);
  };

  const handleOpenCreateSaving = () => {
    setSavingGoalToEdit(null);
    setIsSavingGoalModalOpen(true);
  };

  const handleOpenEditSaving = (goal: SavingGoal) => {
    setSavingGoalToEdit(goal);
    setIsSavingGoalModalOpen(true);
  };

  const handleExecuteTransfer = async (
    savingId: string,
    amount: number,
    date?: string,
    note?: string
  ) => {
    await transferToSaving(savingId, amount, date, note, { addExpense, currency });
  };

  const handleExecuteWithdrawal = async (
    savingId: string,
    amount: number,
    date?: string,
    note?: string
  ) => {
    await withdrawFromSaving(savingId, amount, date, note, {
      addIncome,
      toggleIncomeReceived,
      currentMonthStr: selectedMonth,
    });
  };

  // Filter inside bills tab: 'all' | 'pending' | 'paid' | 'overdue'
  const [billFilter, setBillFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('pending');

  // Filter inside incomes tab: 'all' | 'pending' | 'received'
  const [incomeFilter, setIncomeFilter] = useState<'all' | 'pending' | 'received'>('all');

  // Balance Adjustment Modal
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);

  // Unified Transaction Modal (Switch between Fatura, Despesa, and Receita directly on the screen)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [initialTxType, setInitialTxType] = useState<TransactionType>('bill');
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);

  // Recurring bill delete prompt modal
  const [billToDelete, setBillToDelete] = useState<BillItem | null>(null);
  const [isDeletingOccurrence, setIsDeletingOccurrence] = useState(false);

  // Month Bills count by status
  const pendingBillsCount = monthBills.filter((b) => b.status === 'pending').length;
  const overdueBillsCount = monthBills.filter((b) => b.status === 'overdue').length;
  const paidBillsCount = monthBills.filter((b) => b.status === 'paid').length;

  // Month Incomes count by status
  const pendingIncomesCount = monthIncomes.filter((i) => i.status === 'pending').length;
  const receivedIncomesCount = monthIncomes.filter((i) => i.status === 'received').length;

  // Filtered bills for display
  const filteredMonthBills = monthBills.filter((b) => {
    if (billFilter === 'all') return true;
    return b.status === billFilter;
  });

  // Filtered incomes for display
  const filteredMonthIncomes = monthIncomes.filter((i) => {
    if (incomeFilter === 'all') return true;
    return i.status === incomeFilter;
  });

  // Synthesize shared bills into BillItem format for UpcomingBillsView
  const allBillsForUpcoming = useMemo(() => {
    const synths = sharedBills.map((sb: SharedBill) => {
      const startMonthFallback = sb.startMonth || sb.month || (sb.dueDate ? sb.dueDate.substring(0, 7) : '');
      return {
        id: `sb_${sb.id}`,
        userId: userId || '',
        name: `[Compartilhada] ${sb.title}`,
        amount: sb.amount,
        dueDate: sb.dueDate,
        dueDay: sb.dueDay || 1,
        category: sb.category || 'Contas Compartilhadas',
        notes: sb.notes,
        recurrence: sb.recurrence || 'none',
        recurrenceMonthsCount: sb.recurrenceMonthsCount || 0,
        startMonth: startMonthFallback,
        createdAt: sb.createdAt,
        updatedAt: sb.updatedAt,
        exceptions: sb.exceptions,
        excludedMonths: sb.excludedMonths,
      } as BillItem;
    });
    return [...bills, ...synths];
  }, [bills, sharedBills, userId]);

  // Open modal for new item
  const handleOpenNew = (type: TransactionType) => {
    setEditingTx(null);
    setInitialTxType(type);
    setIsTxModalOpen(true);
  };

  // Open modal for editing existing item
  const handleEditBill = (bill: BillItem) => {
    setEditingTx({ id: bill.id, type: 'bill', item: bill });
    setIsTxModalOpen(true);
  };

  const handleEditIncome = (inc: IncomeItem) => {
    setEditingTx({ id: inc.id, type: 'income', item: inc });
    setIsTxModalOpen(true);
  };

  const handleEditExpense = (exp: ExpenseItem) => {
    setEditingTx({ id: exp.id, type: 'expense', item: exp });
    setIsTxModalOpen(true);
  };

  // Handle delete on a bill (with recurring prompt if monthly)
  const handleDeleteBillClick = (bill: BillItem) => {
    if (bill.recurrence === 'monthly') {
      setBillToDelete(bill);
    } else {
      if (confirm(`${t.deleteConfirmBill} "${bill.name}"?`)) {
        if (onDeleteBillCustom) {
          onDeleteBillCustom(bill.id);
        } else {
          deleteBill(bill.id);
        }
      }
    }
  };

  const handleApplyRecurrenceDelete = async (scope: 'this' | 'this_and_future') => {
    if (!billToDelete) return;
    try {
      setIsDeletingOccurrence(true);
      if (onDeleteBillOccurrenceCustom) {
        await onDeleteBillOccurrenceCustom(billToDelete.id, selectedMonth, scope);
      } else {
        await deleteBillOccurrence(billToDelete.id, selectedMonth, scope);
      }
      setBillToDelete(null);
    } catch (err) {
      console.error('Error deleting bill occurrence:', err);
    } finally {
      setIsDeletingOccurrence(false);
    }
  };

  const handleReturnToMainFinance = () => {
    setActiveTab('timeline');
    if (onReturnToFinance) onReturnToFinance();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & MONTH NAVIGATOR (Optimized for Mobile & Web) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title={t.previousMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2 sm:px-2.5 py-0.5 text-center min-w-[120px] sm:min-w-[140px]">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white capitalize">
                {formatMonthName(selectedMonth, locale)}
              </span>
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title={t.nextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={goToCurrentMonth}
            className="px-2 py-1 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {t.currentMonthBtn}
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {/* Transferir Button (New Feature: Transfers between balance & savings) */}
          <button
            type="button"
            onClick={() => handleOpenTransfer()}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
            title={language === 'es' ? 'Transferir dinero a tus ahorros' : 'Transferir dinheiro para seus ahorros'}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{t.transferBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNew('bill')}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addBill}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNew('income')}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addIncome}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNew('expense')}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 border border-amber-300 dark:border-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" />
            <span>{t.addExpense}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS CARDS (Optimized compact grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Card 1: Saldo Atual (Clickable to open Balance Breakdown) */}
        <div
          onClick={() => setIsBalanceBreakdownOpen(true)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between hover:border-emerald-500/60 cursor-pointer transition-all group"
          title={language === 'es' ? 'Haz clic para ver el detalle de saldo por cuenta' : 'Clique para ver o detalhamento do saldo por conta'}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {t.currentBalance}
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-1">
            <div
              className={`text-base sm:text-xl font-black font-mono-numbers tracking-tight truncate ${
                effectiveCurrentBalance >= 0
                  ? 'text-slate-900 dark:text-white'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(effectiveCurrentBalance, currency)}
            </div>
            <div className="text-[10px] text-slate-400 truncate hidden sm:block">
              +{formatCurrency(totalReceivedMonth, currency)} • -{formatCurrency(totalSpentMonth, currency)}
            </div>
          </div>

          <div
            className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsBalanceBreakdownOpen(true)}
              className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-2.5 h-2.5" />
              <span>{language === 'es' ? 'Ver cuentas' : 'Ver contas'}</span>
            </button>

            {/* Prominent Transfer Button inside Balance Card */}
            <button
              type="button"
              onClick={() => handleOpenTransfer()}
              className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowRightLeft className="w-2.5 h-2.5" />
              <span>{t.transferBtn}</span>
            </button>
          </div>
        </div>

        {/* Card 2: A Receber */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.toReceive}
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-1">
            <div className="text-base sm:text-xl font-black font-mono-numbers tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              +{formatCurrency(toReceive, currency)}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {pendingIncomesCount} {pendingIncomesCount === 1 ? 'pendente' : 'pendentes'}
            </p>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Total:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {formatCurrency(totalIncomeMonth, currency)}
            </span>
          </div>
        </div>

        {/* Card 3: A Pagar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.toPay}
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-1">
            <div className="text-base sm:text-xl font-black font-mono-numbers tracking-tight text-rose-600 dark:text-rose-400 truncate">
              -{formatCurrency(toPay, currency)}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {pendingBillsCount} pendentes {overdueBillsCount > 0 ? `(${overdueBillsCount} atrasadas)` : ''}
            </p>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Total:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {formatCurrency(totalExpensesMonth, currency)}
            </span>
          </div>
        </div>

        {/* Card 4: Previsão no Fim do Mês */}
        <div
          className={`rounded-2xl border p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all ${
            forecastBalance >= 0
              ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-500/10 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              {t.forecastBalance}
            </span>
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full ${
                forecastBalance >= 0
                  ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200'
                  : 'bg-rose-200 text-rose-900 dark:bg-rose-900/80 dark:text-rose-200'
              }`}
            >
              {forecastBalance >= 0 ? t.forecastSurplus : t.forecastDeficit}
            </span>
          </div>

          <div className="my-1">
            <div
              className={`text-base sm:text-xl font-black font-mono-numbers tracking-tight truncate ${
                forecastBalance >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {formatCurrency(forecastBalance, currency)}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {t.forecastFormula}
            </p>
          </div>

          <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Status:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {forecastBalance >= 0 ? t.forecastPositive : t.forecastAttention}
            </span>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS (Compact, Scrollable on Mobile) */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        {/* Tab: Resumo / Timeline */}
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'timeline'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-500" />
          <span>{t.tabOverview}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700">
            {timelineItems.length}
          </span>
        </button>

        {/* Tab: Faturas do Mês */}
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'bills'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>{t.tabBills}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-slate-900/20">
            {monthBills.length}
          </span>
        </button>

        {/* Tab: Próximas Faturas (NEW continuous scroll) */}
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'upcoming'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5 text-rose-500" />
          <span>{t.tabUpcoming}</span>
        </button>

        {/* Tab: Rendas & A Receber */}
        <button
          type="button"
          onClick={() => setActiveTab('incomes')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'incomes'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{t.tabIncomes}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-slate-900/20">
            {monthIncomes.length}
          </span>
        </button>

        {/* Tab: Despesas Avulsas */}
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{t.tabExpenses}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-slate-900/20">
            {monthExpenses.length}
          </span>
        </button>
      </div>

      {/* 4. TAB CONTENT 1: VISÃO GERAL (TIMELINE) */}
      {activeTab === 'timeline' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                {t.overviewTitle} {formatMonthName(selectedMonth, locale)}
              </h3>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {timelineItems.length} {t.itemsCount}
            </div>
          </div>

          {timelineItems.length === 0 ? (
            <div className="py-10 text-center space-y-2.5">
              <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                {t.overviewEmpty}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenNew('bill')}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 rounded-xl hover:bg-rose-100 cursor-pointer"
                >
                  {t.addBill}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenNew('income')}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl hover:bg-emerald-100 cursor-pointer"
                >
                  {t.addIncome}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {timelineItems.map((item) => {
                const isInc = item.type === 'income';
                const isBill = item.type === 'bill';

                const handleTimelineItemClick = () => {
                  if (isBill) {
                    const foundBill = bills.find((b) => b.id === item.originalId);
                    if (foundBill) handleEditBill(foundBill);
                  } else if (isInc) {
                    const foundInc = incomes.find((inc) => inc.id === item.originalId);
                    if (foundInc) handleEditIncome(foundInc);
                  } else if (item.type === 'expense') {
                    const foundExp = expenses.find((exp) => exp.id === item.originalId);
                    if (foundExp) handleEditExpense(foundExp);
                  }
                };

                return (
                  <div
                    key={item.id}
                    onClick={handleTimelineItemClick}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs group ${
                      item.status === 'paid' || item.status === 'received'
                        ? 'bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 opacity-90'
                        : item.status === 'overdue'
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                    title={
                      isBill
                        ? language === 'es'
                          ? 'Clic para abrir y editar la factura'
                          : 'Clique para abrir e editar a fatura'
                        : isInc
                        ? language === 'es'
                          ? 'Clic para abrir y editar el ingreso'
                          : 'Clique para abrir e editar a receita'
                        : language === 'es'
                        ? 'Clic para abrir y editar el gasto'
                        : 'Clique para abrir e editar o gasto'
                    }
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-12 sm:w-14 py-1 px-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-center shrink-0 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] sm:text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase whitespace-nowrap block">
                          {formatDayMonthLabel(item.date, locale)}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.name}
                          </h4>
                          {item.installmentLabel && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 font-mono-numbers shrink-0">
                              {item.installmentLabel}
                            </span>
                          )}
                          {item.isRecurring && !item.installmentLabel && (
                            <span className="text-[9px] font-semibold text-slate-400">
                              ({t.recurringBadge})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="truncate">{item.category}</span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span className="truncate italic text-slate-400 max-w-[150px]">
                                {item.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                            isInc
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isInc ? '+' : '-'}
                          {formatCurrency(Math.abs(item.amount), currency)}
                        </span>
                      </div>

                      {/* Status Toggle Button */}
                      {isInc && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleIncomeReceived(
                              item.originalId,
                              selectedMonth,
                              item.status !== 'received'
                            );
                          }}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                            item.status === 'received'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-emerald-50'
                          }`}
                        >
                          {item.status === 'received' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t.statusReceived}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-blue-500" />
                              <span>{t.statusToReceive}</span>
                            </>
                          )}
                        </button>
                      )}

                      {isBill && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBill(
                              item.originalId,
                              selectedMonth,
                              item.status !== 'paid'
                            );
                          }}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                            item.status === 'paid'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : item.status === 'overdue'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-emerald-50'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-emerald-50'
                          }`}
                        >
                          {item.status === 'paid' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t.statusPaid}</span>
                            </>
                          ) : item.status === 'overdue' ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>{t.statusOverdue}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>{t.statusPending}</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Quick Edit Icon */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTimelineItemClick();
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                        title={t.editItem}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Quick Delete Icon */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isBill) {
                            const foundBill = bills.find((b) => b.id === item.originalId);
                            const billObj = foundBill || ({
                              id: item.originalId,
                              userId: userId || '',
                              name: item.name,
                              amount: Math.abs(item.amount),
                              dueDate: item.date,
                              dueDay: parseInt(item.date.split('-')[2], 10) || 1,
                              category: item.category,
                              notes: item.notes,
                              recurrence: item.isRecurring ? 'monthly' : 'none',
                              recurrenceMonthsCount: 0,
                              startMonth: item.date.substring(0, 7),
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            } as BillItem);
                            handleDeleteBillClick(billObj);
                          } else if (isInc) {
                            if (confirm(`${t.deleteConfirmIncome} "${item.name}"?`)) {
                              deleteIncome(item.originalId);
                            }
                          } else if (item.type === 'expense') {
                            if (confirm(`${t.deleteConfirmExpense} "${item.name}"?`)) {
                              deleteExpense(item.originalId);
                            }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={t.deleteItem}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {item.type === 'expense' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {t.txTypeExpense}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB CONTENT 2: FATURAS DO MÊS */}
      {activeTab === 'bills' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                {t.tabBills} ({formatMonthName(selectedMonth, locale)})
              </h3>
            </div>

            <button
              type="button"
              onClick={() => handleOpenNew('bill')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addBill}</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setBillFilter('pending')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                billFilter === 'pending'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterPending} ({pendingBillsCount})
            </button>
            <button
              type="button"
              onClick={() => setBillFilter('paid')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                billFilter === 'paid'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterPaid} ({paidBillsCount})
            </button>
            <button
              type="button"
              onClick={() => setBillFilter('overdue')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                billFilter === 'overdue'
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterOverdue} ({overdueBillsCount})
            </button>
            <button
              type="button"
              onClick={() => setBillFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                billFilter === 'all'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterAll} ({monthBills.length})
            </button>
          </div>

          {filteredMonthBills.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold">{t.noUpcomingBills}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredMonthBills.map((bOcc) => {
                const bill = bOcc.bill;
                const isPaid = bOcc.status === 'paid';
                const isOverdue = bOcc.status === 'overdue';

                return (
                  <div
                    key={bill.id}
                    onClick={() => handleEditBill(bill)}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs group ${
                      isPaid
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                        : isOverdue
                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                    title={
                      language === 'es'
                        ? 'Clic para abrir y editar datos de la factura'
                        : language === 'en'
                        ? 'Click to open and edit bill details'
                        : 'Clique para abrir e editar dados da fatura'
                    }
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {bill.name}
                        </h4>
                        {bOcc.installmentLabel && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 font-mono-numbers shrink-0">
                            {bOcc.installmentLabel}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {isPaid ? t.statusPaid : isOverdue ? t.statusOverdue : t.statusPending}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{t.dueDateLabel}: {t.dayPrefix} {bill.dueDay} ({bOcc.effectiveDueDate})</span>
                        <span>•</span>
                        <span>{bill.category}</span>
                        <span>•</span>
                        <span>
                          {bill.recurrence === 'monthly'
                            ? bill.recurrenceMonthsCount && bill.recurrenceMonthsCount > 0
                              ? `${t.recurrenceMonthly} (${bill.recurrenceMonthsCount} ${t.monthsQty})`
                              : `${t.recurrenceMonthly} (${t.repeatForever})`
                            : t.recurrenceNone}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-400">
                          {formatCurrency(bill.amount, currency)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBill(bill.id, selectedMonth, !isPaid);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                          isPaid
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isPaid ? t.billPaidCheck : t.markAsPaid}</span>
                      </button>

                      {/* Edit Bill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditBill(bill);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={`${t.editItem} ${t.txTypeBill.toLowerCase()}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Bill with recurring prompt */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBillClick(bill);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={`${t.deleteItem} ${t.txTypeBill.toLowerCase()}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB CONTENT 3: PRÓXIMAS FATURAS (Continuous Scroll) */}
      {activeTab === 'upcoming' && (
        <UpcomingBillsView
          bills={allBillsForUpcoming}
          currency={currency}
          language={language}
          startMonthStr={selectedMonth}
          statusRecords={statusRecords}
          userId={userId}
          onSelectBill={(bill) => handleEditBill(bill)}
          onToggleBillPaid={handleToggleBill}
          onDeleteBillClick={handleDeleteBillClick}
          onNewBill={() => handleOpenNew('bill')}
        />
      )}

      {/* 7. TAB CONTENT 4: RENDAS & A RECEBER */}
      {activeTab === 'incomes' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                {t.tabIncomes} ({formatMonthName(selectedMonth, locale)})
              </h3>
            </div>

            <button
              type="button"
              onClick={() => handleOpenNew('income')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addIncome}</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIncomeFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                incomeFilter === 'all'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.filterAll} ({monthIncomes.length})
            </button>
            <button
              type="button"
              onClick={() => setIncomeFilter('pending')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                incomeFilter === 'pending'
                  ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.statusToReceive} ({pendingIncomesCount})
            </button>
            <button
              type="button"
              onClick={() => setIncomeFilter('received')}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                incomeFilter === 'received'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.statusReceived} ({receivedIncomesCount})
            </button>
          </div>

          {filteredMonthIncomes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold">{t.noUpcomingBills}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredMonthIncomes.map((iOcc) => {
                const inc = iOcc.income;
                const isReceived = iOcc.status === 'received';

                return (
                  <div
                    key={inc.id}
                    onClick={() => handleEditIncome(inc)}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs group ${
                      isReceived
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                    title={
                      language === 'es'
                        ? 'Clic para abrir y editar datos del ingreso'
                        : language === 'en'
                        ? 'Click to open and edit income details'
                        : 'Clique para abrir e editar dados da receita'
                    }
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {inc.name}
                        </h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            isReceived
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {isReceived ? t.statusReceived : t.statusToReceive}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{t.expectedDateLabel}: {t.dayPrefix} {inc.expectedDay} ({iOcc.effectiveDate})</span>
                        <span>•</span>
                        <span>{inc.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(inc.amount, currency)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleIncomeReceived(inc.id, selectedMonth, !isReceived);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                          isReceived
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isReceived ? t.incomeReceivedCheck : t.markAsReceived}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditIncome(inc);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={`${t.editItem} ${t.txTypeIncome.toLowerCase()}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`${t.deleteConfirmIncome} "${inc.name}"?`)) {
                            deleteIncome(inc.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={`${t.deleteItem} ${t.txTypeIncome.toLowerCase()}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 8. TAB CONTENT 5: DESPESAS AVULSAS */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                {t.tabExpenses} ({formatMonthName(selectedMonth, locale)})
              </h3>
            </div>

            <button
              type="button"
              onClick={() => handleOpenNew('expense')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addExpense}</span>
            </button>
          </div>

          {monthExpenses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold">{t.noUpcomingBills}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {monthExpenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => handleEditExpense(exp)}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-xs group transition-all"
                  title={
                    language === 'es'
                      ? 'Clic para abrir y editar datos del gasto'
                      : language === 'en'
                      ? 'Click to open and edit expense details'
                      : 'Clique para abrir e editar dados do gasto'
                  }
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {exp.name}
                      </h4>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {t.statusSingleExpense}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{t.expenseDateLabel}: {exp.date}</span>
                      <span>•</span>
                      <span>{exp.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(exp.amount, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditExpense(exp);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title={t.editExpenseModalTitle}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`${t.deleteConfirmExpense} "${exp.name}"?`)) {
                          deleteExpense(exp.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={t.deleteItem}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. TAB CONTENT 6: GERENCIAMENTO DE CATEGORIAS (Predefined + Custom editable) */}
      {activeTab === 'categories' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReturnToMainFinance}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Volver al Control Financiero' : 'Voltar ao Controle Financeiro'}</span>
          </button>
          <CategoryManager
            language={language}
            allCategories={allDisplayCategories}
            onAddCategory={addCategory}
            onUpdateCategory={updateCategory}
            onDeleteCategory={deleteCategory}
            onResetPredefined={resetPredefinedCategories}
          />
        </div>
      )}

      {/* 10. TAB CONTENT 7: AHORROS (SAVINGS) */}
      {activeTab === 'savings' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReturnToMainFinance}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Volver al Control Financiero' : 'Voltar ao Controle Financeiro'}</span>
          </button>
          <ErrorBoundary fallbackTitle="Error al cargar la sección de Ahorros">
            <SavingsSection
              savings={savings || []}
              transactions={savingTransactions || []}
              currentBalance={currentBalance}
              currency={currency}
              language={language}
              onOpenCreateModal={handleOpenCreateSaving}
              onOpenEditModal={handleOpenEditSaving}
              onOpenTransferModal={handleOpenTransfer}
              onDeleteGoal={deleteSavingGoal}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* 11. TAB CONTENT 8: GRÁFICO DE PIZZA MENSAL POR CATEGORIA */}
      {activeTab === 'report' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReturnToMainFinance}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Volver al Control Financiero' : 'Voltar ao Controle Financeiro'}</span>
          </button>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
            <ErrorBoundary fallbackTitle="Error al generar el gráfico mensual">
              <MonthlyReportSection
                bills={bills || []}
                incomes={incomes || []}
                expenses={expenses || []}
                currency={currency}
                language={language}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* RECURRING BILL DELETE CONFIRMATION MODAL */}
      {billToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.recurringDeletePromptTitle}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    "{billToDelete.name}" • {formatMonthName(selectedMonth, locale)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t.recurringDeletePromptSubtitle}
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isDeletingOccurrence}
                onClick={() => handleApplyRecurrenceDelete('this')}
                className="w-full p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-rose-500 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600">
                  {t.deleteOnlyThisOption}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.deleteOnlyThisDesc}
                </p>
              </button>

              <button
                type="button"
                disabled={isDeletingOccurrence}
                onClick={() => handleApplyRecurrenceDelete('this_and_future')}
                className="w-full p-3 rounded-2xl border-2 border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                  {t.deleteThisAndFutureOption}
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {t.deleteThisAndFutureDesc}
                </p>
              </button>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                disabled={isDeletingOccurrence}
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Breakdown Modal */}
      <BalanceBreakdownModal
        isOpen={isBalanceBreakdownOpen}
        onClose={() => setIsBalanceBreakdownOpen(false)}
        accounts={accounts}
        currency={currency}
        language={language}
        onNavigateToAccounts={onNavigateToAccounts}
      />

      {/* 1. Balance Modal */}
      <BalanceModal
        isOpen={isBalanceOpen}
        onClose={() => setIsBalanceOpen(false)}
        currentBalance={currentBalance}
        currency={currency}
        language={language}
        onSave={updateCurrentBalance}
      />

      {/* 2. Unified Switchable Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        accounts={accounts}
        onOpenNewAccount={onNavigateToAccounts}
        currency={currency}
        language={language}
        selectedMonth={selectedMonth}
        initialType={initialTxType}
        editingTransaction={editingTx}
        getCategoriesFor={getCategoriesFor}
        onAddCategory={addCategory}
        onSaveBill={addBill}
        onUpdateBill={updateBill}
        onUpdateBillOccurrence={updateBillOccurrence}
        onDeleteBill={deleteBill}
        onSaveIncome={async (data) => {
          const res = await addIncome(data);
          if (data.accountDistributions && data.accountDistributions.length > 0) {
            for (const dist of data.accountDistributions) {
              await adjustAccountBalanceForFinancialItem(dist.accountId, +dist.amount);
            }
          } else if (data.accountId) {
            await adjustAccountBalanceForFinancialItem(data.accountId, +data.amount);
          }
          return res;
        }}
        onUpdateIncome={async (id, partial) => {
          const oldInc = incomes.find((i) => i.id === id);
          if (oldInc) {
            if (oldInc.accountDistributions && oldInc.accountDistributions.length > 0) {
              for (const dist of oldInc.accountDistributions) {
                await adjustAccountBalanceForFinancialItem(dist.accountId, -dist.amount);
              }
            } else if (oldInc.accountId) {
              await adjustAccountBalanceForFinancialItem(oldInc.accountId, -oldInc.amount);
            }
          }
          await updateIncome(id, partial);
          const newDists = partial.accountDistributions;
          const newAccountId = partial.accountId;
          const newAmount = partial.amount ?? oldInc?.amount ?? 0;
          if (newDists && newDists.length > 0) {
            for (const dist of newDists) {
              await adjustAccountBalanceForFinancialItem(dist.accountId, +dist.amount);
            }
          } else if (newAccountId) {
            await adjustAccountBalanceForFinancialItem(newAccountId, +newAmount);
          }
        }}
        onDeleteIncome={async (id) => {
          const inc = incomes.find((i) => i.id === id);
          if (inc) {
            if (inc.accountDistributions && inc.accountDistributions.length > 0) {
              for (const dist of inc.accountDistributions) {
                await adjustAccountBalanceForFinancialItem(dist.accountId, -dist.amount);
              }
            } else if (inc.accountId) {
              await adjustAccountBalanceForFinancialItem(inc.accountId, -inc.amount);
            }
          }
          await deleteIncome(id);
        }}
        onSaveExpense={async (data) => {
          const res = await addExpense(data);
          if (data.accountId) {
            await adjustAccountBalanceForFinancialItem(data.accountId, -data.amount);
          }
          return res;
        }}
        onUpdateExpense={async (id, partial) => {
          const oldExp = expenses.find((e) => e.id === id);
          if (oldExp && oldExp.accountId) {
            await adjustAccountBalanceForFinancialItem(oldExp.accountId, +oldExp.amount);
          }
          await updateExpense(id, partial);
          const newAccId = partial.accountId !== undefined ? partial.accountId : oldExp?.accountId;
          const newAmt = partial.amount !== undefined ? partial.amount : oldExp?.amount ?? 0;
          if (newAccId) {
            await adjustAccountBalanceForFinancialItem(newAccId, -newAmt);
          }
        }}
        onDeleteExpense={async (id) => {
          const exp = expenses.find((e) => e.id === id);
          if (exp && exp.accountId) {
            await adjustAccountBalanceForFinancialItem(exp.accountId, +exp.amount);
          }
          await deleteExpense(id);
        }}
        activePartners={activePartners}
        onShareWithPartner={onShareWithPartner}
      />

      {/* 3. Saving Goal Modal (Create / Edit) */}
      <SavingGoalModal
        isOpen={isSavingGoalModalOpen}
        onClose={() => {
          setIsSavingGoalModalOpen(false);
          setSavingGoalToEdit(null);
        }}
        onSave={async (data) => {
          if (savingGoalToEdit) {
            await updateSavingGoal(savingGoalToEdit.id, data);
          } else {
            await createSavingGoal(data);
          }
        }}
        goalToEdit={savingGoalToEdit}
        currency={currency}
        language={language}
      />

      {/* 4. Transfer Modal (Available Balance <-> Savings Goals) */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        savings={savings}
        currentBalance={currentBalance}
        currency={currency}
        language={language}
        defaultSavingId={transferDefaultSavingId}
        defaultType={transferDefaultType}
        onTransferToSaving={handleExecuteTransfer}
        onWithdrawFromSaving={handleExecuteWithdrawal}
        onOpenCreateSaving={handleOpenCreateSaving}
      />
    </div>
  );
};
