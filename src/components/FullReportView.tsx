/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  IncomeItem,
  ExpenseItem,
  MonthlyStatusRecord,
  SharedBill,
  SharedTransferRecord,
  SharedUserSummary,
} from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  shiftMonthStr,
  getCurrentMonthStr,
  getTodayStr,
  formatDayMonthLabel,
  formatMonthName,
} from '../utils/finance';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PieChart as PieChartIcon,
  ArrowRightLeft,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Tag,
  Sparkles,
  Info,
  Layers,
  HelpCircle,
  Printer,
} from 'lucide-react';

interface FullReportViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[];
  sharedBills: SharedBill[];
  sharedTransfers: SharedTransferRecord[];
  activePartners: SharedUserSummary[];
  myUserId: string;
  onReturnToFinance: () => void;
}

export const FullReportView: React.FC<FullReportViewProps> = ({
  currency,
  language = 'pt',
  bills,
  incomes,
  expenses,
  statusRecords,
  sharedBills,
  sharedTransfers,
  activePartners,
  myUserId,
  onReturnToFinance,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const todayStr = useMemo(() => getTodayStr(), []);

  // Filter mode: 'monthly' | 'custom'
  const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');

  // Monthly mode state
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());

  // Custom range mode state
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${getCurrentMonthStr()}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Detail Modal for Timeline items
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  // Expandable Debt Detail Modal
  const [selectedDebtDetail, setSelectedDebtDetail] = useState<{
    type: 'owedToMe' | 'iOwe';
    items: { partnerName: string; billTitle: string; month: string; amount: number }[];
  } | null>(null);

  // Effective date range calculation
  const dateRange = useMemo(() => {
    if (filterMode === 'monthly') {
      const start = `${selectedMonth}-01`;
      // Calculate last day of month
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, isMonthly: true };
    } else {
      return {
        start: customStartDate || '2000-01-01',
        end: customEndDate || '2099-12-31',
        isMonthly: false,
      };
    }
  }, [filterMode, selectedMonth, customStartDate, customEndDate]);

  // Index status records for fast lookup
  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    for (const rec of statusRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [statusRecords]);

  // Determine months involved in date range
  const monthsInRange = useMemo(() => {
    const startM = dateRange.start.slice(0, 7);
    const endM = dateRange.end.slice(0, 7);
    const months: string[] = [];
    let curr = startM;
    while (curr <= endM) {
      months.push(curr);
      curr = shiftMonthStr(curr, 1);
    }
    return months;
  }, [dateRange]);

  // 1. EVALUATE ALL INCOMES IN RANGE
  const rangeIncomes = useMemo(() => {
    const list: {
      id: string;
      title: string;
      amount: number;
      date: string;
      category: string;
      status: 'received' | 'pending';
      notes?: string;
    }[] = [];

    for (const inc of incomes) {
      for (const m of monthsInRange) {
        if (doesItemOccurInMonth(inc.startMonth, m, inc.recurrence, inc.recurrenceMonthsCount)) {
          const exception = inc.exceptions?.[m];
          if (exception?.isDeleted || inc.excludedMonths?.includes(m)) continue;

          const effectiveDay = exception?.expectedDay ?? inc.expectedDay;
          const effectiveDate = exception?.expectedDate ?? getEffectiveDateForMonth(m, effectiveDay);

          if (effectiveDate >= dateRange.start && effectiveDate <= dateRange.end) {
            const recordKey = `income_${inc.id}_${m}`;
            const isReceived = statusMap.get(recordKey)?.isCompleted === true;
            list.push({
              id: `inc_${inc.id}_${m}`,
              title: exception?.name ?? inc.name,
              amount: exception?.amount ?? inc.amount,
              date: effectiveDate,
              category: exception?.category ?? inc.category,
              status: isReceived ? 'received' : 'pending',
              notes: exception?.notes !== undefined ? exception.notes : inc.notes,
            });
          }
        }
      }
    }
    return list;
  }, [incomes, monthsInRange, dateRange, statusMap]);

  // 2. EVALUATE ALL PERSONAL BILLS IN RANGE
  const rangePersonalBills = useMemo(() => {
    const list: {
      id: string;
      title: string;
      amount: number;
      date: string;
      category: string;
      status: 'paid' | 'overdue' | 'pending';
      notes?: string;
    }[] = [];

    for (const bill of bills) {
      for (const m of monthsInRange) {
        if (doesItemOccurInMonth(bill.startMonth, m, bill.recurrence, bill.recurrenceMonthsCount)) {
          const exception = bill.exceptions?.[m];
          if (exception?.isDeleted || bill.excludedMonths?.includes(m)) continue;

          const effectiveDay = exception?.dueDay ?? bill.dueDay;
          const effectiveDate = exception?.dueDate ?? getEffectiveDateForMonth(m, effectiveDay);

          if (effectiveDate >= dateRange.start && effectiveDate <= dateRange.end) {
            const recordKey = `bill_${bill.id}_${m}`;
            const isPaid = statusMap.get(recordKey)?.isCompleted === true;

            let status: 'paid' | 'overdue' | 'pending';
            if (isPaid) {
              status = 'paid';
            } else if (effectiveDate < todayStr) {
              status = 'overdue';
            } else {
              status = 'pending';
            }

            list.push({
              id: `bill_${bill.id}_${m}`,
              title: exception?.name ?? bill.name,
              amount: exception?.amount ?? bill.amount,
              date: effectiveDate,
              category: exception?.category ?? bill.category,
              status,
              notes: exception?.notes !== undefined ? exception.notes : bill.notes,
            });
          }
        }
      }
    }
    return list;
  }, [bills, monthsInRange, dateRange, statusMap, todayStr]);

  // 3. EVALUATE ALL ONE-OFF EXPENSES IN RANGE
  const rangeExpenses = useMemo(() => {
    return expenses
      .filter((exp) => exp.date >= dateRange.start && exp.date <= dateRange.end)
      .map((exp) => ({
        id: exp.id,
        title: exp.name,
        amount: exp.amount,
        date: exp.date,
        category: exp.category,
        status: 'paid' as const,
        notes: exp.notes,
      }));
  }, [expenses, dateRange]);

  // 4. EVALUATE ALL SHARED BILLS IN RANGE (No double counting)
  const rangeSharedBillsDetailed = useMemo(() => {
    const list: {
      bill: SharedBill;
      month: string;
      effectiveDueDate: string;
      totalAmount: number;
      myShareAmount: number;
      partnerShareAmount: number;
      myPercentage: number;
      partnerPercentage: number;
      partnerName: string;
      partnerId: string;
      isPaidToCreditor: boolean;
      paidByUserId: string | null;
      paidByUserName: string;
      myStatus: 'paid' | 'overdue' | 'pending';
      reimbursement: {
        fromUserId: string;
        toUserId: string;
        amount: number;
        status: 'pending' | 'settled';
      } | null;
    }[] = [];

    for (const sb of sharedBills) {
      const startMonthFallback =
        sb.startMonth || sb.month || (sb.dueDate ? sb.dueDate.substring(0, 7) : '');

      for (const m of monthsInRange) {
        if (
          doesItemOccurInMonth(
            startMonthFallback,
            m,
            sb.recurrence || 'none',
            sb.recurrenceMonthsCount
          )
        ) {
          const mEx = sb.exceptions?.[m];
          if (mEx?.isDeleted || sb.excludedMonths?.includes(m)) continue;
          if (sb.shareRequest?.status === 'rejected') continue;

          const effectiveDueDay = sb.dueDay || 1;
          const effectiveDueDate = getEffectiveDateForMonth(m, effectiveDueDay);

          if (effectiveDueDate >= dateRange.start && effectiveDueDate <= dateRange.end) {
            const partnerId = sb.members.find((id) => id !== myUserId) || '';
            const partnerSummary = activePartners.find((p) => p.uid === partnerId);
            const partnerName = partnerSummary?.displayName || 'Parceiro';

            const myPercentage = sb.percentages?.[myUserId] ?? 50;
            const partnerPercentage = sb.percentages?.[partnerId] ?? 50;

            const myShareAmount =
              sb.shares?.[myUserId]?.amount !== undefined && !isNaN(sb.shares[myUserId].amount)
                ? sb.shares[myUserId].amount
                : Math.round((sb.amount * myPercentage) / 100);

            const partnerShareAmount = sb.amount - myShareAmount;

            const isPaidToCreditor =
              mEx?.status === 'paid' || (sb.recurrence === 'none' && sb.status === 'paid');
            const paidByUserId = mEx?.paidBy || (sb.recurrence === 'none' ? sb.paidBy : null) || null;
            const paidByUserName =
              paidByUserId === myUserId
                ? 'Você'
                : paidByUserId === partnerId
                ? partnerName
                : 'Pendente';

            const rawReimbursement = mEx?.reimbursement || (sb.recurrence === 'none' ? sb.reimbursement : null);
            const reimbursement = rawReimbursement ? {
              fromUserId: rawReimbursement.fromUserId,
              toUserId: rawReimbursement.toUserId,
              amount: rawReimbursement.amount,
              status: rawReimbursement.status,
            } : null;

            let myStatus: 'paid' | 'overdue' | 'pending' = 'pending';

            if (isPaidToCreditor) {
              if (reimbursement && reimbursement.status === 'pending') {
                if (reimbursement.fromUserId === myUserId) {
                  const recordKey = `bill_sb_${sb.id}_${m}`;
                  const isRecordPaid = statusMap.get(recordKey)?.isCompleted === true;
                  myStatus = isRecordPaid
                    ? 'paid'
                    : effectiveDueDate < todayStr
                    ? 'overdue'
                    : 'pending';
                } else {
                  myStatus = 'paid';
                }
              } else {
                myStatus = 'paid';
              }
            } else {
              const recordKey = `bill_sb_${sb.id}_${m}`;
              const isRecordPaid = statusMap.get(recordKey)?.isCompleted === true;
              const isSharePaid =
                isRecordPaid ||
                sb.shares?.[myUserId]?.status === 'transferred' ||
                sb.shares?.[myUserId]?.status === 'paid' ||
                mEx?.shares?.[myUserId]?.status === 'paid' ||
                mEx?.shares?.[myUserId]?.status === 'transferred';

              if (isSharePaid) {
                myStatus = 'paid';
              } else {
                myStatus = effectiveDueDate < todayStr ? 'overdue' : 'pending';
              }
            }

            list.push({
              bill: sb,
              month: m,
              effectiveDueDate,
              totalAmount: sb.amount,
              myShareAmount,
              partnerShareAmount,
              myPercentage,
              partnerPercentage,
              partnerName,
              partnerId,
              isPaidToCreditor,
              paidByUserId,
              paidByUserName,
              myStatus,
              reimbursement,
            });
          }
        }
      }
    }

    return list.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate));
  }, [sharedBills, monthsInRange, dateRange, myUserId, activePartners, statusMap, todayStr]);

  // 5. RESUMEN GENERAL CALCULATIONS
  // Ingresos Recibidos (real cash in)
  const totalReceivedIncomes = useMemo(() => {
    return rangeIncomes
      .filter((i) => i.status === 'received')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [rangeIncomes]);

  // Dinero Todavía por Recibir
  const totalPendingIncomes = useMemo(() => {
    return rangeIncomes
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [rangeIncomes]);

  // Gastos Pagados (Avulsos + Reembolsos liquidados ejecutados)
  const totalPaidOneOffExpenses = useMemo(() => {
    return rangeExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [rangeExpenses]);

  // Facturas Personales Pagadas
  const totalPaidPersonalBills = useMemo(() => {
    return rangePersonalBills
      .filter((b) => b.status === 'paid')
      .reduce((sum, b) => sum + b.amount, 0);
  }, [rangePersonalBills]);

  // Total Facturas Pagadas (Personales + Cuotas Compartidas pagadas si aplican)
  const totalPaidBillsCount = useMemo(() => {
    const personalCount = rangePersonalBills.filter((b) => b.status === 'paid').length;
    const sharedCount = rangeSharedBillsDetailed.filter((sb) => sb.myStatus === 'paid').length;
    return personalCount + sharedCount;
  }, [rangePersonalBills, rangeSharedBillsDetailed]);

  // Total Gastos Realizados en el período (Gasto real de caja)
  const totalSpentPeriod = useMemo(() => {
    return totalPaidOneOffExpenses + totalPaidPersonalBills;
  }, [totalPaidOneOffExpenses, totalPaidPersonalBills]);

  // Total Todavía Pendiente de Pago
  const totalPendingPayment = useMemo(() => {
    const personalPending = rangePersonalBills
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + b.amount, 0);

    const sharedPending = rangeSharedBillsDetailed
      .filter((sb) => sb.myStatus === 'pending')
      .reduce((sum, sb) => {
        if (sb.reimbursement && sb.reimbursement.status === 'pending') {
          return sum + (sb.reimbursement.fromUserId === myUserId ? sb.reimbursement.amount : 0);
        }
        return sum + sb.myShareAmount;
      }, 0);

    return personalPending + sharedPending;
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  // Total Vencido
  const totalOverduePayment = useMemo(() => {
    const personalOverdue = rangePersonalBills
      .filter((b) => b.status === 'overdue')
      .reduce((sum, b) => sum + b.amount, 0);

    const sharedOverdue = rangeSharedBillsDetailed
      .filter((sb) => sb.myStatus === 'overdue')
      .reduce((sum, sb) => {
        if (sb.reimbursement && sb.reimbursement.status === 'pending') {
          return sum + (sb.reimbursement.fromUserId === myUserId ? sb.reimbursement.amount : 0);
        }
        return sum + sb.myShareAmount;
      }, 0);

    return personalOverdue + sharedOverdue;
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  // Saldo / Resultante do Período
  const netResultPeriod = useMemo(() => {
    return totalReceivedIncomes - totalSpentPeriod;
  }, [totalReceivedIncomes, totalSpentPeriod]);

  // 6. QUIÉN ME DEBE / A QUIÉN DEBO
  const debtSummary = useMemo(() => {
    let owedToMeTotal = 0;
    let iOweTotal = 0;
    const owedToMeItems: { partnerName: string; billTitle: string; month: string; amount: number }[] = [];
    const iOweItems: { partnerName: string; billTitle: string; month: string; amount: number }[] = [];

    // Check all active shared bills across system for active pending reimbursements
    for (const sb of sharedBills) {
      const partnerId = sb.members.find((id) => id !== myUserId) || '';
      const partnerSummary = activePartners.find((p) => p.uid === partnerId);
      const partnerName = partnerSummary?.displayName || 'Parceiro';

      // Check root level legacy reimbursement
      if (sb.reimbursement && sb.reimbursement.status === 'pending') {
        const r = sb.reimbursement;
        const m = sb.month || sb.dueDate?.substring(0, 7) || 'Geral';
        if (r.toUserId === myUserId) {
          owedToMeTotal += r.amount;
          owedToMeItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
        } else if (r.fromUserId === myUserId) {
          iOweTotal += r.amount;
          iOweItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
        }
      }

      // Check exceptions
      if (sb.exceptions) {
        for (const [m, ex] of Object.entries(sb.exceptions)) {
          if (ex.reimbursement && ex.reimbursement.status === 'pending') {
            const r = ex.reimbursement;
            if (r.toUserId === myUserId) {
              owedToMeTotal += r.amount;
              owedToMeItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
            } else if (r.fromUserId === myUserId) {
              iOweTotal += r.amount;
              iOweItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
            }
          }
        }
      }
    }

    return {
      owedToMeTotal,
      iOweTotal,
      owedToMeItems,
      iOweItems,
    };
  }, [sharedBills, myUserId, activePartners]);

  // 7. CHRONOLOGICAL COMBINED TIMELINE
  const combinedTimeline = useMemo(() => {
    const list: {
      id: string;
      type: 'income' | 'personal_bill' | 'expense' | 'shared_bill';
      title: string;
      amount: number;
      date: string;
      category: string;
      status: 'paid' | 'received' | 'pending' | 'overdue';
      isShared: boolean;
      notes?: string;
    }[] = [];

    // Incomes
    for (const inc of rangeIncomes) {
      list.push({
        id: inc.id,
        type: 'income',
        title: inc.title,
        amount: inc.amount,
        date: inc.date,
        category: inc.category,
        status: inc.status === 'received' ? 'received' : 'pending',
        isShared: false,
        notes: inc.notes,
      });
    }

    // Personal Bills
    for (const pb of rangePersonalBills) {
      list.push({
        id: pb.id,
        type: 'personal_bill',
        title: pb.title,
        amount: -pb.amount,
        date: pb.date,
        category: pb.category,
        status: pb.status,
        isShared: false,
        notes: pb.notes,
      });
    }

    // One-off Expenses
    for (const exp of rangeExpenses) {
      list.push({
        id: exp.id,
        type: 'expense',
        title: exp.title,
        amount: -exp.amount,
        date: exp.date,
        category: exp.category,
        status: 'paid',
        isShared: false,
        notes: exp.notes,
      });
    }

    // Shared Bills (User's actual responsibility)
    for (const sb of rangeSharedBillsDetailed) {
      let obligation = sb.myShareAmount;
      if (sb.reimbursement && sb.reimbursement.status === 'pending' && sb.reimbursement.fromUserId === myUserId) {
        obligation = sb.reimbursement.amount;
      }
      list.push({
        id: `sb_${sb.bill.id}_${sb.month}`,
        type: 'shared_bill',
        title: `[Compartilhada] ${sb.bill.title}`,
        amount: -obligation,
        date: sb.effectiveDueDate,
        category: sb.bill.category || 'Contas Compartilhadas',
        status: sb.myStatus,
        isShared: true,
        notes: sb.bill.notes,
      });
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [rangeIncomes, rangePersonalBills, rangeExpenses, rangeSharedBillsDetailed, myUserId]);

  // 8. CATEGORY BREAKDOWN (Paid/Realized Expenses ONLY)
  const categoryBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    // 1. One-off Expenses
    for (const exp of rangeExpenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    }

    // 2. Personal Paid Bills
    for (const pb of rangePersonalBills) {
      if (pb.status === 'paid') {
        categoryTotals[pb.category] = (categoryTotals[pb.category] || 0) + pb.amount;
      }
    }

    const totalCategorySpent = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

    const list = Object.entries(categoryTotals).map(([cat, amount]) => {
      const percent = totalCategorySpent > 0 ? Math.round((amount / totalCategorySpent) * 100) : 0;
      return { category: cat, amount, percent };
    });

    return {
      list: list.sort((a, b) => b.amount - a.amount),
      totalCategorySpent,
    };
  }, [rangeExpenses, rangePersonalBills]);

  // 9. PENDENTES Y VENCIDOS SECTIONS
  const pendingItemsList = useMemo(() => {
    const list: { title: string; dueDate: string; amount: number; isShared: boolean }[] = [];

    for (const pb of rangePersonalBills) {
      if (pb.status === 'pending') {
        list.push({ title: pb.title, dueDate: pb.date, amount: pb.amount, isShared: false });
      }
    }

    for (const sb of rangeSharedBillsDetailed) {
      if (sb.myStatus === 'pending') {
        const amt =
          sb.reimbursement?.status === 'pending' && sb.reimbursement.fromUserId === myUserId
            ? sb.reimbursement.amount
            : sb.myShareAmount;
        list.push({
          title: `[Compartilhada] ${sb.bill.title}`,
          dueDate: sb.effectiveDueDate,
          amount: amt,
          isShared: true,
        });
      }
    }

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  const overdueItemsList = useMemo(() => {
    const list: { title: string; dueDate: string; amount: number; isShared: boolean }[] = [];

    for (const pb of rangePersonalBills) {
      if (pb.status === 'overdue') {
        list.push({ title: pb.title, dueDate: pb.date, amount: pb.amount, isShared: false });
      }
    }

    for (const sb of rangeSharedBillsDetailed) {
      if (sb.myStatus === 'overdue') {
        const amt =
          sb.reimbursement?.status === 'pending' && sb.reimbursement.fromUserId === myUserId
            ? sb.reimbursement.amount
            : sb.myShareAmount;
        list.push({
          title: `[Compartilhada] ${sb.bill.title}`,
          dueDate: sb.effectiveDueDate,
          amount: amt,
          isShared: true,
        });
      }
    }

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  // 10. MONTH-OVER-MONTH COMPARISON (When Monthly Filter is Active)
  const monthComparison = useMemo(() => {
    if (filterMode !== 'monthly') return null;

    const prevMonth = shiftMonthStr(selectedMonth, -1);
    const [y, m] = prevMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const prevStart = `${prevMonth}-01`;
    const prevEnd = `${prevMonth}-${String(lastDay).padStart(2, '0')}`;

    // Compute prev month incomes
    let prevIncomesTotal = 0;
    for (const inc of incomes) {
      if (doesItemOccurInMonth(inc.startMonth, prevMonth, inc.recurrence, inc.recurrenceMonthsCount)) {
        const ex = inc.exceptions?.[prevMonth];
        if (!ex?.isDeleted && !inc.excludedMonths?.includes(prevMonth)) {
          const isRec = statusMap.get(`income_${inc.id}_${prevMonth}`)?.isCompleted === true;
          if (isRec) prevIncomesTotal += ex?.amount ?? inc.amount;
        }
      }
    }

    // Compute prev month expenses (avulsas + personal paid bills)
    let prevExpensesTotal = 0;
    for (const exp of expenses) {
      if (exp.date >= prevStart && exp.date <= prevEnd) {
        prevExpensesTotal += exp.amount;
      }
    }
    for (const pb of bills) {
      if (doesItemOccurInMonth(pb.startMonth, prevMonth, pb.recurrence, pb.recurrenceMonthsCount)) {
        const ex = pb.exceptions?.[prevMonth];
        if (!ex?.isDeleted && !pb.excludedMonths?.includes(prevMonth)) {
          const isPaid = statusMap.get(`bill_${pb.id}_${prevMonth}`)?.isCompleted === true;
          if (isPaid) prevExpensesTotal += ex?.amount ?? pb.amount;
        }
      }
    }

    // Compute prev month pending total
    let prevPendingTotal = 0;
    for (const pb of bills) {
      if (doesItemOccurInMonth(pb.startMonth, prevMonth, pb.recurrence, pb.recurrenceMonthsCount)) {
        const ex = pb.exceptions?.[prevMonth];
        if (!ex?.isDeleted && !pb.excludedMonths?.includes(prevMonth)) {
          const isPaid = statusMap.get(`bill_${pb.id}_${prevMonth}`)?.isCompleted === true;
          if (!isPaid) prevPendingTotal += ex?.amount ?? pb.amount;
        }
      }
    }

    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return null;
      const diff = ((curr - prev) / prev) * 100;
      return Math.round(diff);
    };

    return {
      prevMonthName: formatMonthName(prevMonth, locale),
      incomesChangePct: calcChange(totalReceivedIncomes, prevIncomesTotal),
      expensesChangePct: calcChange(totalSpentPeriod, prevExpensesTotal),
      pendingChangePct: calcChange(totalPendingPayment, prevPendingTotal),
      hasData: prevIncomesTotal > 0 || prevExpensesTotal > 0 || prevPendingTotal > 0,
    };
  }, [
    filterMode,
    selectedMonth,
    incomes,
    expenses,
    bills,
    statusMap,
    locale,
    totalReceivedIncomes,
    totalSpentPeriod,
    totalPendingPayment,
  ]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReturnToFinance}
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer print:hidden"
            title="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.fullReportTitle || 'Informe Financiero'}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] print:hidden">
                {t.readOnlyBadge || 'Lectura Análitica'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.fullReportSubtitle ||
                'Informe completo consolidado con datos personales y cuentas compartidas.'}
            </p>
          </div>
        </div>

        {/* Action Button: Print Report */}
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto print:hidden"
          title={language === 'es' ? 'Imprimir o guardar como PDF' : language === 'en' ? 'Print or save as PDF' : 'Imprimir ou salvar como PDF'}
        >
          <Printer className="w-4 h-4" />
          <span>{language === 'es' ? 'Imprimir Informe' : language === 'en' ? 'Print Report' : 'Imprimir Relatório'}</span>
        </button>
      </div>

      {/* SECTION 1: FILTRO DEL INFORME */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {t.reportFilterTitle || 'Período del Informe'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setFilterMode('monthly')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.filterMonthlyLabel || 'Mensual'}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('custom')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.filterCustomRangeLabel || 'Período Personalizado'}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap">
          {filterMode === 'monthly' ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">
                {t.selectMonthLabel || 'Seleccionar mes:'}
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500">
                  {t.startDateLabel || 'Desde:'}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500">
                  {t.endDateLabel || 'Hasta:'}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="ml-auto text-[11px] text-slate-400 font-mono-numbers">
            Range: {dateRange.start} → {dateRange.end}
          </div>
        </div>
      </div>

      {/* SECTION 2: RESUMEN GENERAL (KPI Cards) */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
          {t.generalSummaryTitle || 'Resumen General del Período'}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {/* Card 1: Ingresos Recibidos */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 space-y-1">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.receivedIncomesLabel || 'Ingresos Recibidos'}
              </span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono-numbers">
              +{formatCurrency(totalReceivedIncomes, currency)}
            </div>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block">
              {rangeIncomes.filter((i) => i.status === 'received').length} recibidos
            </span>
          </div>

          {/* Card 2: Gastos Pagados */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 space-y-1">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-300">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.paidExpensesLabel || 'Gastos Pagados'}
              </span>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div className="text-base sm:text-xl font-black text-rose-700 dark:text-rose-300 font-mono-numbers">
              -{formatCurrency(totalSpentPeriod, currency)}
            </div>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 block">
              Efectivamente ejecutados
            </span>
          </div>

          {/* Card 3: Facturas Pagadas */}
          <div className="p-3.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800/80 space-y-1">
            <div className="flex items-center justify-between text-teal-800 dark:text-teal-300">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.paidBillsLabel || 'Facturas Pagadas'}
              </span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-base sm:text-xl font-black text-teal-700 dark:text-teal-300 font-mono-numbers">
              {totalPaidBillsCount} {totalPaidBillsCount === 1 ? 'fatura' : 'faturas'}
            </div>
            <span className="text-[10px] text-teal-600/80 dark:text-teal-400/80 block">
              {formatCurrency(totalPaidPersonalBills, currency)} en personales
            </span>
          </div>

          {/* Card 4: Pendiente de Pago */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 space-y-1">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.totalPendingLabel || 'Pendiente de Pago'}
              </span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-base sm:text-xl font-black text-amber-700 dark:text-amber-300 font-mono-numbers">
              {formatCurrency(totalPendingPayment, currency)}
            </div>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block">
              En plazo
            </span>
          </div>

          {/* Card 5: Total Vencido */}
          <div className="p-3.5 rounded-2xl bg-rose-600/15 dark:bg-rose-950/60 border border-rose-400 dark:border-rose-800 space-y-1">
            <div className="flex items-center justify-between text-rose-900 dark:text-rose-200">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.totalOverdueLabel || 'Total Vencido'}
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-base sm:text-xl font-black text-rose-800 dark:text-rose-200 font-mono-numbers">
              {formatCurrency(totalOverduePayment, currency)}
            </div>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-300/80 block font-bold">
              Plazo expirado
            </span>
          </div>

          {/* Card 6: Dinero por Recibir */}
          <div className="p-3.5 rounded-2xl bg-blue-500/10 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/80 space-y-1">
            <div className="flex items-center justify-between text-blue-800 dark:text-blue-300">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.pendingIncomesLabel || 'Por Recibir'}
              </span>
              <Wallet className="w-4 h-4" />
            </div>
            <div className="text-base sm:text-xl font-black text-blue-700 dark:text-blue-300 font-mono-numbers">
              +{formatCurrency(totalPendingIncomes, currency)}
            </div>
            <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 block">
              Programado
            </span>
          </div>

          {/* Card 7: Saldo / Resultante del Período */}
          <div
            className={`p-3.5 rounded-2xl border space-y-1 col-span-2 sm:col-span-1 lg:col-span-2 ${
              netResultPeriod >= 0
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                {t.netResultLabel || 'Resultante del Período'}
              </span>
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-lg sm:text-2xl font-black font-mono-numbers">
              {formatCurrency(netResultPeriod, currency)}
            </div>
            <span className="text-[10px] opacity-80 block">
              {netResultPeriod >= 0 ? 'Resultado Positivo' : 'Déficit del Período'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: SECCIÓN "PENDIENTES Y VENCIDOS" */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {t.pendingAndOverdueTitle || 'Pendientes y Vencidos del Período'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subcard: Pendientes */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{t.statusPending || 'Pendientes'} ({pendingItemsList.length})</span>
              </span>
              <span className="text-xs font-mono-numbers font-black text-amber-700 dark:text-amber-300">
                {formatCurrency(
                  pendingItemsList.reduce((s, i) => s + i.amount, 0),
                  currency
                )}
              </span>
            </div>

            {pendingItemsList.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">
                {t.noPendingInPeriod || 'Sin facturas pendientes para este período.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {pendingItemsList.map((item, idx) => (
                  <div
                    key={`pend_${idx}`}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Vencimiento: {item.dueDate}
                      </span>
                    </div>
                    <span className="font-mono-numbers font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subcard: Vencidos */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-rose-50/30 dark:bg-rose-950/20">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t.statusOverdue || 'Vencidos'} ({overdueItemsList.length})</span>
              </span>
              <span className="text-xs font-mono-numbers font-black text-rose-700 dark:text-rose-300">
                {formatCurrency(
                  overdueItemsList.reduce((s, i) => s + i.amount, 0),
                  currency
                )}
              </span>
            </div>

            {overdueItemsList.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">
                {t.noOverdueInPeriod || '¡Excelente! Sin facturas vencidas en este período.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {overdueItemsList.map((item, idx) => (
                  <div
                    key={`over_${idx}`}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-rose-900 dark:text-rose-200 block truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-rose-500 font-semibold">
                        Expiró el: {item.dueDate}
                      </span>
                    </div>
                    <span className="font-mono-numbers font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: LÍNEA DE TIEMPO (Cronología completa) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {t.timelineSectionTitle || 'Línea de Tiempo del Período'}
            </h3>
          </div>
          <span className="text-[11px] font-mono-numbers text-slate-400">
            {combinedTimeline.length} lançamentos
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-bold flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 🟢 Pagado / Recibido
          </span>
          <span className="flex items-center gap-1 text-amber-600">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 🟡 Pendiente
          </span>
          <span className="flex items-center gap-1 text-rose-600">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> 🔴 Vencido
          </span>
          <span className="flex items-center gap-1 text-blue-600">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> 🔵 Ingreso / Por Recibir
          </span>
          <span className="flex items-center gap-1 text-purple-600">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> 🟣 Cuenta Compartida
          </span>
        </div>

        {combinedTimeline.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-1">
            <Receipt className="w-8 h-8 mx-auto opacity-30" />
            <p>{t.noMovementsInPeriod || 'Ningún movimiento registrado en este período.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {combinedTimeline.map((item) => {
              const isPositive = item.amount > 0;

              // Color badge logic:
              let badgeBg = '';
              let badgeText = '';
              let badgeIcon = null;

              if (item.status === 'received') {
                badgeBg = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300';
                badgeText = t.statusReceived || 'Recibido';
                badgeIcon = <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
              } else if (item.status === 'paid') {
                badgeBg = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300';
                badgeText = t.statusPaid || 'Pagado';
                badgeIcon = <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
              } else if (item.status === 'overdue') {
                badgeBg = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300';
                badgeText = t.statusOverdue || 'Vencido';
                badgeIcon = <AlertTriangle className="w-3 h-3 text-rose-600" />;
              } else if (item.type === 'income') {
                badgeBg = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300';
                badgeText = t.statusToReceive || 'Por Recibir';
                badgeIcon = <Clock className="w-3 h-3 text-blue-500" />;
              } else {
                badgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';
                badgeText = t.statusPending || 'Pendiente';
                badgeIcon = <Clock className="w-3 h-3 text-amber-500" />;
              }

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailItem(item)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 group ${
                    item.isShared
                      ? 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-center shrink-0 border border-slate-300/60 dark:border-slate-700">
                      <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 block uppercase">
                        {formatDayMonthLabel(item.date, locale)}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                          {item.title}
                        </span>
                        {item.isShared && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 text-[9px] font-bold border border-purple-300 dark:border-purple-800">
                            Compartida
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{item.category}</span>
                        {item.notes && <span className="truncate italic">({item.notes})</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-black font-mono-numbers ${
                        isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(item.amount, currency)}
                    </span>

                    <div
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${badgeBg}`}
                    >
                      {badgeIcon}
                      <span>{badgeText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 5: CUENTAS COMPARTIDAS (Detalle Específico) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {t.sharedAccountsReportTitle || 'Detalle de Cuentas Compartidas'}
          </h3>
        </div>

        {rangeSharedBillsDetailed.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            {t.noSharedBillsInPeriod || 'No hay facturas compartidas registradas en este período.'}
          </p>
        ) : (
          <div className="space-y-3">
            {rangeSharedBillsDetailed.map((item) => {
              const reimb = item.reimbursement;
              const isSettled = reimb?.status === 'settled';
              const isReimbPending = reimb?.status === 'pending';

              return (
                <div
                  key={`shared_rep_${item.bill.id}_${item.month}`}
                  className="p-3.5 sm:p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/20 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap border-b border-purple-100 dark:border-purple-900/40 pb-2">
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm block">
                        {item.bill.title}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Mes: {item.month} • Vencimiento: {item.effectiveDueDate}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-sans">
                        Valor Total Factura:
                      </span>
                      <span className="text-sm font-black font-mono-numbers text-slate-900 dark:text-white">
                        {formatCurrency(item.totalAmount, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Mi Parte ({item.myPercentage}%):
                      </span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono-numbers">
                        {formatCurrency(item.myShareAmount, currency)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {item.partnerName} ({item.partnerPercentage}%):
                      </span>
                      <strong className="text-slate-700 dark:text-slate-300 font-mono-numbers">
                        {formatCurrency(item.partnerShareAmount, currency)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Pagó al Acreedor:
                      </span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {item.paidByUserName}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Mi Estado:
                      </span>
                      <span
                        className={`font-bold ${
                          item.myStatus === 'paid'
                            ? 'text-emerald-600'
                            : item.myStatus === 'overdue'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {item.myStatus === 'paid'
                          ? 'PAGADO'
                          : item.myStatus === 'overdue'
                          ? 'VENCIDO'
                          : 'PENDIENTE'}
                      </span>
                    </div>
                  </div>

                  {/* Full Pay & Reimbursement Details */}
                  {item.isPaidToCreditor && (
                    <div className="p-2.5 rounded-xl bg-purple-100/60 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-2 text-[11px] flex-wrap">
                      <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200">
                        <Info className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                        <span>
                          {item.paidByUserId === myUserId
                            ? `Pagaste los $${item.totalAmount.toLocaleString()} al establecimiento. ${
                                item.partnerName
                              } te debe $${item.partnerShareAmount.toLocaleString()} de reembolso.`
                            : `${
                                item.partnerName
                              } pagó los $${item.totalAmount.toLocaleString()} al establecimiento.`}
                        </span>
                      </div>

                      {reimb && (
                        <div className="font-bold">
                          {isSettled ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px]">
                              REEMBOLSO LIQUIDADO
                            </span>
                          ) : isReimbPending ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px]">
                              REEMBOLSO PENDIENTE ({formatCurrency(reimb.amount, currency)})
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 6: "QUIÉN ME DEBE / A QUIÉN DEBO" */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {t.whoOwesSectionTitle || '¿Quién me debe? / ¿A quién debo?'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card: Me deben */}
          <div
            onClick={() =>
              debtSummary.owedToMeItems.length > 0 &&
              setSelectedDebtDetail({ type: 'owedToMe', items: debtSummary.owedToMeItems })
            }
            className={`p-4 rounded-2xl border space-y-1.5 transition-all ${
              debtSummary.owedToMeItems.length > 0
                ? 'cursor-pointer hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              {t.owedToMeLabel || 'Me deben (Por cobrar)'}
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono-numbers text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(debtSummary.owedToMeTotal, currency)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {debtSummary.owedToMeItems.length > 0
                ? `${debtSummary.owedToMeItems.length} reembolso(s) pendiente(s) → Clic para ver`
                : 'Sin cobros pendientes'}
            </span>
          </div>

          {/* Card: Yo debo */}
          <div
            onClick={() =>
              debtSummary.iOweItems.length > 0 &&
              setSelectedDebtDetail({ type: 'iOwe', items: debtSummary.iOweItems })
            }
            className={`p-4 rounded-2xl border space-y-1.5 transition-all ${
              debtSummary.iOweItems.length > 0
                ? 'cursor-pointer hover:border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 block">
              {t.iOweLabel || 'Yo debo (Por pagar)'}
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono-numbers text-rose-600 dark:text-rose-400">
              -{formatCurrency(debtSummary.iOweTotal, currency)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {debtSummary.iOweItems.length > 0
                ? `${debtSummary.iOweItems.length} reembolso(s) pendiente(s) → Clic para ver`
                : 'Sin deudas pendientes'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 7: RESUMEN POR CATEGORÍAS (Solo ejecutados) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {t.categoryBreakdownTitle || 'Gastos Realizados por Categoría'}
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">
            Solo pagos ejecutados
          </span>
        </div>

        {categoryBreakdown.list.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            {t.noCategoryExpensesInPeriod || 'No hay gastos pagados en este período.'}
          </p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.list.map((cat, idx) => (
              <div key={`cat_bp_${idx}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cat.category}</span>
                  </span>
                  <div className="text-right font-mono-numbers">
                    <span className="text-slate-900 dark:text-white mr-2">
                      {formatCurrency(cat.amount, currency)}
                    </span>
                    <span className="text-slate-400 font-semibold">{cat.percent}%</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, cat.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 8: COMPARACIÓN DEL PERÍODO (Mes anterior) */}
      {monthComparison && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {t.monthComparisonTitle || 'Comparación con el Mes Anterior'} ({monthComparison.prevMonthName})
            </h3>
          </div>

          {!monthComparison.hasData ? (
            <p className="text-xs text-slate-400 py-2">
              {t.noComparisonData || 'Sin datos suficientes del mes anterior para comparar.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Incomes change */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ingresos
                </span>
                {monthComparison.incomesChangePct !== null ? (
                  <div
                    className={`text-base font-black font-mono-numbers flex items-center gap-1 ${
                      monthComparison.incomesChangePct >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    <span>{monthComparison.incomesChangePct >= 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(monthComparison.incomesChangePct)}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">N/A</span>
                )}
              </div>

              {/* Expenses change */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Gastos Realizados
                </span>
                {monthComparison.expensesChangePct !== null ? (
                  <div
                    className={`text-base font-black font-mono-numbers flex items-center gap-1 ${
                      monthComparison.expensesChangePct <= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    <span>{monthComparison.expensesChangePct >= 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(monthComparison.expensesChangePct)}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">N/A</span>
                )}
              </div>

              {/* Pending change */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Facturas Pendientes
                </span>
                {monthComparison.pendingChangePct !== null ? (
                  <div
                    className={`text-base font-black font-mono-numbers flex items-center gap-1 ${
                      monthComparison.pendingChangePct <= 0
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    <span>{monthComparison.pendingChangePct >= 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(monthComparison.pendingChangePct)}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">N/A</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TIMELINE DETAIL MODAL */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Detalle del Registro
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Nombre:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedDetailItem.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fecha:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedDetailItem.date}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Categoría:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedDetailItem.category}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Monto:</span>
                <span className="font-black font-mono-numbers text-slate-900 dark:text-white">
                  {formatCurrency(Math.abs(selectedDetailItem.amount), currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estado:</span>
                <span className="font-bold text-emerald-600 uppercase">
                  {selectedDetailItem.status}
                </span>
              </div>
              {selectedDetailItem.notes && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                  <strong>Notas:</strong> {selectedDetailItem.notes}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedDetailItem(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* DEBT BREAKDOWN MODAL */}
      {selectedDebtDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden overscroll-contain"
          onClick={() => setSelectedDebtDetail(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedDebtDetail.type === 'owedToMe' ? 'Detalle: Me Deben' : 'Detalle: Yo Debo'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDebtDetail(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDebtDetail.items.map((item, idx) => (
                <div
                  key={`debt_it_${idx}`}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {item.partnerName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Fatura: {item.billTitle} ({item.month})
                    </span>
                  </div>
                  <span className="font-mono-numbers font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSelectedDebtDetail(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
