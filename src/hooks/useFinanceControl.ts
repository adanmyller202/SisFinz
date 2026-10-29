/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, sanitizeForFirestore } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {
  BillItem,
  IncomeItem,
  ExpenseItem,
  MonthlyStatusRecord,
  FinanceSettings,
  MonthBillOccurrence,
  MonthIncomeOccurrence,
  MonthTimelineItem,
  SharedBill,
} from '../types';
import {
  getCurrentMonthStr,
  getTodayStr,
  shiftMonthStr,
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  formatDayMonthLabel,
  getMonthDiff,
  getInstallmentPosition,
} from '../utils/finance';
import { registerPendingWrite, registerResolvedWrite } from './useSyncStatus';

export function useFinanceControl(externalSharedBills?: SharedBill[]) {
  const { user } = useAuth();
  const userId = user?.uid;

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [bills, setBills] = useState<BillItem[]>([]);
  const [internalSharedBills, setInternalSharedBills] = useState<SharedBill[]>([]);
  const sharedBills = externalSharedBills !== undefined ? externalSharedBills : internalSharedBills;
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [statusRecords, setStatusRecords] = useState<MonthlyStatusRecord[]>([]);
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>({
    userId: userId || '',
    currentBalance: 0,
    updatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Local storage helpers for instant offline fallback
  const getLocalKey = useCallback((sub: string) => `mc_fin_${userId}_${sub}`, [userId]);

  // Load Firestore data in real-time
  useEffect(() => {
    // Immediately clear all in-memory finance records on user transition
    setBills([]);
    setIncomes([]);
    setExpenses([]);
    setStatusRecords([]);
    setFinanceSettings({ userId: userId || '', currentBalance: 0, updatedAt: new Date().toISOString() });

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Try local cache first for instant render
    try {
      const cachedBills = localStorage.getItem(getLocalKey('bills'));
      const cachedIncomes = localStorage.getItem(getLocalKey('incomes'));
      const cachedExpenses = localStorage.getItem(getLocalKey('expenses'));
      const cachedStatus = localStorage.getItem(getLocalKey('status'));
      const cachedSettings = localStorage.getItem(getLocalKey('settings'));

      if (cachedBills) setBills(JSON.parse(cachedBills));
      if (cachedIncomes) setIncomes(JSON.parse(cachedIncomes));
      if (cachedExpenses) setExpenses(JSON.parse(cachedExpenses));
      if (cachedStatus) setStatusRecords(JSON.parse(cachedStatus));
      if (cachedSettings) setFinanceSettings(JSON.parse(cachedSettings));
    } catch {
      // ignore JSON parse errors
    }

    // 2. Real-time Firestore subscriptions under /users/${userId}/...
    const billsCol = collection(db, 'users', userId, 'bills');
    const incomesCol = collection(db, 'users', userId, 'incomes');
    const expensesCol = collection(db, 'users', userId, 'expenses');
    const statusCol = collection(db, 'users', userId, 'monthly_status');
    const settingsDoc = doc(db, 'users', userId, 'finance_settings', 'main');

    const unsubBills = onSnapshot(
      billsCol,
      (snapshot) => {
        const loaded: BillItem[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as BillItem));
        setBills(loaded);
        try {
          localStorage.setItem(getLocalKey('bills'), JSON.stringify(loaded));
        } catch {}
      },
      (err) => console.warn('Bills snapshot listener error:', err)
    );

    const unsubIncomes = onSnapshot(
      incomesCol,
      (snapshot) => {
        const loaded: IncomeItem[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as IncomeItem));
        setIncomes(loaded);
        try {
          localStorage.setItem(getLocalKey('incomes'), JSON.stringify(loaded));
        } catch {}
      },
      (err) => console.warn('Incomes snapshot listener error:', err)
    );

    const unsubExpenses = onSnapshot(
      expensesCol,
      (snapshot) => {
        const loaded: ExpenseItem[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as ExpenseItem));
        setExpenses(loaded);
        try {
          localStorage.setItem(getLocalKey('expenses'), JSON.stringify(loaded));
        } catch {}
      },
      (err) => console.warn('Expenses snapshot listener error:', err)
    );

    const unsubStatus = onSnapshot(
      statusCol,
      (snapshot) => {
        const loaded: MonthlyStatusRecord[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as MonthlyStatusRecord));
        setStatusRecords(loaded);
        try {
          localStorage.setItem(getLocalKey('status'), JSON.stringify(loaded));
        } catch {}
      },
      (err) => console.warn('Status snapshot listener error:', err)
    );

    const unsubSettings = onSnapshot(
      settingsDoc,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as FinanceSettings;
          setFinanceSettings(data);
          try {
            localStorage.setItem(getLocalKey('settings'), JSON.stringify(data));
          } catch {}
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Finance settings listener error:', err);
        setLoading(false);
      }
    );

    // Shared Bills subscription (only if not provided externally)
    let unsubSharedBills = () => {};
    if (externalSharedBills === undefined) {
      const qShared = query(
        collection(db, 'shared_bills'),
        where('members', 'array-contains', userId)
      );
      unsubSharedBills = onSnapshot(
        qShared,
        (snapshot) => {
          const loaded: SharedBill[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as SharedBill;
            if (!data.hiddenForUsers || !data.hiddenForUsers.includes(userId)) {
              loaded.push(data);
            }
          });
          setInternalSharedBills(loaded);
        },
        (err) => console.warn('Shared bills in finance control error:', err)
      );
    }

    return () => {
      unsubBills();
      unsubIncomes();
      unsubExpenses();
      unsubStatus();
      unsubSettings();
      unsubSharedBills();
    };
  }, [userId, getLocalKey, externalSharedBills]);

  // Actions for month navigation
  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => shiftMonthStr(prev, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prev) => shiftMonthStr(prev, 1));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(getCurrentMonthStr());
  }, []);

  // Placeholder for balance update - implemented below with derived values

  // 1. BILLS ACTIONS
  const addBill = useCallback(
    async (billData: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const id = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const newBill: BillItem = {
        ...billData,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
      };

      setBills((prev) => {
        const updated = [...prev, newBill];
        try {
          localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const billRef = doc(db, 'users', userId, 'bills', id);
        await setDoc(billRef, sanitizeForFirestore(newBill));
        return newBill;
      } catch (err) {
        console.warn('Bill saved locally, will sync when online:', err);
        return newBill;
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const updateBill = useCallback(
    async (billId: string, partial: Partial<BillItem>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const now = new Date().toISOString();
      setBills((prev) => {
        const updated = prev.map((b) => (b.id === billId ? { ...b, ...partial, updatedAt: now } : b));
        try {
          localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const billRef = doc(db, 'users', userId, 'bills', billId);
        await setDoc(billRef, sanitizeForFirestore({ ...partial, updatedAt: now }), { merge: true });
      } catch (err) {
        console.warn('Bill updated locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const deleteBill = useCallback(
    async (billId: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setBills((prev) => {
        const updated = prev.filter((b) => b.id !== billId);
        try {
          localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const billRef = doc(db, 'users', userId, 'bills', billId);
        await deleteDoc(billRef);
      } catch (err) {
        console.warn('Bill deleted locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // Update bill occurrence (this month vs this and all future)
  const updateBillOccurrence = useCallback(
    async (
      billId: string,
      targetMonth: string,
      newValues: Partial<BillItem>,
      scope: 'this' | 'this_and_future'
    ) => {
      if (!userId) return;
      const targetBill = bills.find((b) => b.id === billId);
      if (!targetBill) return;

      const now = new Date().toISOString();

      if (targetBill.recurrence === 'none') {
        await updateBill(billId, newValues);
        return;
      }

      if (scope === 'this') {
        const currentExceptions = targetBill.exceptions || {};
        const updatedExceptions = {
          ...currentExceptions,
          [targetMonth]: {
            ...currentExceptions[targetMonth],
            name: newValues.name,
            amount: newValues.amount,
            dueDay: newValues.dueDay,
            dueDate: newValues.dueDate,
            category: newValues.category,
            notes: newValues.notes,
          },
        };

        const partial = { exceptions: updatedExceptions, updatedAt: now };
        setBills((prev) => {
          const updated = prev.map((b) => (b.id === billId ? { ...b, ...partial } : b));
          try {
            localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
          } catch {}
          return updated;
        });

        registerPendingWrite();
        try {
          const billRef = doc(db, 'users', userId, 'bills', billId);
          await setDoc(billRef, sanitizeForFirestore(partial), { merge: true });
        } catch (err) {
          console.warn('Bill occurrence updated locally, will sync when online:', err);
        } finally {
          registerResolvedWrite();
        }
        return;
      }

      // scope === 'this_and_future'
      const diff = getMonthDiff(targetBill.startMonth, targetMonth);
      if (diff <= 0) {
        await updateBill(billId, newValues);
        return;
      }

      // Truncate original bill so previous months stay unaltered
      const cappedOriginal: Partial<BillItem> = {
        recurrenceMonthsCount: diff,
        updatedAt: now,
      };

      // Remaining count for future installments
      let remainingMonths = 0;
      if (targetBill.recurrenceMonthsCount && targetBill.recurrenceMonthsCount > 0) {
        remainingMonths = Math.max(1, targetBill.recurrenceMonthsCount - diff);
      }

      const newBillId = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newBill: BillItem = {
        id: newBillId,
        userId,
        name: newValues.name ?? targetBill.name,
        amount: newValues.amount ?? targetBill.amount,
        dueDate: newValues.dueDate ?? getEffectiveDateForMonth(targetMonth, newValues.dueDay ?? targetBill.dueDay),
        dueDay: newValues.dueDay ?? targetBill.dueDay,
        category: newValues.category ?? targetBill.category,
        notes: newValues.notes !== undefined ? newValues.notes : targetBill.notes,
        recurrence: 'monthly',
        recurrenceMonthsCount: remainingMonths,
        startMonth: targetMonth,
        createdAt: now,
        updatedAt: now,
      };

      setBills((prev) => {
        const updated = [
          ...prev.map((b) => (b.id === billId ? { ...b, ...cappedOriginal } : b)),
          newBill,
        ];
        try {
          localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const oldRef = doc(db, 'users', userId, 'bills', billId);
        await setDoc(oldRef, sanitizeForFirestore(cappedOriginal), { merge: true });

        const newRef = doc(db, 'users', userId, 'bills', newBillId);
        await setDoc(newRef, sanitizeForFirestore(newBill));
      } catch (err) {
        console.warn('Bill recurrence split locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, bills, updateBill, getLocalKey]
  );

  // Delete bill occurrence (this month vs this and all future)
  const deleteBillOccurrence = useCallback(
    async (
      billId: string,
      targetMonth: string,
      scope: 'this' | 'this_and_future'
    ) => {
      if (!userId) return;
      const targetBill = bills.find((b) => b.id === billId);
      if (!targetBill) return;

      const now = new Date().toISOString();

      if (targetBill.recurrence === 'none') {
        await deleteBill(billId);
        return;
      }

      if (scope === 'this') {
        const currentExceptions = targetBill.exceptions || {};
        const updatedExceptions = {
          ...currentExceptions,
          [targetMonth]: {
            ...currentExceptions[targetMonth],
            isDeleted: true,
          },
        };
        const partial = { exceptions: updatedExceptions, updatedAt: now };
        setBills((prev) => {
          const updated = prev.map((b) => (b.id === billId ? { ...b, ...partial } : b));
          try {
            localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
          } catch {}
          return updated;
        });

        registerPendingWrite();
        try {
          const billRef = doc(db, 'users', userId, 'bills', billId);
          await setDoc(billRef, sanitizeForFirestore(partial), { merge: true });
        } catch (err) {
          console.warn('Bill occurrence deleted locally, will sync when online:', err);
        } finally {
          registerResolvedWrite();
        }
        return;
      }

      // scope === 'this_and_future'
      const diff = getMonthDiff(targetBill.startMonth, targetMonth);
      if (diff <= 0) {
        await deleteBill(billId);
        return;
      }

      const cappedOriginal: Partial<BillItem> = {
        recurrenceMonthsCount: diff,
        updatedAt: now,
      };
      setBills((prev) => {
        const updated = prev.map((b) => (b.id === billId ? { ...b, ...cappedOriginal } : b));
        try {
          localStorage.setItem(getLocalKey('bills'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const oldRef = doc(db, 'users', userId, 'bills', billId);
        await setDoc(oldRef, sanitizeForFirestore(cappedOriginal), { merge: true });
      } catch (err) {
        console.warn('Bill recurrence capped locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, bills, deleteBill, getLocalKey]
  );

  const toggleBillPaid = useCallback(
    async (billId: string, month: string, isPaid: boolean, paidDate?: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const recordId = `bill_${billId}_${month}`;
      const updatedRecord: MonthlyStatusRecord = {
        id: recordId,
        userId,
        itemId: billId,
        itemType: 'bill',
        month,
        isCompleted: isPaid,
        completedAt: isPaid ? (paidDate || new Date().toISOString()) : undefined,
      };

      setStatusRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== recordId);
        const updated = [...filtered, updatedRecord];
        try {
          localStorage.setItem(getLocalKey('status'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const statusRef = doc(db, 'users', userId, 'monthly_status', recordId);
        await setDoc(statusRef, sanitizeForFirestore(updatedRecord));
      } catch (err) {
        console.warn('Bill status updated locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // 2. INCOMES ACTIONS
  const addIncome = useCallback(
    async (incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const id = 'inc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const newIncome: IncomeItem = {
        ...incomeData,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
      };

      setIncomes((prev) => {
        const updated = [...prev, newIncome];
        try {
          localStorage.setItem(getLocalKey('incomes'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const incRef = doc(db, 'users', userId, 'incomes', id);
        await setDoc(incRef, sanitizeForFirestore(newIncome));
        return newIncome;
      } catch (err) {
        console.warn('Income saved locally, will sync when online:', err);
        return newIncome;
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const updateIncome = useCallback(
    async (incomeId: string, partial: Partial<IncomeItem>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const now = new Date().toISOString();
      setIncomes((prev) => {
        const updated = prev.map((inc) => (inc.id === incomeId ? { ...inc, ...partial, updatedAt: now } : inc));
        try {
          localStorage.setItem(getLocalKey('incomes'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const incRef = doc(db, 'users', userId, 'incomes', incomeId);
        await setDoc(incRef, sanitizeForFirestore({ ...partial, updatedAt: now }), { merge: true });
      } catch (err) {
        console.warn('Income updated locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const deleteIncome = useCallback(
    async (incomeId: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setIncomes((prev) => {
        const updated = prev.filter((inc) => inc.id !== incomeId);
        try {
          localStorage.setItem(getLocalKey('incomes'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const incRef = doc(db, 'users', userId, 'incomes', incomeId);
        await deleteDoc(incRef);
      } catch (err) {
        console.warn('Income deleted locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const toggleIncomeReceived = useCallback(
    async (incomeId: string, month: string, isReceived: boolean, receivedDate?: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const recordId = `income_${incomeId}_${month}`;
      const updatedRecord: MonthlyStatusRecord = {
        id: recordId,
        userId,
        itemId: incomeId,
        itemType: 'income',
        month,
        isCompleted: isReceived,
        completedAt: isReceived ? (receivedDate || new Date().toISOString()) : undefined,
      };

      setStatusRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== recordId);
        const updated = [...filtered, updatedRecord];
        try {
          localStorage.setItem(getLocalKey('status'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const statusRef = doc(db, 'users', userId, 'monthly_status', recordId);
        await setDoc(statusRef, sanitizeForFirestore(updatedRecord));
      } catch (err) {
        console.warn('Income status updated locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // 3. EXPENSES ACTIONS (Avulsas)
  const addExpense = useCallback(
    async (expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const id = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const newExpense: ExpenseItem = {
        ...expenseData,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
      };

      setExpenses((prev) => {
        const updated = [...prev, newExpense];
        try {
          localStorage.setItem(getLocalKey('expenses'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const expRef = doc(db, 'users', userId, 'expenses', id);
        await setDoc(expRef, sanitizeForFirestore(newExpense));
        return newExpense;
      } catch (err) {
        console.warn('Expense saved locally, will sync when online:', err);
        return newExpense;
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const updateExpense = useCallback(
    async (expenseId: string, partial: Partial<ExpenseItem>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const now = new Date().toISOString();
      setExpenses((prev) => {
        const updated = prev.map((exp) => (exp.id === expenseId ? { ...exp, ...partial, updatedAt: now } : exp));
        try {
          localStorage.setItem(getLocalKey('expenses'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const expRef = doc(db, 'users', userId, 'expenses', expenseId);
        await setDoc(expRef, sanitizeForFirestore({ ...partial, updatedAt: now }), { merge: true });
      } catch (err) {
        console.warn('Expense updated locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setExpenses((prev) => {
        const updated = prev.filter((exp) => exp.id !== expenseId);
        try {
          localStorage.setItem(getLocalKey('expenses'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const expRef = doc(db, 'users', userId, 'expenses', expenseId);
        await deleteDoc(expRef);
      } catch (err) {
        console.warn('Expense deleted locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // Status mapping index for instant O(1) lookup
  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    for (const rec of statusRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [statusRecords]);

  const todayStr = useMemo(() => getTodayStr(), []);

  // DERIVED: Month Bills Occurrences
  const monthBills = useMemo<MonthBillOccurrence[]>(() => {
    const list: MonthBillOccurrence[] = [];
    for (const bill of bills) {
      if (doesItemOccurInMonth(bill.startMonth, selectedMonth, bill.recurrence, bill.recurrenceMonthsCount)) {
        const exception = bill.exceptions?.[selectedMonth];
        if (exception?.isDeleted || bill.excludedMonths?.includes(selectedMonth)) {
          continue;
        }

        const effectiveDay = exception?.dueDay ?? bill.dueDay;
        const effectiveDueDate = exception?.dueDate ?? getEffectiveDateForMonth(selectedMonth, effectiveDay);
        const recordKey = `bill_${bill.id}_${selectedMonth}`;
        const record = statusMap.get(recordKey);
        const isPaid = record?.isCompleted === true;

        let status: 'paid' | 'overdue' | 'pending';
        if (isPaid) {
          status = 'paid';
        } else if (effectiveDueDate < todayStr) {
          status = 'overdue';
        } else {
          status = 'pending';
        }

        const resolvedBill: BillItem = exception
          ? {
              ...bill,
              name: exception.name ?? bill.name,
              amount: exception.amount ?? bill.amount,
              dueDay: exception.dueDay ?? bill.dueDay,
              dueDate: exception.dueDate ?? bill.dueDate,
              category: exception.category ?? bill.category,
              notes: exception.notes !== undefined ? exception.notes : bill.notes,
            }
          : bill;

        const installmentLabel = getInstallmentPosition(
          bill.startMonth,
          selectedMonth,
          bill.recurrence,
          bill.recurrenceMonthsCount
        );

        list.push({
          bill: resolvedBill,
          month: selectedMonth,
          effectiveDueDate,
          status,
          paidAt: record?.completedAt,
          installmentLabel,
        });
      }
    }

    // Synthesize Shared Bills for the selected month
    if (userId) {
      for (const sb of sharedBills) {
          const startMonthFallback = sb.startMonth || sb.month || (sb.dueDate ? sb.dueDate.substring(0, 7) : '');
        if (doesItemOccurInMonth(startMonthFallback, selectedMonth, sb.recurrence || 'none', sb.recurrenceMonthsCount)) {
          const exception = sb.exceptions?.[selectedMonth];
          if (exception?.isDeleted || sb.excludedMonths?.includes(selectedMonth)) {
            continue;
          }
          if (sb.shareRequest?.status === 'rejected') continue;

          let obligationAmount = 0;
          let status: 'paid' | 'overdue' | 'pending' = 'pending';
          const effectiveDueDay = sb.dueDay || 1;
          const effectiveDueDate = getEffectiveDateForMonth(selectedMonth, effectiveDueDay);

          // Check for month-specific status in exceptions
          const monthException = sb.exceptions?.[selectedMonth];
          const isMonthPaid = (monthException?.status === 'paid') || (sb.recurrence === 'none' && sb.status === 'paid');
          const monthReimbursement = monthException?.reimbursement || (sb.recurrence === 'none' ? sb.reimbursement : null);

          if (isMonthPaid) {
            // Check if user still owes reimbursement for THIS month
            if (monthReimbursement && monthReimbursement.status === 'pending') {
              if (monthReimbursement.fromUserId === userId) {
                obligationAmount = monthReimbursement.amount;
                const recordKey = `bill_sb_${sb.id}_${selectedMonth}`;
                const record = statusMap.get(recordKey);
                const isReimbPaid =
                  record?.isCompleted === true ||
                  monthException?.shares?.[userId]?.status === 'paid' ||
                  sb.shares[userId]?.status === 'paid';
                if (isReimbPaid) {
                  status = 'paid';
                } else {
                  status = effectiveDueDate < todayStr ? 'overdue' : 'pending';
                }
              } else {
                obligationAmount = sb.shares[userId]?.amount || 0;
                status = 'paid';
              }
            } else {
              obligationAmount = sb.shares[userId]?.amount || 0;
              status = 'paid';
            }
          } else {
            // Bill is pending to creditor for THIS month
            if (sb.paymentResponsibility === userId) {
              obligationAmount = sb.amount;
              status = effectiveDueDate < todayStr ? 'overdue' : 'pending';
            } else if (sb.paymentResponsibility && sb.paymentResponsibility !== userId) {
              // User already transferred share to partner (pre-payment)
              obligationAmount = sb.shares[userId]?.amount || 0;
              status = 'paid';
            } else {
              // Initial share state
              const myShare = sb.shares[userId];
              obligationAmount = myShare?.amount || 0;
              const recordKey = `bill_sb_${sb.id}_${selectedMonth}`;
              const record = statusMap.get(recordKey);
              const isSharePaid =
                record?.isCompleted === true ||
                myShare?.status === 'transferred' ||
                myShare?.status === 'paid' ||
                monthException?.shares?.[userId]?.status === 'paid' ||
                monthException?.shares?.[userId]?.status === 'transferred';
              if (isSharePaid) {
                status = 'paid';
              } else {
                status = effectiveDueDate < todayStr ? 'overdue' : 'pending';
              }
            }
          }

          if (obligationAmount > 0) {
            const synthBill: BillItem = {
              id: `sb_${sb.id}`,
              userId,
              name: `[Compartilhada] ${sb.title}`,
              amount: obligationAmount,
              dueDate: effectiveDueDate,
              dueDay: effectiveDueDay,
              category: sb.category || 'Contas Compartilhadas',
              notes: sb.notes,
              recurrence: sb.recurrence || 'none',
              recurrenceMonthsCount: sb.recurrenceMonthsCount || 0,
              startMonth: startMonthFallback,
              createdAt: sb.createdAt,
              updatedAt: sb.updatedAt,
              isSharedExemptFromTotal: true,
            };

            list.push({
              bill: synthBill,
              month: selectedMonth,
              effectiveDueDate,
              status,
              paidAt: sb.paidAt,
              installmentLabel: null,
            });
          }
        }
      }
    }

    // Sort by effective due date
    return list.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate));
  }, [bills, sharedBills, selectedMonth, statusMap, todayStr, userId]);

  // DERIVED: Month Incomes Occurrences
  const monthIncomes = useMemo<MonthIncomeOccurrence[]>(() => {
    const list: MonthIncomeOccurrence[] = [];
    for (const inc of incomes) {
      if (doesItemOccurInMonth(inc.startMonth, selectedMonth, inc.recurrence, inc.recurrenceMonthsCount)) {
        const exception = inc.exceptions?.[selectedMonth];
        if (exception?.isDeleted || inc.excludedMonths?.includes(selectedMonth)) {
          continue;
        }

        const effectiveDay = exception?.expectedDay ?? inc.expectedDay;
        const effectiveDate = exception?.expectedDate ?? getEffectiveDateForMonth(selectedMonth, effectiveDay);
        const recordKey = `income_${inc.id}_${selectedMonth}`;
        const record = statusMap.get(recordKey);
        const isReceived = record?.isCompleted === true;

        const resolvedIncome: IncomeItem = exception
          ? {
              ...inc,
              name: exception.name ?? inc.name,
              amount: exception.amount ?? inc.amount,
              expectedDay: exception.expectedDay ?? inc.expectedDay,
              expectedDate: exception.expectedDate ?? inc.expectedDate,
              category: exception.category ?? inc.category,
              notes: exception.notes !== undefined ? exception.notes : inc.notes,
            }
          : inc;

        list.push({
          income: resolvedIncome,
          month: selectedMonth,
          effectiveDate,
          status: isReceived ? 'received' : 'pending',
          receivedAt: record?.completedAt,
        });
      }
    }
    // Sort by effective date
    return list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  }, [incomes, selectedMonth, statusMap]);

  // DERIVED: Month One-off Expenses
  const monthExpenses = useMemo<ExpenseItem[]>(() => {
    return expenses
      .filter((exp) => exp.date.startsWith(selectedMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, selectedMonth]);

  // DERIVED FINANCIAL TOTALS
  // 1. Total de receitas já recebidas no mês
  const totalReceivedMonth = useMemo(() => {
    return monthIncomes
      .filter((i) => i.status === 'received')
      .reduce((sum, i) => sum + i.income.amount, 0);
  }, [monthIncomes]);

  // 2. Total de faturas já pagas no mês
  const totalPaidMonth = useMemo(() => {
    return monthBills
      .filter((b) => b.status === 'paid' && !b.bill.isSharedExemptFromTotal)
      .reduce((sum, b) => sum + b.bill.amount, 0);
  }, [monthBills]);

  // 3. Total de despesas avulsas realizadas no mês
  const totalOneOffExpensesMonth = useMemo(() => {
    return monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthExpenses]);

  // 4. Total de saídas realizadas (faturas pagas + despesas avulsas executadas)
  const totalSpentMonth = useMemo(() => {
    return totalPaidMonth + totalOneOffExpensesMonth;
  }, [totalPaidMonth, totalOneOffExpensesMonth]);

  // 5. Saldo Base / Inicial configurado
  const baseBalance = useMemo(() => {
    if (financeSettings.monthlyInitialBalances?.[selectedMonth] !== undefined) {
      return financeSettings.monthlyInitialBalances[selectedMonth];
    }
    return financeSettings.initialBalance ?? financeSettings.currentBalance ?? 0;
  }, [financeSettings, selectedMonth]);

  // 6. Saldo Atual em Conta:
  // "o saldo sempre deve ser um calculo entre o que foi recebido e o que esta saindo(esta sendo pago ou despeza realizada)"
  const currentBalance = useMemo(() => {
    return baseBalance + totalReceivedMonth - totalSpentMonth;
  }, [baseBalance, totalReceivedMonth, totalSpentMonth]);

  // 7. A receber: receitas do mês ainda não marcadas como recebidas
  const toReceive = useMemo(() => {
    return monthIncomes
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + i.income.amount, 0);
  }, [monthIncomes]);

  // 8. A pagar: faturas pendentes ou atrasadas no mês
  const toPay = useMemo(() => {
    return monthBills
      .filter((b) => b.status === 'pending' || b.status === 'overdue')
      .reduce((sum, b) => sum + b.bill.amount, 0);
  }, [monthBills]);

  // 9. Receitas totais do mês
  const totalIncomeMonth = useMemo(() => {
    return monthIncomes.reduce((sum, i) => sum + i.income.amount, 0);
  }, [monthIncomes]);

  // 10. Despesas totais do mês: faturas + despesas avulsas
  const totalExpensesMonth = useMemo(() => {
    const billsTotal = monthBills.reduce((sum, b) => sum + b.bill.amount, 0);
    return billsTotal + totalOneOffExpensesMonth;
  }, [monthBills, totalOneOffExpensesMonth]);

  // 11. Previsão de saldo no fim do mês:
  // Saldo previsto = saldo atual + valores ainda a receber - valores ainda a pagar
  const forecastBalance = useMemo(() => {
    return currentBalance + toReceive - toPay;
  }, [currentBalance, toReceive, toPay]);

  // Atualizar saldo atual da conta (ajustando a base para que o saldo atual seja exatamente o valor desejado)
  const updateCurrentBalance = useCallback(
    async (targetBalance: number) => {
      if (!userId) return;
      const newBaseBalance = targetBalance - totalReceivedMonth + totalSpentMonth;
      const updatedBalances = {
        ...(financeSettings.monthlyInitialBalances || {}),
        [selectedMonth]: newBaseBalance,
      };
      const newSettings: FinanceSettings = {
        userId,
        currentBalance: targetBalance,
        initialBalance: newBaseBalance,
        monthlyInitialBalances: updatedBalances,
        updatedAt: new Date().toISOString(),
      };
      setFinanceSettings(newSettings);
      try {
        localStorage.setItem(getLocalKey('settings'), JSON.stringify(newSettings));
        const settingsRef = doc(db, 'users', userId, 'finance_settings', 'main');
        await setDoc(settingsRef, sanitizeForFirestore(newSettings), { merge: true });
      } catch (err) {
        console.error('Error saving current balance to Firestore:', err);
      }
    },
    [userId, getLocalKey, totalReceivedMonth, totalSpentMonth, selectedMonth, financeSettings]
  );

  // DERIVED: Chronological Timeline of the Month
  const timelineItems = useMemo<MonthTimelineItem[]>(() => {
    const items: MonthTimelineItem[] = [];

    // Incomes
    for (const incOcc of monthIncomes) {
      items.push({
        id: `inc_${incOcc.income.id}_${incOcc.month}`,
        type: 'income',
        name: incOcc.income.name,
        amount: incOcc.income.amount,
        date: incOcc.effectiveDate,
        formattedDayMonth: formatDayMonthLabel(incOcc.effectiveDate),
        category: incOcc.income.category,
        notes: incOcc.income.notes,
        status: incOcc.status === 'received' ? 'received' : 'to_receive',
        statusLabel: incOcc.status === 'received' ? 'Recebido' : 'A receber',
        originalId: incOcc.income.id,
        isRecurring: incOcc.income.recurrence === 'monthly',
      });
    }

    // Bills
    for (const billOcc of monthBills) {
      items.push({
        id: `bill_${billOcc.bill.id}_${billOcc.month}`,
        type: 'bill',
        name: billOcc.bill.name,
        amount: -billOcc.bill.amount,
        date: billOcc.effectiveDueDate,
        formattedDayMonth: formatDayMonthLabel(billOcc.effectiveDueDate),
        category: billOcc.bill.category,
        notes: billOcc.bill.notes,
        status: billOcc.status,
        statusLabel:
          billOcc.status === 'paid'
            ? 'Pago'
            : billOcc.status === 'overdue'
            ? 'Atrasado'
            : 'Pendente',
        originalId: billOcc.bill.id,
        isRecurring: billOcc.bill.recurrence === 'monthly',
        installmentLabel: billOcc.installmentLabel,
      });
    }

    // Expenses (avulsas)
    for (const exp of monthExpenses) {
      items.push({
        id: `exp_${exp.id}`,
        type: 'expense',
        name: exp.name,
        amount: -exp.amount,
        date: exp.date,
        formattedDayMonth: formatDayMonthLabel(exp.date),
        category: exp.category,
        notes: exp.notes,
        status: 'paid', // one-off expense is an expenditure already executed
        statusLabel: 'Despesa Avulsa',
        originalId: exp.id,
        isRecurring: false,
      });
    }

    // Chronological sort: earlier dates first. On same day, incomes first then bills
    return items.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      // Incomes on top
      if (a.type === 'income' && b.type !== 'income') return -1;
      if (b.type === 'income' && a.type !== 'income') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [monthIncomes, monthBills, monthExpenses]);

  // Factory reset all user financial data in Firestore & memory
  const resetAllFinanceData = useCallback(async () => {
    if (!userId) return;

    // 1. Delete all bills
    try {
      const billsSnapshot = await getDocs(collection(db, 'users', userId, 'bills'));
      const batchPromises: Promise<any>[] = [];
      billsSnapshot.forEach((docSnap) => {
        batchPromises.push(deleteDoc(doc(db, 'users', userId, 'bills', docSnap.id)));
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error('Error wiping bills in Firestore:', err);
    }

    // 2. Delete all incomes
    try {
      const incomesSnapshot = await getDocs(collection(db, 'users', userId, 'incomes'));
      const batchPromises: Promise<any>[] = [];
      incomesSnapshot.forEach((docSnap) => {
        batchPromises.push(deleteDoc(doc(db, 'users', userId, 'incomes', docSnap.id)));
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error('Error wiping incomes in Firestore:', err);
    }

    // 3. Delete all expenses
    try {
      const expensesSnapshot = await getDocs(collection(db, 'users', userId, 'expenses'));
      const batchPromises: Promise<any>[] = [];
      expensesSnapshot.forEach((docSnap) => {
        batchPromises.push(deleteDoc(doc(db, 'users', userId, 'expenses', docSnap.id)));
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error('Error wiping expenses in Firestore:', err);
    }

    // 4. Delete all monthly_status records
    try {
      const statusSnapshot = await getDocs(collection(db, 'users', userId, 'monthly_status'));
      const batchPromises: Promise<any>[] = [];
      statusSnapshot.forEach((docSnap) => {
        batchPromises.push(deleteDoc(doc(db, 'users', userId, 'monthly_status', docSnap.id)));
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error('Error wiping monthly_status in Firestore:', err);
    }

    // 5. Reset finance settings (balance, initialBalance to 0)
    try {
      const initialSettings: FinanceSettings = {
        userId,
        currentBalance: 0,
        initialBalance: 0,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', userId, 'finance_settings', 'main'), sanitizeForFirestore(initialSettings));
    } catch (err) {
      console.error('Error resetting finance_settings in Firestore:', err);
    }

    // 6. Delete custom categories
    try {
      const catSnapshot = await getDocs(collection(db, 'users', userId, 'categories'));
      const batchPromises: Promise<any>[] = [];
      catSnapshot.forEach((docSnap) => {
        batchPromises.push(deleteDoc(doc(db, 'users', userId, 'categories', docSnap.id)));
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error('Error wiping categories in Firestore:', err);
    }

    // 7. Reset category overrides
    try {
      await deleteDoc(doc(db, 'users', userId, 'settings', 'category_overrides'));
    } catch {}

    // 8. Clear in-memory state & localStorage cache
    setBills([]);
    setIncomes([]);
    setExpenses([]);
    setStatusRecords([]);
    setFinanceSettings({ userId, currentBalance: 0, initialBalance: 0, updatedAt: new Date().toISOString() });

    try {
      localStorage.removeItem(getLocalKey('bills'));
      localStorage.removeItem(getLocalKey('incomes'));
      localStorage.removeItem(getLocalKey('expenses'));
      localStorage.removeItem(getLocalKey('status'));
      localStorage.removeItem(getLocalKey('settings'));
    } catch {}
  }, [userId, getLocalKey]);

  return {
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    loading,

    // Data lists
    bills,
    sharedBills,
    incomes,
    expenses,
    monthBills,
    monthIncomes,
    monthExpenses,
    timelineItems,
    statusRecords,

    // Financial KPIs
    currentBalance,
    baseBalance,
    totalReceivedMonth,
    totalPaidMonth,
    totalSpentMonth,
    totalOneOffExpensesMonth,
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

    // Factory reset all financial data
    resetAllFinanceData,
  };
}
