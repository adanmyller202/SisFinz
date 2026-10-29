/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, sanitizeForFirestore } from '../firebase/config';
import { getMonthDiff } from '../utils/finance';
import { hashEmail } from '../utils/crypto';
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import {
  SharedConnection,
  SharedInvitation,
  SharedBill,
  SharedTransferRecord,
  SharedNotification,
  UserDirectoryEntry,
  SharedUserSummary,
  SplitMethod,
  FinanceSettings,
} from '../types';

export function useSharedAccounts() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [connections, setConnections] = useState<SharedConnection[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<SharedInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<SharedInvitation[]>([]);
  const [sharedBills, setSharedBills] = useState<SharedBill[]>([]);
  const [sharedTransfers, setSharedTransfers] = useState<SharedTransferRecord[]>([]);
  const [sharedNotifications, setSharedNotifications] = useState<SharedNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Prevent double-click execution ref guard
  const isTransferringRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

  // 1. Listen for Connections where user is a member
  useEffect(() => {
    if (!userId) {
      setConnections([]);
      return;
    }

    const q = query(
      collection(db, 'shared_connections'),
      where('members', 'array-contains', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedConnection[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as SharedConnection;
          if (data.status === 'active') {
            list.push(data);
          }
        });
        setConnections(list);
      },
      (err) => console.warn('Shared connections listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // 2. Listen for Received Invitations
  useEffect(() => {
    if (!userId) {
      setReceivedInvitations([]);
      return;
    }

    const q = query(
      collection(db, 'shared_invitations'),
      where('toUserId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedInvitation[] = [];
        snapshot.forEach((d) => list.push(d.data() as SharedInvitation));
        setReceivedInvitations(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => console.warn('Received invitations listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // 3. Listen for Sent Invitations
  useEffect(() => {
    if (!userId) {
      setSentInvitations([]);
      return;
    }

    const q = query(
      collection(db, 'shared_invitations'),
      where('fromUserId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedInvitation[] = [];
        snapshot.forEach((d) => list.push(d.data() as SharedInvitation));
        setSentInvitations(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => console.warn('Sent invitations listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // 4. Listen for Shared Bills
  useEffect(() => {
    if (!userId) {
      setSharedBills([]);
      return;
    }

    const q = query(
      collection(db, 'shared_bills'),
      where('members', 'array-contains', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedBill[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as SharedBill;
          if (!data.hiddenForUsers || !data.hiddenForUsers.includes(userId)) {
            list.push(data);
          }
        });
        // Sort by due date
        setSharedBills(list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        setLoading(false);
      },
      (err) => {
        console.warn('Shared bills listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  // 5. Listen for Shared Transfers (Extrato)
  useEffect(() => {
    if (!userId) {
      setSharedTransfers([]);
      return;
    }

    // Query transfers where user is either sender or recipient
    const qFrom = query(
      collection(db, 'shared_transfers'),
      where('fromUserId', '==', userId)
    );
    const qTo = query(
      collection(db, 'shared_transfers'),
      where('toUserId', '==', userId)
    );

    let fromList: SharedTransferRecord[] = [];
    let toList: SharedTransferRecord[] = [];

    const mergeTransfers = () => {
      const map = new Map<string, SharedTransferRecord>();
      [...fromList, ...toList].forEach((t) => map.set(t.id, t));
      const combined = Array.from(map.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setSharedTransfers(combined);
    };

    const unsubFrom = onSnapshot(
      qFrom,
      (snap) => {
        fromList = snap.docs.map((d) => d.data() as SharedTransferRecord);
        mergeTransfers();
      },
      (err) => console.warn('Transfers from listener error:', err)
    );

    const unsubTo = onSnapshot(
      qTo,
      (snap) => {
        toList = snap.docs.map((d) => d.data() as SharedTransferRecord);
        mergeTransfers();
      },
      (err) => console.warn('Transfers to listener error:', err)
    );

    return () => {
      unsubFrom();
      unsubTo();
    };
  }, [userId]);

  // 6. Listen for Notifications
  useEffect(() => {
    if (!userId) {
      setSharedNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'shared_notifications'),
      where('userId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedNotification[] = [];
        snapshot.forEach((d) => list.push(d.data() as SharedNotification));
        setSharedNotifications(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => console.warn('Shared notifications listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // Derived: Active Partners list
  const activePartners = useMemo<SharedUserSummary[]>(() => {
    if (!userId) return [];
    const partners: SharedUserSummary[] = [];
    const seen = new Set<string>();

    for (const conn of connections) {
      const partnerId = conn.members.find((m) => m !== userId);
      if (partnerId && !seen.has(partnerId)) {
        seen.add(partnerId);
        const profile = conn.memberProfiles?.[partnerId];
        if (profile) {
          partners.push(profile);
        } else {
          partners.push({ uid: partnerId, displayName: 'Parceiro', email: '' });
        }
      }
    }
    return partners;
  }, [connections, userId]);

  // Derived: Unread notifications count
  const unreadNotificationsCount = useMemo(() => {
    return sharedNotifications.filter((n) => !n.isRead).length;
  }, [sharedNotifications]);

  // Pending invitations count for badges
  const pendingReceivedInvitationsCount = useMemo(() => {
    return receivedInvitations.filter((i) => i.status === 'pending').length;
  }, [receivedInvitations]);

  // Search user in directory by exact email (via token-authenticated and rate-limited backend)
  const searchUserByEmail = useCallback(
    async (email: string): Promise<UserDirectoryEntry | null> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return null;
      if (!user) throw new Error('Usuário não autenticado.');

      try {
        const idToken = await user.getIdToken();
        const resp = await fetch('/api/search-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ email: cleanEmail }),
        });

        if (resp.status === 429) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Muitas tentativas de busca. Aguarde um minuto.');
        }

        if (resp.status === 401) {
          throw new Error('Sessão expirada ou autenticação inválida.');
        }

        if (resp.ok) {
          const data = await resp.json();
          if (data.found && data.user) {
            return {
              uid: data.user.uid,
              email: data.user.email,
              displayName: data.user.displayName,
              updatedAt: new Date().toISOString(),
            };
          }
        }
        return null;
      } catch (err: any) {
        if (err.message && (err.message.includes('Muitas tentativas') || err.message.includes('Sessão'))) {
          throw err;
        }
        console.warn('Search user error:', err);
        return null;
      }
    },
    [user]
  );

  // Send an invitation to another user
  const sendInvitation = useCallback(
    async (targetEmail: string): Promise<{ success: boolean; message?: string }> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const cleanEmail = targetEmail.trim().toLowerCase();

      if (cleanEmail === (user.email || '').toLowerCase()) {
        return { success: false, message: 'Você não pode convidar a si mesmo.' };
      }

      const targetUser = await searchUserByEmail(cleanEmail);
      if (!targetUser) {
        return {
          success: false,
          message: 'Usuário não encontrado. Verifique se o e-mail está cadastrado no SisFinz.',
        };
      }

      // Check if already connected
      const alreadyConnected = connections.some((c) =>
        c.members.includes(targetUser.uid)
      );
      if (alreadyConnected) {
        return { success: false, message: 'Vocês já possuem uma conta compartilhada ativa.' };
      }

      // Check if there's already a pending invitation
      const existingSent = sentInvitations.find(
        (i) => i.toUserId === targetUser.uid && i.status === 'pending'
      );
      if (existingSent) {
        return { success: false, message: 'Já existe um convite pendente para este usuário.' };
      }

      const now = new Date().toISOString();
      const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';

      const invitation: SharedInvitation = {
        id: invId,
        fromUserId: userId,
        fromUserName: myName,
        fromUserEmail: user.email || '',
        toUserId: targetUser.uid,
        toUserEmail: targetUser.email,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      // Create invitation in Firestore
      await setDoc(doc(db, 'shared_invitations', invId), sanitizeForFirestore(invitation));

      // Create notification for target user
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notif: SharedNotification = {
        id: notifId,
        userId: targetUser.uid,
        fromUserId: userId,
        fromUserName: myName,
        type: 'invitation_received',
        title: 'Novo convite de Conta Compartilhada',
        message: `${myName} (${user.email}) convidou você para compartilhar faturas e despesas no SisFinz.`,
        data: { invitationId: invId },
        isRead: false,
        status: 'pending',
        createdAt: now,
      };
      await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));

      return { success: true };
    },
    [userId, user, connections, sentInvitations, searchUserByEmail]
  );

  // Accept or Reject Invitation
  const respondInvitation = useCallback(
    async (invitationId: string, accept: boolean): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const invitation = receivedInvitations.find((i) => i.id === invitationId);
      if (!invitation) throw new Error('Convite não encontrado.');

      const now = new Date().toISOString();
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';

      if (accept) {
        // 1. Update invitation to accepted
        await setDoc(
          doc(db, 'shared_invitations', invitationId),
          { status: 'accepted', updatedAt: now },
          { merge: true }
        );

        // 2. Create connection
        const connId = `conn_${[invitation.fromUserId, userId].sort().join('_')}`;
        const connection: SharedConnection = {
          id: connId,
          members: [invitation.fromUserId, userId],
          memberProfiles: {
            [invitation.fromUserId]: {
              uid: invitation.fromUserId,
              displayName: invitation.fromUserName,
              email: invitation.fromUserEmail,
            },
            [userId]: {
              uid: userId,
              displayName: myName,
              email: user.email || '',
            },
          },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'shared_connections', connId), sanitizeForFirestore(connection));

        // 3. Notify sender
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: invitation.fromUserId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'invitation_accepted',
          title: 'Convite Aceito!',
          message: `${myName} aceitou seu convite de Conta Compartilhada no SisFinz.`,
          data: { invitationId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      } else {
        // Reject
        await setDoc(
          doc(db, 'shared_invitations', invitationId),
          { status: 'rejected', updatedAt: now },
          { merge: true }
        );

        // Notify sender
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: invitation.fromUserId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'invitation_rejected',
          title: 'Convite Recusado',
          message: `${myName} recusou seu convite de Conta Compartilhada.`,
          data: { invitationId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      }
    },
    [userId, user, receivedInvitations]
  );

  // Create a Shared Bill
  const createSharedBill = useCallback(
    async (params: {
      title: string;
      amount: number;
      dueDate: string;
      dueDay: number;
      category: string;
      notes?: string;
      partnerId: string;
      splitMethod: SplitMethod;
      myPercentage: number;
      partnerPercentage: number;
      isPendingRequest?: boolean;
      recurrence?: 'none' | 'monthly';
      recurrenceMonthsCount?: number;
    }): Promise<SharedBill> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      if (params.myPercentage + params.partnerPercentage !== 100) {
        throw new Error('A soma das porcentagens deve ser exatamente 100%.');
      }

      const billId = `sbill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const month = params.dueDate.substring(0, 7);

      const myShareAmount = Math.round((params.amount * params.myPercentage) / 100);
      const partnerShareAmount = params.amount - myShareAmount;

      const newBill: SharedBill = {
        id: billId,
        createdBy: userId,
        members: [userId, params.partnerId],
        title: params.title.trim(),
        amount: params.amount,
        dueDate: params.dueDate,
        dueDay: params.dueDay,
        month,
        category: params.category,
        notes: params.notes?.trim() || undefined,
        splitMethod: params.splitMethod,
        percentages: {
          [userId]: params.myPercentage,
          [params.partnerId]: params.partnerPercentage,
        },
        shares: {
          [userId]: {
            amount: myShareAmount,
            percentage: params.myPercentage,
            status: 'pending',
          },
          [params.partnerId]: {
            amount: partnerShareAmount,
            percentage: params.partnerPercentage,
            status: 'pending',
          },
        },
        status: 'pending',
        paymentResponsibility: null,
        shareRequest: params.isPendingRequest
          ? {
              status: 'pending',
              requestedTo: params.partnerId,
              requestedBy: userId,
              createdAt: now,
            }
          : undefined,
        createdAt: now,
        updatedAt: now,
        recurrence: params.recurrence || 'none',
        recurrenceMonthsCount: params.recurrenceMonthsCount,
        startMonth: month,
      };

      await setDoc(doc(db, 'shared_bills', billId), sanitizeForFirestore(newBill));

      // Send notification to partner
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notif: SharedNotification = {
        id: notifId,
        userId: params.partnerId,
        fromUserId: userId,
        fromUserName: myName,
        type: params.isPendingRequest ? 'share_bill_request' : 'bill_created',
        title: params.isPendingRequest
          ? 'Solicitação para compartilhar fatura'
          : 'Nova fatura compartilhada criada',
        message: params.isPendingRequest
          ? `${myName} quer compartilhar a fatura "${params.title}" ($${params.amount.toLocaleString()} - sua parte: $${partnerShareAmount.toLocaleString()}).`
          : `${myName} adicionou a fatura compartilhada "${params.title}" (sua parte: $${partnerShareAmount.toLocaleString()}).`,
        data: { billId, amount: partnerShareAmount },
        isRead: false,
        status: params.isPendingRequest ? 'pending' : 'resolved',
        createdAt: now,
      };
      await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));

      return newBill;
    },
    [userId, user]
  );

  // Update an existing Shared Bill
  const updateSharedBill = useCallback(
    async (
      billId: string,
      updates: {
        title: string;
        amount: number;
        dueDate: string;
        dueDay: number;
        category: string;
        notes?: string;
        splitMethod: SplitMethod;
        myPercentage: number;
        partnerPercentage: number;
      }
    ): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const bill = sharedBills.find((b) => b.id === billId);
      if (!bill) throw new Error('Fatura não encontrada.');

      if (updates.myPercentage + updates.partnerPercentage !== 100) {
        throw new Error('As porcentagens devem somar 100%.');
      }

      const partnerId = bill.members.find((m) => m !== userId);
      if (!partnerId) throw new Error('Parceiro não encontrado.');

      const now = new Date().toISOString();
      const month = updates.dueDate.substring(0, 7);
      const myShareAmount = Math.round((updates.amount * updates.myPercentage) / 100);
      const partnerShareAmount = updates.amount - myShareAmount;

      const updatedShares = {
        [userId]: {
          ...bill.shares[userId],
          amount: myShareAmount,
          percentage: updates.myPercentage,
        },
        [partnerId]: {
          ...bill.shares[partnerId],
          amount: partnerShareAmount,
          percentage: updates.partnerPercentage,
        },
      };

      const updatedBillData: Partial<SharedBill> = {
        title: updates.title.trim(),
        amount: updates.amount,
        dueDate: updates.dueDate,
        dueDay: updates.dueDay,
        month,
        category: updates.category,
        notes: updates.notes?.trim() || undefined,
        splitMethod: updates.splitMethod,
        percentages: {
          [userId]: updates.myPercentage,
          [partnerId]: updates.partnerPercentage,
        },
        shares: updatedShares,
        updatedAt: now,
      };

      await setDoc(doc(db, 'shared_bills', billId), sanitizeForFirestore(updatedBillData), {
        merge: true,
      });

      // Send update notification to partner
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notif: SharedNotification = {
        id: notifId,
        userId: partnerId,
        fromUserId: userId,
        fromUserName: myName,
        type: 'bill_updated',
        title: 'Fatura compartilhada atualizada',
        message: `${myName} atualizou a fatura "${updates.title}". O valor total agora é $${updates.amount.toLocaleString()} (sua parte: $${partnerShareAmount.toLocaleString()}).`,
        data: { billId, amount: partnerShareAmount },
        isRead: false,
        status: 'resolved',
        createdAt: now,
      };
      await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
    },
    [userId, user, sharedBills]
  );

  // Accept or reject a bill share request
  const respondShareBillRequest = useCallback(
    async (billId: string, accept: boolean): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const bill = sharedBills.find((b) => b.id === billId);
      if (!bill) throw new Error('Fatura não encontrada.');

      const now = new Date().toISOString();
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
      const requesterId = bill.shareRequest?.requestedBy || bill.createdBy;

      if (accept) {
        await setDoc(
          doc(db, 'shared_bills', billId),
          {
            shareRequest: { status: 'accepted', requestedTo: userId, requestedBy: requesterId, createdAt: now },
            updatedAt: now,
          },
          { merge: true }
        );

        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: requesterId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'share_bill_accepted',
          title: 'Compartilhamento aceito',
          message: `${myName} aceitou compartilhar a fatura "${bill.title}".`,
          data: { billId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      } else {
        // If rejected, mark request as rejected
        await setDoc(
          doc(db, 'shared_bills', billId),
          {
            shareRequest: { status: 'rejected', requestedTo: userId, requestedBy: requesterId, createdAt: now },
            updatedAt: now,
          },
          { merge: true }
        );

        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: requesterId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'share_bill_rejected',
          title: 'Compartilhamento recusado',
          message: `${myName} recusou o compartilhamento da fatura "${bill.title}".`,
          data: { billId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      }
    },
    [userId, user, sharedBills]
  );

  // TRANSFER SHARE OF ONE OR MULTIPLE BILLS
  // User transfers their share to the partner, who takes 100% payment responsibility.
  // Atomic transaction prevents double-spend / idempotency protection.
  const transferShares = useCallback(
    async (billIds: string[]): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      if (billIds.length === 0) throw new Error('Nenhuma fatura selecionada.');

      // Concurrency guard
      if (isTransferringRef.current || isProcessingRef.current) {
        console.warn('Transfer already in progress, ignoring duplicate call.');
        return;
      }
      isTransferringRef.current = true;
      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        const targetBills = sharedBills.filter((b) => billIds.includes(b.id));
        if (targetBills.length !== billIds.length) {
          throw new Error('Algumas faturas selecionadas não foram encontradas.');
        }

        // Identify partner: all selected bills must share the same partner
        const partnerIds = new Set<string>();
        targetBills.forEach((b) => {
          const p = b.members.find((m) => m !== userId);
          if (p) partnerIds.add(p);
        });

        if (partnerIds.size !== 1) {
          throw new Error('Todas as faturas selecionadas devem ser com a mesma pessoa.');
        }

        const partnerId = Array.from(partnerIds)[0];
        const partnerSummary = activePartners.find((p) => p.uid === partnerId);
        const partnerName = partnerSummary?.displayName || 'Parceiro';
        const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';

        // Calculate total amount to transfer
        let totalAmount = 0;
        const breakdown: { billId: string; title: string; amount: number }[] = [];

        for (const bill of targetBills) {
          const myShare = bill.shares[userId];
          if (!myShare || myShare.status !== 'pending') {
            throw new Error(`A fatura "${bill.title}" não está pendente para transferência.`);
          }
          totalAmount += myShare.amount;
          breakdown.push({
            billId: bill.id,
            title: bill.title,
            amount: myShare.amount,
          });
        }

        if (totalAmount <= 0) {
          throw new Error('O valor total para transferência deve ser maior que zero.');
        }

        const now = new Date().toISOString();
        const transferId = `stran_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // Firestore Atomic Transaction
        await runTransaction(db, async (tx) => {
          // Record expense in sender's ledger
          const senderExpId = `exp_${transferId}`;
          const senderExpRef = doc(db, 'users', userId, 'expenses', senderExpId);
          tx.set(
            senderExpRef,
            sanitizeForFirestore({
              id: senderExpId,
              userId,
              name: `Transferência p/ ${partnerName} (${targetBills.length} fatura${targetBills.length > 1 ? 's' : ''})`,
              amount: totalAmount,
              date: now.slice(0, 10),
              category: 'Contas Compartilhadas',
              notes: breakdown.map((b) => `${b.title}: $${b.amount.toLocaleString()}`).join(', '),
              createdAt: now,
              updatedAt: now,
            })
          );

          // 7. Record income in recipient's ledger (marked completed)
          const recipientIncId = `inc_${transferId}`;
          const recipientIncRef = doc(db, 'users', partnerId, 'incomes', recipientIncId);
          tx.set(
            recipientIncRef,
            sanitizeForFirestore({
              id: recipientIncId,
              userId: partnerId,
              name: `Transferência recebida de ${myName} (${targetBills.length} fatura${targetBills.length > 1 ? 's' : ''})`,
              amount: totalAmount,
              expectedDate: now.slice(0, 10),
              expectedDay: Number(now.slice(8, 10)),
              category: 'Contas Compartilhadas',
              notes: breakdown.map((b) => `${b.title}: $${b.amount.toLocaleString()}`).join(', '),
              recurrence: 'none',
              startMonth: now.slice(0, 7),
              createdAt: now,
              updatedAt: now,
            })
          );

          // 8. Update each shared bill
          for (const bill of targetBills) {
            const billRef = doc(db, 'shared_bills', bill.id);
            tx.set(
              billRef,
              sanitizeForFirestore({
                shares: {
                  ...bill.shares,
                  [userId]: {
                    ...bill.shares[userId],
                    status: 'transferred',
                    transferredTo: partnerId,
                    transferredAt: now,
                  },
                },
                // Recipient is now 100% responsible for the entire bill to creditor
                paymentResponsibility: partnerId,
                updatedAt: now,
              }),
              { merge: true }
            );
          }

          // 9. Create Shared Transfer statement record
          const transferRef = doc(db, 'shared_transfers', transferId);
          const transferRecord: SharedTransferRecord = {
            id: transferId,
            fromUserId: userId,
            fromUserName: myName,
            toUserId: partnerId,
            toUserName: partnerName,
            amount: totalAmount,
            billIds,
            billBreakdown: breakdown,
            description: `Transferência referente a ${breakdown.length} fatura${breakdown.length > 1 ? 's' : ''}`,
            type: 'share_transfer',
            status: 'completed',
            createdAt: now,
          };
          tx.set(transferRef, sanitizeForFirestore(transferRecord));

          // 10. Send notification to recipient
          const notifRecRef = doc(db, 'shared_notifications', `notif_${transferId}_rec`);
          tx.set(
            notifRecRef,
            sanitizeForFirestore({
              id: `notif_${transferId}_rec`,
              userId: partnerId,
              fromUserId: userId,
              fromUserName: myName,
              type: 'transfer_received',
              title: `Transferência de $${totalAmount.toLocaleString()} recebida`,
              message: `${myName} transferiu $${totalAmount.toLocaleString()} para seu saldo referente a ${breakdown.length} fatura(s). Você agora é responsável pelo pagamento integral.`,
              data: { transferId, amount: totalAmount, relatedBillsCount: breakdown.length },
              isRead: false,
              status: 'resolved',
              createdAt: now,
            })
          );
        });
      } finally {
        isTransferringRef.current = false;
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [userId, user, sharedBills, activePartners]
  );

  // PAY FULL BILL TO CREDITOR (Occurrence aware)
  const payFullBillToCreditor = useCallback(
    async (billId: string, targetMonth?: string): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      if (isProcessingRef.current) {
        console.warn('Action in progress, resetting guard.');
        isProcessingRef.current = false;
      }
      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        const bill = sharedBills.find((b) => b.id === billId);
        if (!bill) throw new Error('Fatura não encontrada.');
        
        const currentMonth = targetMonth || bill.dueDate.substring(0, 7);
        const exception = bill.exceptions?.[currentMonth];
        const isPaid = (exception?.status === 'paid') || (bill.recurrence === 'none' && bill.status === 'paid');
        if (isPaid) throw new Error('Esta fatura já está paga para este mês.');

        const partnerId = bill.members.find((m) => m !== userId);
        if (!partnerId) throw new Error('Parceiro não encontrado.');

        const now = new Date().toISOString();
        const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
        const partnerSummary = activePartners.find((p) => p.uid === partnerId);
        const partnerName = partnerSummary?.displayName || 'Parceiro';

        const partnerShare = bill.shares[partnerId];
        const partnerAlreadyTransferred = partnerShare?.status === 'transferred' || exception?.shares?.[partnerId]?.status === 'transferred';

        await runTransaction(db, async (tx) => {
          // Record expense for payer
          const expId = `exp_pay_${bill.id}_${currentMonth}`;
          const expRef = doc(db, 'users', userId, 'expenses', expId);
          tx.set(
            expRef,
            sanitizeForFirestore({
              id: expId,
              userId,
              name: `Pagamento Fatura: ${bill.title} (Integral)`,
              amount: bill.amount,
              date: now.slice(0, 10),
              category: bill.category || 'Contas Compartilhadas',
              notes: `Pagamento ao credor da fatura compartilhada com ${partnerName} (Mês: ${currentMonth})`,
              createdAt: now,
              updatedAt: now,
            })
          );

          // Update bill status (Specific to month via exceptions)
          const updatedExceptions = {
            ...(bill.exceptions || {}),
            [currentMonth]: {
              ...(bill.exceptions?.[currentMonth] || {}),
              status: 'paid' as const,
              paidBy: userId,
              paidAt: now,
              paidAmount: bill.amount,
            }
          };

          // If partner hadn't transferred, they owe reimbursement for THIS month
          if (!partnerAlreadyTransferred && partnerShare?.amount > 0) {
            (updatedExceptions[currentMonth] as any).reimbursement = {
              fromUserId: partnerId,
              toUserId: userId,
              amount: partnerShare.amount,
              status: 'pending',
            };
          }

          const billRef = doc(db, 'shared_bills', bill.id);
          tx.set(
            billRef,
            sanitizeForFirestore({ 
              exceptions: updatedExceptions, 
              updatedAt: now,
              // Keep legacy status for non-recurring or compatibility
              status: bill.recurrence === 'none' ? 'paid' : bill.status,
              paidBy: bill.recurrence === 'none' ? userId : (bill.paidBy || null),
              paidAt: bill.recurrence === 'none' ? now : (bill.paidAt || null),
            }),
            { merge: true }
          );

          // Send notification
          const notifId = `notif_paid_${bill.id}_${currentMonth}`;
          const notifRef = doc(db, 'shared_notifications', notifId);
          tx.set(
            notifRef,
            sanitizeForFirestore({
              id: notifId,
              userId: partnerId,
              fromUserId: userId,
              fromUserName: myName,
              type: 'bill_paid',
              title: `Fatura "${bill.title}" foi paga`,
              message: partnerAlreadyTransferred
                ? `${myName} registrou o pagamento integral de $${bill.amount.toLocaleString()} da fatura "${bill.title}" (${currentMonth}).`
                : `${myName} pagou a fatura total "${bill.title}" ($${bill.amount.toLocaleString()}) em ${currentMonth}. Você deve $${partnerShare.amount.toLocaleString()} de reembolso.`,
              data: {
                billId: bill.id,
                month: currentMonth,
                amount: bill.amount,
                reimbursementAmount: !partnerAlreadyTransferred ? partnerShare.amount : 0,
              },
              isRead: false,
              status: 'resolved',
              createdAt: now,
            })
          );
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, 'runTransaction/payFullBillToCreditor');
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [userId, user, sharedBills, activePartners]
  );

  // SETTLE REIMBURSEMENT (Occurrence aware)
  const settleReimbursement = useCallback(
    async (billId: string, targetMonth?: string): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        const bill = sharedBills.find((b) => b.id === billId);
        if (!bill) throw new Error('Fatura não encontrada.');
        
        const currentMonth = targetMonth || (bill.reimbursement?.status === 'pending' ? bill.month : null);
        if (!currentMonth) {
          // If no month provided, look for any pending reimbursement in exceptions
          const months = Object.keys(bill.exceptions || {}).filter(m => bill.exceptions![m].reimbursement?.status === 'pending' && bill.exceptions![m].reimbursement?.fromUserId === userId);
          if (months.length === 0 && bill.reimbursement?.status !== 'pending') {
             throw new Error('Não há reembolso pendente para você nesta fatura.');
          }
        }
        
        const effectiveMonth = currentMonth || bill.month;
        const reimb = (bill.exceptions?.[effectiveMonth]?.reimbursement) || bill.reimbursement;
        
        if (!reimb || reimb.status !== 'pending' || reimb.fromUserId !== userId) {
          throw new Error('Não há reembolso pendente para você nesta fatura.');
        }

        const toUserId = reimb.toUserId;
        const partnerSummary = activePartners.find((p) => p.uid === toUserId);
        const partnerName = partnerSummary?.displayName || 'Parceiro';
        const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
        const amount = reimb.amount;
        const now = new Date().toISOString();
        const transferId = `sreimb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        await runTransaction(db, async (tx) => {
          // Record expense in debtor's ledger
          const expRef = doc(db, 'users', userId, 'expenses', `exp_${transferId}`);
          tx.set(
            expRef,
            sanitizeForFirestore({
              id: `exp_${transferId}`,
              userId,
              name: `Reembolso pago a ${partnerName}: ${bill.title}`,
              amount,
              date: now.slice(0, 10),
              category: 'Contas Compartilhadas',
              notes: `Quitação de reembolso da fatura ${bill.title} (${effectiveMonth})`,
              createdAt: now,
              updatedAt: now,
            })
          );

          // Record income in creditor's ledger
          const incRef = doc(db, 'users', toUserId, 'incomes', `inc_${transferId}`);
          tx.set(
            incRef,
            sanitizeForFirestore({
              id: `inc_${transferId}`,
              userId: toUserId,
              name: `Reembolso recebido de ${myName}: ${bill.title}`,
              amount,
              expectedDate: now.slice(0, 10),
              expectedDay: Number(now.slice(8, 10)),
              category: 'Contas Compartilhadas',
              notes: `Reembolso quitado para a fatura ${bill.title} (${effectiveMonth})`,
              recurrence: 'none',
              startMonth: now.slice(0, 7),
              createdAt: now,
              updatedAt: now,
            })
          );

          // Update reimbursement status
          const updatedExceptions = {
             ...(bill.exceptions || {}),
             [effectiveMonth]: {
                ...(bill.exceptions?.[effectiveMonth] || {}),
                reimbursement: {
                  ...reimb,
                  status: 'settled' as const,
                  settledAt: now,
                  transferId,
                }
             }
          };

          const billRef = doc(db, 'shared_bills', bill.id);
          tx.set(
            billRef,
            sanitizeForFirestore({
              exceptions: updatedExceptions,
              updatedAt: now,
              // Legacy root compatibility
              reimbursement: bill.recurrence === 'none' ? {
                ...reimb,
                status: 'settled',
                settledAt: now,
                transferId,
              } : (bill.reimbursement || null)
            }),
            { merge: true }
          );

          // Statement record
          const transferRef = doc(db, 'shared_transfers', transferId);
          tx.set(
            transferRef,
            sanitizeForFirestore({
              id: transferId,
              fromUserId: userId,
              fromUserName: myName,
              toUserId,
              toUserName: partnerName,
              amount,
              billIds: [bill.id],
              billBreakdown: [{ billId: bill.id, title: bill.title, amount }],
              description: `Reembolso quitado referente a ${bill.title} (${effectiveMonth})`,
              type: 'reimbursement',
              status: 'completed',
              createdAt: now,
            })
          );

          // Notification to partner
          const notifRef = doc(db, 'shared_notifications', `notif_${transferId}`);
          tx.set(
            notifRef,
            sanitizeForFirestore({
              id: `notif_${transferId}`,
              userId: toUserId,
              fromUserId: userId,
              fromUserName: myName,
              type: 'transfer_received',
              title: `Reembolso de $${amount.toLocaleString()} recebido`,
              message: `${myName} transferiu $${amount.toLocaleString()} de reembolso da fatura "${bill.title}" (${effectiveMonth}).`,
              data: { transferId, amount, billId: bill.id, month: effectiveMonth },
              isRead: false,
              status: 'resolved',
              createdAt: now,
            })
          );
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, 'runTransaction/settleReimbursement');
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [userId, user, sharedBills, activePartners]
  );


  // Toggle my share status as paid/pending
  const toggleSharePaid = useCallback(
    async (billId: string, isPaid: boolean, targetMonth?: string): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const bill = sharedBills.find((b) => b.id === billId);
      if (!bill) return;

      const effectiveMonth = targetMonth || bill.month || (bill.dueDate ? bill.dueDate.substring(0, 7) : '');
      const existingException = bill.exceptions?.[effectiveMonth] || {};
      const existingMonthShares = existingException.shares || bill.shares;
      const existingReimb = existingException.reimbursement || (bill.recurrence === 'none' ? bill.reimbursement : null);

      const now = new Date().toISOString();
      const updatedShares = {
        ...bill.shares,
        [userId]: {
          ...bill.shares[userId],
          status: isPaid ? ('paid' as const) : ('pending' as const),
        },
      };

      const payload: any = {
        shares: updatedShares,
        updatedAt: now,
      };

      const updatedExceptionObj: any = {
        ...existingException,
        shares: {
          ...existingMonthShares,
          [userId]: {
            ...(existingMonthShares[userId] || {}),
            status: isPaid ? 'paid' : 'pending',
          },
        },
      };

      // If user owes reimbursement for this month and marks as paid, settle the reimbursement
      if (existingReimb && existingReimb.fromUserId === userId) {
        updatedExceptionObj.reimbursement = {
          ...existingReimb,
          status: isPaid ? 'settled' : 'pending',
          settledAt: isPaid ? now : undefined,
        };
        if (bill.recurrence === 'none') {
          payload.reimbursement = {
            ...existingReimb,
            status: isPaid ? 'settled' : 'pending',
            settledAt: isPaid ? now : undefined,
          };
        }
      }

      if (effectiveMonth) {
        payload.exceptions = {
          ...(bill.exceptions || {}),
          [effectiveMonth]: updatedExceptionObj,
        };
      }

      try {
        await setDoc(doc(db, 'shared_bills', billId), sanitizeForFirestore(payload), { merge: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shared_bills/${billId}`);
      }
    },
    [userId, sharedBills]
  );


  // Delete a shared bill (Creator executes global delete; participant only hides for themselves)
  const deleteSharedBill = useCallback(
    async (billId: string, skipConfirm = false): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (isProcessing) return;

      const targetBill = sharedBills.find((b) => b.id === billId);
      if (!targetBill) return;

      const isCreator = targetBill.createdBy === userId;

      if (!skipConfirm) {
        if (isCreator) {
          if (
            !confirm(
              'Você é o criador desta fatura compartilhada. Deseja realmente excluí-la definitivamente para todos os participantes?'
            )
          ) {
            return;
          }
        } else {
          if (
            !confirm(
              'Como participante, esta fatura será apenas ocultada da sua visualização e continuará ativa para o criador. Deseja continuar?'
            )
          ) {
            return;
          }
        }
      }

      setIsProcessing(true);
      try {
        if (isCreator) {
          // Global delete executed only by the creator
          await deleteDoc(doc(db, 'shared_bills', billId));
        } else {
          // Non-creator: hide from this user's view only, without modifying or deleting data for the creator
          const currentHidden = targetBill.hiddenForUsers || [];
          if (!currentHidden.includes(userId)) {
            const billRef = doc(db, 'shared_bills', billId);
            await setDoc(
              billRef,
              sanitizeForFirestore({
                hiddenForUsers: [...currentHidden, userId],
                updatedAt: new Date().toISOString(),
              }),
              { merge: true }
            );
          }
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `shared_bills/${billId}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [userId, isProcessing, sharedBills]
  );

  const deleteSharedBillOccurrence = useCallback(
    async (
      billId: string,
      targetMonth: string,
      scope: 'this' | 'this_and_future'
    ) => {
      if (!userId) return;
      const targetBill = sharedBills.find((b) => b.id === billId);
      if (!targetBill) return;

      const now = new Date().toISOString();

      if (targetBill.recurrence === 'none') {
        await deleteSharedBill(billId, true);
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
        
        try {
          const billRef = doc(db, 'shared_bills', billId);
          await setDoc(billRef, sanitizeForFirestore(partial), { merge: true });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, `shared_bills/${billId}`);
        }
        return;
      }

      // scope === 'this_and_future'
      const startM = targetBill.startMonth || targetBill.month || (targetBill.dueDate ? targetBill.dueDate.substring(0, 7) : '');
      const diff = getMonthDiff(startM, targetMonth);
      
      if (diff <= 0) {
        await deleteSharedBill(billId, true);
        return;
      }

      const cappedOriginal: Partial<SharedBill> = {
        recurrenceMonthsCount: diff,
        updatedAt: now,
      };
      
      try {
        const oldRef = doc(db, 'shared_bills', billId);
        await setDoc(oldRef, sanitizeForFirestore(cappedOriginal), { merge: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shared_bills/${billId}`);
      }
    },
    [userId, sharedBills, deleteSharedBill]
  );

  // Mark notification as read
  const markNotificationRead = useCallback(
    async (notifId: string): Promise<void> => {
      if (!userId) return;
      try {
        await setDoc(doc(db, 'shared_notifications', notifId), { isRead: true }, { merge: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shared_notifications/${notifId}`);
      }
    },
    [userId]
  );

  // Mark all notifications as read
  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const unread = sharedNotifications.filter((n) => !n.isRead);
      if (unread.length === 0) return;
      
      const promises = unread.map((n) =>
        setDoc(doc(db, 'shared_notifications', n.id), { isRead: true }, { merge: true })
      );
      await Promise.all(promises);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'shared_notifications/all');
    }
  }, [userId, sharedNotifications]);

  return {
    connections,
    activePartners,
    receivedInvitations,
    sentInvitations,
    sharedBills,
    sharedTransfers,
    sharedNotifications,
    unreadNotificationsCount,
    pendingReceivedInvitationsCount,
    loading,
    isProcessing,
    searchUserByEmail,
    sendInvitation,
    respondInvitation,
    createSharedBill,
    updateSharedBill,
    respondShareBillRequest,
    transferShares,
    payFullBillToCreditor,
    settleReimbursement,
    deleteSharedBill,
    deleteSharedBillOccurrence,
    toggleSharePaid,
    markNotificationRead,
    markAllNotificationsRead,
  };
}

// ==========================================
// Firestore Error Handling
// ==========================================

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'authenticated', // Simplified for client side
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
