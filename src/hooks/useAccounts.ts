/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AccountItem, AccountTransferRecord, AccountType, CurrencyCode } from '../types';
import { db } from '../firebase/config';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

export function useAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [transfers, setTransfers] = useState<AccountTransferRecord[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);

  // 1. Realtime listener for user's accounts
  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setTransfers([]);
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);
    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    const unsubAccounts = onSnapshot(
      accountsRef,
      (snapshot) => {
        const list: AccountItem[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AccountItem);
        });
        // Sort accounts by type/name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setAccounts(list);
        setLoadingAccounts(false);
      },
      (err) => {
        console.warn('Error listening to accounts:', err);
        setLoadingAccounts(false);
      }
    );

    const transfersRef = collection(db, 'users', user.uid, 'account_transfers');
    const qTransfers = query(transfersRef, orderBy('createdAt', 'desc'));
    const unsubTransfers = onSnapshot(
      qTransfers,
      (snapshot) => {
        const list: AccountTransferRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AccountTransferRecord);
        });
        setTransfers(list);
      },
      (err) => {
        console.warn('Error listening to account transfers:', err);
      }
    );

    return () => {
      unsubAccounts();
      unsubTransfers();
    };
  }, [user]);

  // Total balance sum of all active accounts
  const totalBalance = useMemo(() => {
    return accounts
      .filter((a) => a.isActive !== false)
      .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  }, [accounts]);

  // Create new account
  const addAccount = useCallback(
    async (params: {
      name: string;
      type: AccountType;
      currency: CurrencyCode;
      initialBalance: number;
      notes?: string;
    }) => {
      if (!user) return;
      const now = new Date().toISOString();
      const accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newAccountData: Record<string, any> = {
        id: accountId,
        userId: user.uid,
        name: params.name.trim(),
        type: params.type,
        currency: params.currency,
        initialBalance: Number(params.initialBalance) || 0,
        currentBalance: Number(params.initialBalance) || 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const trimmedNotes = params.notes?.trim();
      if (trimmedNotes) {
        newAccountData.notes = trimmedNotes;
      }

      await setDoc(
        doc(db, 'users', user.uid, 'accounts', accountId),
        sanitizeFirestorePayload(newAccountData)
      );
    },
    [user]
  );

  // Update existing account
  const updateAccount = useCallback(
    async (id: string, params: Partial<AccountItem>) => {
      if (!user) return;
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;

      const updated: Record<string, any> = {
        ...acc,
        ...params,
        updatedAt: new Date().toISOString(),
      };

      if (params.notes !== undefined) {
        const trimmed = params.notes.trim();
        if (trimmed) {
          updated.notes = trimmed;
        } else {
          updated.notes = '';
        }
      }

      await setDoc(
        doc(db, 'users', user.uid, 'accounts', id),
        sanitizeFirestorePayload(updated),
        { merge: true }
      );
    },
    [user, accounts]
  );

  // Toggle active/inactive status
  const toggleAccountActive = useCallback(
    async (id: string) => {
      if (!user) return;
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;

      const payload = sanitizeFirestorePayload({
        isActive: !acc.isActive,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(
        doc(db, 'users', user.uid, 'accounts', id),
        payload,
        { merge: true }
      );
    },
    [user, accounts]
  );

  // Delete account
  const deleteAccount = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'users', user.uid, 'accounts', id));
    },
    [user]
  );

  // Transfer money between two user accounts
  const transferBetweenAccounts = useCallback(
    async (params: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      date: string;
      notes?: string;
    }) => {
      if (!user) return;
      const { fromAccountId, toAccountId, amount, date, notes } = params;

      if (fromAccountId === toAccountId) {
        throw new Error('A conta de origem e destino não podem ser a mesma.');
      }
      if (amount <= 0) {
        throw new Error('O valor da transferência deve ser maior que zero.');
      }

      const fromAcc = accounts.find((a) => a.id === fromAccountId);
      const toAcc = accounts.find((a) => a.id === toAccountId);

      if (!fromAcc || !toAcc) {
        throw new Error('Conta de origem ou destino não encontrada.');
      }

      const now = new Date().toISOString();
      const transferId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. Decrement fromAcc balance
      await setDoc(
        doc(db, 'users', user.uid, 'accounts', fromAccountId),
        sanitizeFirestorePayload({
          currentBalance: (fromAcc.currentBalance || 0) - amount,
          updatedAt: now,
        }),
        { merge: true }
      );

      // 2. Increment toAcc balance
      await setDoc(
        doc(db, 'users', user.uid, 'accounts', toAccountId),
        sanitizeFirestorePayload({
          currentBalance: (toAcc.currentBalance || 0) + amount,
          updatedAt: now,
        }),
        { merge: true }
      );

      // 3. Create transfer record
      const transferRecordData: Record<string, any> = {
        id: transferId,
        userId: user.uid,
        fromAccountId,
        fromAccountName: fromAcc.name,
        toAccountId,
        toAccountName: toAcc.name,
        amount,
        date,
        createdAt: now,
      };

      const trimmedNotes = notes?.trim();
      if (trimmedNotes) {
        transferRecordData.notes = trimmedNotes;
      }

      await setDoc(
        doc(db, 'users', user.uid, 'account_transfers', transferId),
        sanitizeFirestorePayload(transferRecordData)
      );
    },
    [user, accounts]
  );

  // Delete/revert transfer record
  const deleteTransfer = useCallback(
    async (transferId: string) => {
      if (!user) return;
      const tx = transfers.find((t) => t.id === transferId);
      if (!tx) return;

      const fromAcc = accounts.find((a) => a.id === tx.fromAccountId);
      const toAcc = accounts.find((a) => a.id === tx.toAccountId);

      const now = new Date().toISOString();

      // Revert balances
      if (fromAcc) {
        await setDoc(
          doc(db, 'users', user.uid, 'accounts', tx.fromAccountId),
          sanitizeFirestorePayload({
            currentBalance: (fromAcc.currentBalance || 0) + tx.amount,
            updatedAt: now,
          }),
          { merge: true }
        );
      }

      if (toAcc) {
        await setDoc(
          doc(db, 'users', user.uid, 'accounts', tx.toAccountId),
          sanitizeFirestorePayload({
            currentBalance: (toAcc.currentBalance || 0) - tx.amount,
            updatedAt: now,
          }),
          { merge: true }
        );
      }

      // Delete transfer log
      await deleteDoc(doc(db, 'users', user.uid, 'account_transfers', transferId));
    },
    [user, accounts, transfers]
  );

  // Adjust account balance when linked to an income/expense/bill
  const adjustAccountBalanceForFinancialItem = useCallback(
    async (accountId: string, amountDelta: number) => {
      if (!user || !accountId || amountDelta === 0) return;
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return;

      await setDoc(
        doc(db, 'users', user.uid, 'accounts', accountId),
        sanitizeFirestorePayload({
          currentBalance: (acc.currentBalance || 0) + amountDelta,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    },
    [user, accounts]
  );

  return {
    accounts,
    transfers,
    totalBalance,
    loadingAccounts,
    addAccount,
    updateAccount,
    toggleAccountActive,
    deleteAccount,
    transferBetweenAccounts,
    deleteTransfer,
    adjustAccountBalanceForFinancialItem,
  };
}
