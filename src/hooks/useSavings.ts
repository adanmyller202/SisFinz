/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, sanitizeForFirestore } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { SavingGoal, SavingTransaction, CurrencyCode, ExpenseItem, IncomeItem } from '../types';
import { getTodayStr, getCurrentMonthStr } from '../utils/finance';
import { formatCurrency } from '../utils/currency';
import { registerPendingWrite, registerResolvedWrite } from './useSyncStatus';

interface TransferFinanceOps {
  addExpense: (expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>;
  currency: CurrencyCode;
}

interface WithdrawFinanceOps {
  addIncome: (incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<IncomeItem>;
  toggleIncomeReceived: (incomeId: string, month: string, isReceived: boolean, receivedDate?: string) => Promise<void>;
  currentMonthStr: string;
}

export function useSavings() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [savings, setSavings] = useState<SavingGoal[]>([]);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const getLocalKey = useCallback((sub: string) => `mc_savings_${userId}_${sub}`, [userId]);

  // Real-time listener for user savings and transactions
  useEffect(() => {
    // Immediately clear in-memory savings on user switch/logout
    setSavings([]);
    setTransactions([]);

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Try reading cache for instant offline render
    try {
      const cached = localStorage.getItem(getLocalKey('goals'));
      const cachedTx = localStorage.getItem(getLocalKey('txs'));
      if (cached) setSavings(JSON.parse(cached));
      if (cachedTx) setTransactions(JSON.parse(cachedTx));
    } catch {
      // ignore
    }

    // 1. Savings Goals listener: /users/{userId}/savings
    const savingsCol = collection(db, 'users', userId, 'savings');
    const unsubSavings = onSnapshot(
      savingsCol,
      (snapshot) => {
        const loaded: SavingGoal[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          loaded.push({
            id: d.id,
            userId,
            name: data.name || '',
            targetAmount: Number(data.targetAmount) || 0,
            currentAmount: Number(data.currentAmount) || 0,
            deadline: data.deadline || undefined,
            icon: data.icon || '🎯',
            notes: data.notes || '',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        // Sort by creation date descending
        loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setSavings(loaded);
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(loaded));
        } catch {
          // ignore
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to savings:', error);
        setLoading(false);
      }
    );

    // 2. Savings Transactions listener: /users/{userId}/saving_transactions
    const txCol = collection(db, 'users', userId, 'saving_transactions');
    const unsubTx = onSnapshot(
      txCol,
      (snapshot) => {
        const loaded: SavingTransaction[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          loaded.push({
            id: d.id,
            userId,
            savingId: data.savingId || '',
            savingName: data.savingName || '',
            type: data.type || 'deposit',
            amount: Number(data.amount) || 0,
            date: data.date || getTodayStr(),
            note: data.note || '',
            createdAt: data.createdAt || new Date().toISOString(),
            expenseId: data.expenseId,
            incomeId: data.incomeId,
          });
        });
        loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTransactions(loaded);
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(loaded));
        } catch {
          // ignore
        }
      },
      (error) => {
        console.error('Error listening to saving transactions:', error);
      }
    );

    return () => {
      unsubSavings();
      unsubTx();
    };
  }, [userId, getLocalKey]);

  // 1. Create a new Saving Goal
  const createSavingGoal = useCallback(
    async (params: {
      name: string;
      targetAmount: number;
      deadline?: string;
      icon?: string;
      notes?: string;
    }): Promise<SavingGoal> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const id = 'save_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();

      const newGoal: SavingGoal = {
        id,
        userId,
        name: params.name.trim(),
        targetAmount: Number(params.targetAmount) || 0,
        currentAmount: 0,
        deadline: params.deadline?.trim() || undefined,
        icon: params.icon?.trim() || '🎯',
        notes: params.notes?.trim() || '',
        createdAt: now,
        updatedAt: now,
      };

      setSavings((prev) => {
        const updated = [newGoal, ...prev];
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const docRef = doc(db, 'users', userId, 'savings', id);
      try {
        await setDoc(docRef, sanitizeForFirestore(newGoal));
      } finally {
        registerResolvedWrite();
      }
      return newGoal;
    },
    [userId, getLocalKey]
  );

  // 2. Update a Saving Goal
  const updateSavingGoal = useCallback(
    async (id: string, updates: Partial<SavingGoal>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const now = new Date().toISOString();
      const updatedData = { ...updates, updatedAt: now };

      setSavings((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, ...updatedData } : s));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const docRef = doc(db, 'users', userId, 'savings', id);
      try {
        await setDoc(docRef, sanitizeForFirestore(updatedData), { merge: true });
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // 3. Delete a Saving Goal
  const deleteSavingGoal = useCallback(
    async (id: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setSavings((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const docRef = doc(db, 'users', userId, 'savings', id);
      try {
        await deleteDoc(docRef);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // 4. Transfer money from Available Balance to a Saving Goal
  // - Decreases available balance by registering an expense in "Inversiones"
  // - Increases saving goal current amount
  // - Strictly no duplicate subtraction or creation
  const transferToSaving = useCallback(
    async (
      savingId: string,
      amount: number,
      date?: string,
      note?: string,
      financeOps?: TransferFinanceOps
    ) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (amount <= 0) throw new Error('O valor deve ser maior que zero.');

      const targetGoal = savings.find((s) => s.id === savingId);
      if (!targetGoal) throw new Error('Meta de ahorro não encontrada.');

      const txDate = date || getTodayStr();
      const now = new Date().toISOString();
      const formattedAmt = financeOps ? formatCurrency(amount, financeOps.currency) : `$${amount}`;

      // 1. Create expense in category "Inversiones"
      let createdExpenseId: string | undefined;
      if (financeOps?.addExpense) {
        const expenseName = `Inversiones — ${targetGoal.name} — ${formattedAmt}`;
        const createdExp = await financeOps.addExpense({
          name: expenseName,
          amount: amount,
          category: 'Inversiones',
          date: txDate,
          notes: note || `Transferencia hacia ahorro "${targetGoal.name}"`,
        });
        createdExpenseId = createdExp?.id;
      }

      // 2. Update saving goal balance
      const newCurrentAmount = (targetGoal.currentAmount || 0) + amount;
      await updateSavingGoal(savingId, { currentAmount: newCurrentAmount });

      // 3. Record transaction
      const txId = 'stx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newTx: SavingTransaction = {
        id: txId,
        userId,
        savingId,
        savingName: targetGoal.name,
        type: 'deposit',
        amount,
        date: txDate,
        note: note || `Transferencia desde saldo disponible`,
        createdAt: now,
        expenseId: createdExpenseId,
      };

      setTransactions((prev) => {
        const updated = [newTx, ...prev];
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const txRef = doc(db, 'users', userId, 'saving_transactions', txId);
        await setDoc(txRef, sanitizeForFirestore(newTx));
      } catch (err) {
        console.error('Error recording saving transaction:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, savings, updateSavingGoal, getLocalKey]
  );

  // 5. Withdraw money from a Saving Goal back to Available Balance
  // - Decreases saving goal current amount
  // - Increases available balance by adding received income
  const withdrawFromSaving = useCallback(
    async (
      savingId: string,
      amount: number,
      date?: string,
      note?: string,
      financeOps?: WithdrawFinanceOps
    ) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (amount <= 0) throw new Error('O valor deve ser maior que zero.');

      const targetGoal = savings.find((s) => s.id === savingId);
      if (!targetGoal) throw new Error('Meta de ahorro não encontrada.');

      if (targetGoal.currentAmount < amount) {
        throw new Error('Monto insuficiente ahorrado en esta meta.');
      }

      const txDate = date || getTodayStr();
      const now = new Date().toISOString();
      const currentMonth = financeOps?.currentMonthStr || getCurrentMonthStr();
      const dayOfMonth = txDate && txDate.includes('-') ? (parseInt(txDate.split('-')[2], 10) || new Date().getDate()) : new Date().getDate();

      // 1. Add received income to restore available balance
      let createdIncomeId: string | undefined;
      if (financeOps?.addIncome && financeOps?.toggleIncomeReceived) {
        const incomeName = `Retiro de ahorro: ${targetGoal.name}`;
        const newIncome = await financeOps.addIncome({
          name: incomeName,
          amount: amount,
          category: 'Inversiones',
          expectedDate: txDate,
          expectedDay: dayOfMonth,
          recurrence: 'none',
          startMonth: currentMonth,
          notes: note || `Retiro del ahorro "${targetGoal.name}" hacia el saldo disponible`,
        });
        createdIncomeId = newIncome.id;
        // Mark as immediately received so it increases current balance right away
        await financeOps.toggleIncomeReceived(newIncome.id, currentMonth, true, txDate);
      }

      // 2. Decrease saving goal balance
      const newCurrentAmount = Math.max(0, targetGoal.currentAmount - amount);
      await updateSavingGoal(savingId, { currentAmount: newCurrentAmount });

      // 3. Record transaction
      const txId = 'stx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newTx: SavingTransaction = {
        id: txId,
        userId,
        savingId,
        savingName: targetGoal.name,
        type: 'withdrawal',
        amount,
        date: txDate,
        note: note || `Retiro hacia saldo disponible`,
        createdAt: now,
        incomeId: createdIncomeId,
      };

      setTransactions((prev) => {
        const updated = [newTx, ...prev];
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const txRef = doc(db, 'users', userId, 'saving_transactions', txId);
        await setDoc(txRef, sanitizeForFirestore(newTx));
      } catch (err) {
        console.error('Error recording saving transaction:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, savings, updateSavingGoal, getLocalKey]
  );

  // Derived totals
  const totalSavedInSavings = useMemo(() => {
    return savings.reduce((sum, s) => sum + (s.currentAmount || 0), 0);
  }, [savings]);

  const totalTargetInSavings = useMemo(() => {
    return savings.reduce((sum, s) => sum + (s.targetAmount || 0), 0);
  }, [savings]);

  return {
    savings,
    transactions,
    loading,
    totalSavedInSavings,
    totalTargetInSavings,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    transferToSaving,
    withdrawFromSaving,
  };
}
