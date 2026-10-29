/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  SharedBill,
  SharedUserSummary,
  SharedTransferRecord,
  SharedNotification,
  SharedInvitation,
  SplitMethod,
  CategoryScope,
} from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getTranslations } from '../../utils/i18n';
import { doesItemOccurInMonth, getEffectiveDateForMonth } from '../../utils/finance';
import { InvitePartnerModal } from './InvitePartnerModal';
import { SharedBillModal } from './SharedBillModal';
import { TransferConfirmationModal } from './TransferConfirmationModal';
import { SharedNotificationsModal } from './SharedNotificationsModal';
import {
  Users,
  UserPlus,
  Plus,
  ArrowRightLeft,
  Receipt,
  CheckCircle2,
  Check,
  AlertTriangle,
  Clock,
  Calendar,
  Tag,
  CheckSquare,
  Square,
  Bell,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Trash2,
  Edit,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Loader2,
} from 'lucide-react';

interface SharedAccountsViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  myUserId: string;
  connections: any[];
  activePartners: SharedUserSummary[];
  receivedInvitations: SharedInvitation[];
  sentInvitations: SharedInvitation[];
  sharedBills: SharedBill[];
  sharedTransfers: SharedTransferRecord[];
  sharedNotifications: SharedNotification[];
  unreadNotificationsCount: number;
  pendingReceivedInvitationsCount: number;
  onSendInvitation: (email: string) => Promise<{ success: boolean; message?: string }>;
  onRespondInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  onCreateSharedBill: (params: {
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
    recurrence?: 'none' | 'monthly';
    recurrenceMonthsCount?: number;
  }) => Promise<any>;
  onUpdateSharedBill: (
    billId: string,
    params: {
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
  ) => Promise<void>;
  onTransferShares: (billIds: string[]) => Promise<void>;
  onPayFullBillToCreditor: (billId: string, month: string) => Promise<void>;
  onSettleReimbursement: (billId: string, month: string) => Promise<void>;
  onDeleteSharedBill: (billId: string) => Promise<void>;
  onDeleteSharedBillOccurrence?: (
    billId: string,
    targetMonth: string,
    scope: 'this' | 'this_and_future'
  ) => Promise<void>;
  onRespondShareBillRequest?: (billId: string, accept: boolean) => Promise<void>;
  onMarkNotificationRead: (notifId: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onReturnToFinance?: () => void;
  getCategoriesFor?: (scope: 'bill' | 'income' | 'expense' | 'all') => string[];
  onAddCategory?: (name: string, scope: CategoryScope) => Promise<unknown>;
  isProcessing?: boolean;
}

export const SharedAccountsView: React.FC<SharedAccountsViewProps> = ({
  currency,
  language = 'pt',
  myUserId,
  activePartners,
  receivedInvitations,
  sentInvitations,
  sharedBills,
  sharedTransfers,
  sharedNotifications,
  unreadNotificationsCount,
  pendingReceivedInvitationsCount,
  onSendInvitation,
  onRespondInvitation,
  onCreateSharedBill,
  onUpdateSharedBill,
  onTransferShares,
  onPayFullBillToCreditor,
  onSettleReimbursement,
  onDeleteSharedBill,
  onDeleteSharedBillOccurrence,
  onRespondShareBillRequest,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onReturnToFinance,
  getCategoriesFor,
  onAddCategory,
  isProcessing,
}) => {
  const t = getTranslations(language);

  // Active sub-tab: 'bills' | 'statement'
  const [activeTab, setActiveTab] = useState<'bills' | 'statement'>('bills');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<SharedBill | null>(null);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [reimbursementBillToSettle, setReimbursementBillToSettle] = useState<SharedBill | null>(null);
  const [billToPayFull, setBillToPayFull] = useState<SharedBill | null>(null);
  const [isSubmittingPayFull, setIsSubmittingPayFull] = useState(false);
  const [isSubmittingReimb, setIsSubmittingReimb] = useState(false);

  // Recurrence Delete Prompt
  const [billToDelete, setBillToDelete] = useState<SharedBill | null>(null);
  const [isDeletingOccurrence, setIsDeletingOccurrence] = useState(false);

  // Multi-selection of bills for transfer
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);

  // Eligible bills for transfer: user's share is pending, bill not paid to creditor, and no reimbursement flow active
  const transferableBills = useMemo(() => {
    return sharedBills.filter((bill) => {
      const myShare = bill.shares[myUserId];
      const hasReimb = Boolean(bill.reimbursement);
      const isPaidToCred = bill.status === 'paid';
      return bill.status === 'pending' && myShare && myShare.status === 'pending' && !hasReimb && !isPaidToCred;
    });
  }, [sharedBills, myUserId]);

  // Selected bills objects
  const selectedBillsObjects = useMemo(() => {
    return sharedBills.filter((b) => selectedBillIds.includes(b.id));
  }, [sharedBills, selectedBillIds]);

  // Sum of selected bills to transfer
  const totalSelectedAmount = useMemo(() => {
    return selectedBillsObjects.reduce((sum, b) => {
      const myShare = b.shares[myUserId];
      return sum + (myShare?.amount || 0);
    }, 0);
  }, [selectedBillsObjects, myUserId]);

  // Primary partner for the selected bills
  const transferPartner = useMemo<SharedUserSummary | null>(() => {
    if (selectedBillsObjects.length === 0) return null;
    const partnerId = selectedBillsObjects[0].members.find((m) => m !== myUserId);
    if (!partnerId) return null;
    return activePartners.find((p) => p.uid === partnerId) || { uid: partnerId, displayName: 'Parceiro', email: '' };
  }, [selectedBillsObjects, activePartners, myUserId]);

  // Handle Select All / Clear Selection
  const handleToggleSelectAll = () => {
    if (selectedBillIds.length === transferableBills.length) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(transferableBills.map((b) => b.id));
    }
  };

  // Toggle single bill selection
  const handleToggleBillSelect = (billId: string) => {
    setSelectedBillIds((prev) =>
      prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]
    );
  };

  // Trigger single transfer flow
  const handleTransferSingle = (billId: string) => {
    setSelectedBillIds([billId]);
    setIsTransferModalOpen(true);
  };

  // Open batch transfer confirmation
  const handleOpenBatchTransfer = () => {
    if (selectedBillIds.length === 0) return;
    setIsTransferModalOpen(true);
  };

  // Outstanding reimbursements owed by me or to me (Occurrence aware)
  const reimbursementBills = useMemo(() => {
    return sharedBills.filter((b) => {
       // Root level legacy check
       if (b.reimbursement && b.reimbursement.status === 'pending') return true;
       // Check all monthly exceptions
       if (b.exceptions) {
          return Object.values(b.exceptions).some(ex => ex.reimbursement?.status === 'pending');
       }
       return false;
    });
  }, [sharedBills]);

  // Derived list of all pending reimbursements with their months
  const flattenedReimbursements = useMemo(() => {
    const list: { bill: SharedBill, month: string, reimb: any }[] = [];
    for (const b of sharedBills) {
      if (b.reimbursement && b.reimbursement.status === 'pending') {
        list.push({ bill: b, month: b.month || b.dueDate.substring(0, 7), reimb: b.reimbursement });
      }
      if (b.exceptions) {
        for (const [m, ex] of Object.entries(b.exceptions)) {
          if (ex.reimbursement && ex.reimbursement.status === 'pending') {
            list.push({ bill: b, month: m, reimb: ex.reimbursement });
          }
        }
      }
    }
    return list.sort((a, b) => b.month.localeCompare(a.month));
  }, [sharedBills]);

  // Handle delete click
  const handleDeleteClick = (bill: SharedBill) => {
    if (bill.recurrence === 'monthly') {
      setBillToDelete(bill);
    } else {
      if (confirm(`${t.deleteConfirmBill} "${bill.title}"?`)) {
        onDeleteSharedBill(bill.id);
      }
    }
  };

  const handleApplyRecurrenceDelete = async (scope: 'this' | 'this_and_future') => {
    if (!billToDelete || !onDeleteSharedBillOccurrence) return;
    try {
      setIsDeletingOccurrence(true);
      await onDeleteSharedBillOccurrence(billToDelete.id, selectedMonth, scope);
      setBillToDelete(null);
    } catch (err) {
      console.error('Error deleting shared bill occurrence:', err);
    } finally {
      setIsDeletingOccurrence(false);
    }
  };

  // Derived: Shared bills for the selected month (handling recurrence)
  const monthSharedBillsOccurrences = useMemo(() => {
    return sharedBills
      .filter((bill) => {
        return doesItemOccurInMonth(
          bill.startMonth || bill.month || (bill.dueDate ? bill.dueDate.substring(0, 7) : ''),
          selectedMonth,
          bill.recurrence || 'none',
          bill.recurrenceMonthsCount
        );
      })
      .map((bill) => {
        const effectiveDueDate = getEffectiveDateForMonth(selectedMonth, bill.dueDay || 1);
        const monthException = bill.exceptions?.[selectedMonth];
        return {
          ...bill,
          effectiveDueDate,
          monthException,
        };
      });
  }, [sharedBills, selectedMonth]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Month Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-slate-500">{t.monthFilterLabel || 'Filtrar por mês:'}</span>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
        />
      </div>
      {onReturnToFinance && (
        <button
          type="button"
          onClick={onReturnToFinance}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{language === 'es' ? 'Volver al Control Financiero' : 'Voltar ao Controle Financeiro'}</span>
        </button>
      )}

      {/* Top Banner Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.sharedAccounts}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.sharedAccountsDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setIsNotificationsModalOpen(true)}
              className="relative p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer disabled:opacity-50"
              title={t.notificationsTab}
            >
              <Bell className="w-4 h-4" />
              {(unreadNotificationsCount > 0 || pendingReceivedInvitationsCount > 0) && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount + pendingReceivedInvitationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.invitePerson}</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                setEditingBill(null);
                setIsBillModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{t.newSharedBill}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            {t.sharedPartners}:
          </span>
          {activePartners.length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              {t.noPartnersYet}
            </span>
          ) : (
            activePartners.map((partner) => (
              <div
                key={partner.uid}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs"
              >
                <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {partner.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {partner.displayName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  ({partner.email})
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Ativo" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invites Banner */}
      {pendingReceivedInvitationsCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold text-amber-900 dark:text-amber-200">
              {language === 'es'
                ? `Tienes ${pendingReceivedInvitationsCount} invitación(es) de cuenta compartida pendiente(s)`
                : language === 'en'
                ? `You have ${pendingReceivedInvitationsCount} pending shared account invite(s)`
                : `Você possui ${pendingReceivedInvitationsCount} convite(s) de conta compartilhada pendente(s)`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsNotificationsModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            {language === 'es' ? 'Ver invitaciones' : 'Ver convites'}
          </button>
        </div>
      )}

      {/* Reimbursement Alert Cards (Occurrence aware) */}
      {flattenedReimbursements.map(({ bill, month, reimb }) => {
        const isDebtor = reimb.fromUserId === myUserId;
        const partnerId = isDebtor ? reimb.toUserId : reimb.fromUserId;
        const partnerName =
          activePartners.find((p) => p.uid === partnerId)?.displayName || 'Parceiro';

        return (
          <div
            key={`reimb_${bill.id}_${month}`}
            className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isDebtor
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold block">
                  {isDebtor
                    ? `${t.reimbursementOwedByYou} a ${partnerName}: ${formatCurrency(reimb.amount, currency)}`
                    : `${partnerName} ${t.reimbursementOwedToYou}: ${formatCurrency(reimb.amount, currency)}`}
                </span>
                <span className="text-[11px] opacity-80">
                  {language === 'es' ? 'Referente a: ' : 'Referente a: '}
                  {bill.title} ({month})
                </span>
              </div>
            </div>

            {isDebtor && (
              <button
                type="button"
                onClick={() => setReimbursementBillToSettle({ ...bill, reimbursement: reimb, month })}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs self-end sm:self-center cursor-pointer"
              >
                {t.settleReimbursementBtn} ({formatCurrency(reimb.amount, currency)})
              </button>
            )}
          </div>
        );
      })}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'bills'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>{t.sharedBillsList}</span>
          <span className="text-[10px] font-mono-numbers px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800">
            {sharedBills.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statement')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'statement'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>{t.statementTab}</span>
          {sharedTransfers.length > 0 && (
            <span className="text-[10px] font-mono-numbers px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800">
              {sharedTransfers.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SHARED BILLS */}
      {activeTab === 'bills' && (
        <div className="space-y-3">
          {/* Batch Transfer Bar */}
          {transferableBills.length > 0 && (
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800/90 dark:to-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title={
                    selectedBillIds.length === transferableBills.length
                      ? t.clearSelection
                      : t.selectAllBills
                  }
                >
                  {selectedBillIds.length === transferableBills.length ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {selectedBillIds.length > 0
                      ? `${selectedBillIds.length} ${t.billsSelectedCount}`
                      : t.selectAllBills}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.totalToTransfer}:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono-numbers text-xs">
                      {formatCurrency(totalSelectedAmount, currency)}
                    </strong>
                  </span>
                </div>
              </div>

              {selectedBillIds.length > 0 && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleOpenBatchTransfer}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer self-stretch sm:self-auto disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  <span>
                    {language === 'es'
                      ? `Transferir ${formatCurrency(totalSelectedAmount, currency)}`
                      : `Transferir ${formatCurrency(totalSelectedAmount, currency)}`}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* List of Shared Bills */}
          {monthSharedBillsOccurrences.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {t.noSharedBillsYet}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {language === 'es'
                    ? 'Agrega facturas compartidas como alquiler, luz, internet o gastos comunes con porcentajes automáticos.'
                    : 'Adicione faturas compartilhadas como aluguel, luz, internet ou despesas conjuntas com divisões automáticas.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingBill(null);
                  setIsBillModalOpen(true);
                }}
                className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t.newSharedBill}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {monthSharedBillsOccurrences.map((bill) => {
                const partnerId = bill.members.find((m) => m !== myUserId) || '';
                const partnerSummary = activePartners.find((p) => p.uid === partnerId);
                const partnerName = partnerSummary?.displayName || 'Parceiro';

                const myShare = bill.shares[myUserId];
                const partnerShare = bill.shares[partnerId];

                // Month-specific status
                const mEx = bill.monthException;
                const isPaidToCreditor = (mEx?.status === 'paid') || (bill.recurrence === 'none' && bill.status === 'paid');
                
                const iTransferredMyShare = myShare?.status === 'transferred';
                const partnerTransferredToMe = partnerShare?.status === 'transferred';
                
                // Check if there's any reimbursement (pending or settled) for THIS month
                const anyReimbursement = mEx?.reimbursement || (bill.recurrence === 'none' ? bill.reimbursement : null);
                const pendingReimb = anyReimbursement?.status === 'pending' ? anyReimbursement : null;
                const iOweReimbursement = pendingReimb?.fromUserId === myUserId;

                const isSelected = selectedBillIds.includes(bill.id);

                // Transfer my share button is STRICTLY hidden if full bill was paid to creditor OR if a reimbursement flow exists
                const canSelectForTransfer =
                  bill.status === 'pending' &&
                  myShare?.status === 'pending' &&
                  !isPaidToCreditor &&
                  !anyReimbursement;

                return (
                  <div
                    key={`${bill.id}_${selectedMonth}`}
                    className={`p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border transition-all ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Checkbox + Title + Meta */}
                      <div className="flex items-start gap-3 min-w-0">
                        {canSelectForTransfer ? (
                          <button
                            type="button"
                            onClick={() => handleToggleBillSelect(bill.id)}
                            className="mt-0.5 p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                        ) : (
                          <div className="mt-0.5 p-1 text-slate-300 dark:text-slate-700 shrink-0">
                            {isPaidToCreditor ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Receipt className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {bill.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                              {bill.category}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold">
                              {bill.percentages[myUserId] || 50}% /{' '}
                              {bill.percentages[partnerId] || 50}%
                            </span>
                            {bill.recurrence === 'monthly' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                {t.recurringBadge}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>Vencimento: {bill.effectiveDueDate}</span>
                            </span>
                            <span>•</span>
                            <span>Total da Fatura: {formatCurrency(bill.amount, currency)}</span>
                            <span>•</span>
                            <span>Com: {partnerName}</span>
                          </div>

                          {/* Status explanations */}
                          <div className="pt-1 flex flex-wrap gap-1.5 text-[10px]">
                            {isPaidToCreditor && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{language === 'es' ? 'Pago al acreedor' : 'Paga ao credor'}</span>
                              </span>
                            )}

                            {pendingReimb && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {iOweReimbursement
                                    ? language === 'es'
                                      ? `Debes reembolso de ${formatCurrency(pendingReimb.amount, currency)} a ${partnerName}`
                                      : `Você deve reembolso de ${formatCurrency(pendingReimb.amount, currency)} para ${partnerName}`
                                    : language === 'es'
                                      ? `${partnerName} te debe reembolso de ${formatCurrency(pendingReimb.amount, currency)}`
                                      : `${partnerName} te deve reembolso de ${formatCurrency(pendingReimb.amount, currency)}`}
                                </span>
                              </span>
                            )}

                            {anyReimbursement?.status === 'settled' && (
                              <span className="px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{language === 'es' ? 'Reembolso liquidado ✓' : 'Reembolso quitado ✓'}</span>
                              </span>
                            )}

                            {iTransferredMyShare && !isPaidToCreditor && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>
                                  {language === 'es'
                                    ? `Transferido para ${partnerName} (Tu parte quitada)`
                                    : `Transferido para ${partnerName} (Sua parte quitada)`}
                                </span>
                              </span>
                            )}

                            {partnerTransferredToMe && !isPaidToCreditor && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                                {language === 'es'
                                  ? `${partnerName} te transfirió su parte (Pagas el total)`
                                  : `${partnerName} transferiu a parte dele (Você paga integral)`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amounts & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        {/* Obligations Breakdown */}
                        <div className="text-right font-mono-numbers">
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {t.myObligation}:
                          </span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(myShare?.amount || 0, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {partnerName}: {formatCurrency(partnerShare?.amount || 0, currency)}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {/* Single Transfer Button */}
                          {canSelectForTransfer && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleTransferSingle(bill.id)}
                              className="px-2.5 py-1.5 rounded-xl border border-emerald-500/80 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                              title="Transferir apenas minha parte para o parceiro"
                            >
                              {t.transferMyShare}
                            </button>
                          )}

                          {/* Quitar Reembolso (if debtor) */}
                          {iOweReimbursement && (
                            <button
                               type="button"
                               disabled={isProcessing}
                               onClick={() => setReimbursementBillToSettle({ ...bill, reimbursement: pendingReimb, month: selectedMonth })}
                               className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                               {t.settleReimbursementBtn}
                            </button>
                          )}

                          {/* Pay Full Bill to Creditor */}
                          {!isPaidToCreditor && !iTransferredMyShare && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setBillToPayFull(bill)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                              title={t.payFullBillDesc}
                            >
                              {t.payFullBill}
                            </button>
                          )}

                          {/* Edit Bill */}
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setEditingBill(bill);
                              setIsBillModalOpen(true);
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                            title={t.editItem}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                           {/* Delete Bill */}
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleDeleteClick(bill)}
                            className="p-1.5 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                            title={t.deleteItem}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXTRATO (STATEMENT) */}
      {activeTab === 'statement' && (
        <div className="space-y-3">
          <div className="p-3 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              {t.statementTab}
            </h3>

            {sharedTransfers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{t.noTransfersYet}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sharedTransfers.map((tx) => {
                  const isIncoming = tx.toUserId === myUserId;
                  const otherPartyName = isIncoming ? tx.fromUserName : tx.toUserName;

                  const dateFormatted = new Date(tx.createdAt).toLocaleDateString(
                    language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'pt-BR',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                            isIncoming
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncoming ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {isIncoming
                              ? `${t.receivedFrom} ${otherPartyName}`
                              : `${t.sentTo} ${otherPartyName}`}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {dateFormatted} • {tx.description}
                          </span>

                          {/* Related Bills Breakdown */}
                          {tx.billBreakdown && tx.billBreakdown.length > 0 && (
                            <div className="pt-1 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-semibold block text-[10px] uppercase tracking-wider text-slate-400">
                                {language === 'es' ? 'Referente a:' : 'Referente a:'}
                              </span>
                              {tx.billBreakdown.map((b) => (
                                <div key={b.billId} className="flex items-center gap-1.5">
                                  <span>•</span>
                                  <span>{b.title}:</span>
                                  <strong className="font-mono-numbers text-slate-700 dark:text-slate-300">
                                    {formatCurrency(b.amount, currency)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono-numbers self-end sm:self-center">
                        <span
                          className={`text-sm sm:text-base font-black ${
                            isIncoming
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncoming ? '+' : '-'} {formatCurrency(tx.amount, currency)}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {tx.status === 'completed' ? 'Concluído' : tx.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <InvitePartnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        language={language}
        onSendInvite={onSendInvitation}
      />

      {/* Shared Bill Create/Edit Modal */}
      <SharedBillModal
        isOpen={isBillModalOpen}
        onClose={() => {
          setIsBillModalOpen(false);
          setEditingBill(null);
        }}
        currency={currency}
        language={language}
        myUserId={myUserId}
        activePartners={activePartners}
        editingBill={editingBill}
        getCategoriesFor={getCategoriesFor}
        onAddCategory={onAddCategory}
        onSave={async (params) => {
          if (editingBill) {
            await onUpdateSharedBill(editingBill.id, params);
          } else {
            await onCreateSharedBill(params);
          }
        }}
      />

      {/* Transfer Confirmation Modal */}
      <TransferConfirmationModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        currency={currency}
        language={language}
        selectedBills={selectedBillsObjects}
        partner={transferPartner}
        myUserId={myUserId}
        onConfirmTransfer={async () => {
          await onTransferShares(selectedBillIds);
          setSelectedBillIds([]);
        }}
      />

      {/* Notifications Modal */}
      <SharedNotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        language={language}
        notifications={sharedNotifications}
        receivedInvitations={receivedInvitations}
        onAcceptInvitation={async (id) => {
          await onRespondInvitation(id, true);
        }}
        onRejectInvitation={async (id) => {
          await onRespondInvitation(id, false);
        }}
        onAcceptShareBillRequest={
          onRespondShareBillRequest
            ? async (id) => {
                await onRespondShareBillRequest(id, true);
              }
            : undefined
        }
        onRejectShareBillRequest={
          onRespondShareBillRequest
            ? async (id) => {
                await onRespondShareBillRequest(id, false);
              }
            : undefined
        }
        onMarkRead={onMarkNotificationRead}
        onMarkAllRead={onMarkAllNotificationsRead}
      />

      {/* Reimbursement Confirmation Modal */}
      {reimbursementBillToSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'es' ? 'Quitar Reembolso' : 'Quitar Reembolso'}
            </h3>
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {language === 'es'
                  ? `¿Deseas liquidar el reembolso de ${formatCurrency(reimbursementBillToSettle.reimbursement?.amount || 0, currency)}?`
                  : `Deseja quitar o reembolso de ${formatCurrency(reimbursementBillToSettle.reimbursement?.amount || 0, currency)}?`}
              </p>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 border border-slate-100 dark:border-slate-800">
                 <strong>Fatura:</strong> {reimbursementBillToSettle.title}<br/>
                 <strong>Mês:</strong> {(reimbursementBillToSettle as any).month || selectedMonth}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setReimbursementBillToSettle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                disabled={isSubmittingReimb || isProcessing}
                onClick={async () => {
                  if (reimbursementBillToSettle) {
                    try {
                      setIsSubmittingReimb(true);
                      await onSettleReimbursement(reimbursementBillToSettle.id, (reimbursementBillToSettle as any).month || selectedMonth);
                      setReimbursementBillToSettle(null);
                    } catch (err) {
                      console.error('Error settling reimbursement:', err);
                    } finally {
                      setIsSubmittingReimb(false);
                    }
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingReimb && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Full Bill to Creditor Confirmation Modal */}
      {billToPayFull && (() => {
        const partnerId = billToPayFull.members.find((m) => m !== myUserId);
        const partnerSummary = activePartners.find((p) => p.uid === partnerId);
        const partnerName = partnerSummary?.displayName || 'Parceiro';
        const partnerShare = partnerId ? billToPayFull.shares[partnerId] : null;
        const reimbAmount = partnerShare?.amount || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'es' ? 'Pagar Factura Completa' : 'Pagar Fatura Completa'}
              </h3>
              <div className="space-y-2 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  {language === 'es'
                    ? `Al pagar la factura completa al acreedor, registrarás el pago de ${formatCurrency(billToPayFull.amount, currency)}.`
                    : `Ao registrar o pagamento integral ao credor, você registrará ${formatCurrency(billToPayFull.amount, currency)} pago.`}
                </p>
                {reimbAmount > 0 && (
                  <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                    {language === 'es'
                      ? `Esto generará una deuda de reembolso de ${formatCurrency(reimbAmount, currency)} para ${partnerName}.`
                      : `Isso gerará uma dívida de reembolso de ${formatCurrency(reimbAmount, currency)} para ${partnerName}.`}
                  </p>
                )}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 border border-slate-100 dark:border-slate-800">
                  <strong>Fatura:</strong> {billToPayFull.title}<br />
                  <strong>Mês:</strong> {selectedMonth}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={isSubmittingPayFull}
                  onClick={() => setBillToPayFull(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingPayFull || isProcessing}
                  onClick={async () => {
                    try {
                      setIsSubmittingPayFull(true);
                      await onPayFullBillToCreditor(billToPayFull.id, selectedMonth);
                      setBillToPayFull(null);
                    } catch (err: any) {
                      console.error('Error paying full bill:', err);
                    } finally {
                      setIsSubmittingPayFull(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingPayFull && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t.confirmBtn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recurrence Delete Prompt Modal */}
      {billToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden overscroll-contain"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain my-auto">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm text-rose-950 dark:text-rose-100">
                    {t.recurringDeletePromptTitle || 'Excluir Fatura Recorrente'}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {t.recurringDeletePromptSubtitle || 'Esta é uma fatura mensal compartilhada. Como deseja excluí-la?'}
                  </p>
                  <p className="font-bold text-rose-700 dark:text-rose-400 mt-1 uppercase">
                    {billToDelete.title}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isDeletingOccurrence}
                  onClick={() => handleApplyRecurrenceDelete('this')}
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50/50 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-rose-600">
                      {t.deleteOnlyThisOption || 'Excluir apenas este mês'}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase">
                      {t.oneMonthBadge || '1 mês'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.deleteOnlyThisDesc || 'Remove apenas a ocorrência deste mês selecionado.'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isDeletingOccurrence}
                  onClick={() => handleApplyRecurrenceDelete('this_and_future')}
                  className="w-full p-3.5 rounded-2xl border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/40 hover:bg-rose-100/50 text-left transition-all cursor-pointer group shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                      {t.deleteThisAndFutureOption || 'Excluir esta e todas as próximas'}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold uppercase">
                      {t.allNextBadge || 'Todas próximas'}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5 opacity-80">
                    {t.deleteThisAndFutureDesc || 'Remove esta e todas as faturas futuras desta série.'}
                  </p>
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isDeletingOccurrence}
                  onClick={() => setBillToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
