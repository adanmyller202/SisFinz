/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountItem, AccountTransferRecord, CurrencyCode, LanguageCode } from '../types';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import { formatDayMonthLabel } from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { AccountModal, ACCOUNT_TYPE_CONFIG } from './AccountModal';
import { TransferBetweenAccountsModal } from './TransferBetweenAccountsModal';
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  History,
  Info,
  Loader2,
} from 'lucide-react';

interface AccountsViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  onReturnToFinance?: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  currency,
  language = 'pt',
  onReturnToFinance,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);

  const {
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
  } = useAccounts();

  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');

  // Modal states
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const activeAccountsCount = accounts.filter((a) => a.isActive !== false).length;

  const handleOpenNewAccount = () => {
    setAccountToEdit(null);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: AccountItem) => {
    setAccountToEdit(acc);
    setIsAccountModalOpen(true);
  };

  const handleDeleteAccountConfirm = async (acc: AccountItem) => {
    if (
      confirm(
        language === 'es'
          ? `¿Estás seguro de eliminar la cuenta "${acc.name}"?`
          : language === 'en'
          ? `Are you sure you want to delete account "${acc.name}"?`
          : `Tem certeza que deseja excluir a conta "${acc.name}"?`
      )
    ) {
      await deleteAccount(acc.id);
    }
  };

  const handleDeleteTransferConfirm = async (tx: AccountTransferRecord) => {
    if (
      confirm(
        language === 'es'
          ? `¿Deseas deshacer la transferencia de ${formatCurrency(tx.amount, currency)} de "${tx.fromAccountName}" a "${tx.toAccountName}"? Esto revertirá los saldos de ambas cuentas.`
          : `Deseja desfazer a transferência de ${formatCurrency(tx.amount, currency)} de "${tx.fromAccountName}" para "${tx.toAccountName}"? Isso reverterá os saldos das duas contas.`
      )
    ) {
      await deleteTransfer(tx.id);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. TOP SUMMARY BANNER CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>{language === 'es' ? 'Saldo Total en Cuentas' : language === 'en' ? 'Total Balance in Accounts' : 'Saldo Total em Contas'}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono-numbers tracking-tight">
              {formatCurrency(totalBalance, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {activeAccountsCount}{' '}
              {activeAccountsCount === 1
                ? language === 'es'
                  ? 'cuenta activa'
                  : 'conta ativa'
                : language === 'es'
                ? 'cuentas activas'
                : 'contas ativas'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenNewAccount}
              className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'es' ? 'Nueva Cuenta' : 'Nova Conta'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              disabled={activeAccountsCount < 2}
              className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title={
                activeAccountsCount < 2
                  ? language === 'es'
                    ? 'Necesitas al menos 2 cuentas para transferir'
                    : 'Você precisa de pelo menos 2 contas para transferir'
                  : ''
              }
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{language === 'es' ? 'Transferir' : 'Transferir'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TAB SWITCHER */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'accounts'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>{language === 'es' ? 'Mis Cuentas' : 'Minhas Contas'} ({accounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4 text-emerald-600" />
          <span>{language === 'es' ? 'Historial de Transferencias' : 'Histórico de Transferências'} ({transfers.length})</span>
        </button>
      </div>

      {/* 3. TAB 1: MINHAS CONTAS LIST */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          {loadingAccounts ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
              <p className="text-xs font-bold">
                {language === 'es' ? 'Cargando cuentas...' : 'Carregando contas...'}
              </p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl">
                🏦
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'es' ? 'Aún no tienes cuentas registradas' : 'Você ainda não possui contas cadastradas'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {language === 'es'
                  ? 'Registra tus cuentas bancarias, billeteras digitales o tu saldo en efectivo (Efectivo) para dar seguimiento exacto a tu dinero.'
                  : 'Cadastre suas contas bancárias, carteiras digitais ou seu saldo em dinheiro (Efectivo) para ter controle preciso sobre seu dinheiro.'}
              </p>
              <button
                type="button"
                onClick={handleOpenNewAccount}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'es' ? 'Registrar Primera Cuenta' : 'Cadastrar Primeira Conta'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((acc) => {
                const typeCfg = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.other;
                const isInactive = acc.isActive === false;

                return (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                      isInactive
                        ? 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50'
                    }`}
                  >
                    {/* Header: Icon & Account Name & Type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0">
                          {typeCfg.emoji}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {acc.name}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400 block truncate">
                            {typeCfg.label[language] || typeCfg.label.pt}
                          </span>
                        </div>
                      </div>

                      {/* Active Status Badge */}
                      <button
                        type="button"
                        onClick={() => toggleAccountActive(acc.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                          isInactive
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}
                        title={
                          isInactive
                            ? language === 'es'
                              ? 'Cuenta inactiva (clic para activar)'
                              : 'Conta inativa (clique para ativar)'
                            : language === 'es'
                            ? 'Cuenta activa (clic para desactivar)'
                            : 'Conta ativa (clique para desativar)'
                        }
                      >
                        {isInactive ? (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Inativa</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Ativa</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Balance */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                        {language === 'es' ? 'Saldo Actual' : 'Saldo Atual'}
                      </span>
                      <div className="text-lg sm:text-xl font-black font-mono-numbers text-slate-900 dark:text-white tracking-tight truncate">
                        {formatCurrency(acc.currentBalance, acc.currency || currency)}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {language === 'es' ? 'Saldo inicial:' : 'Saldo inicial:'}{' '}
                        {formatCurrency(acc.initialBalance, acc.currency || currency)}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAccount(acc)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={t.editItem}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAccountConfirm(acc)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={t.deleteItem}
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

      {/* 4. TAB 2: HISTÓRICO DE TRANSFERÊNCIAS */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>{language === 'es' ? 'Movimientos Entre Cuentas' : 'Movimentações Entre Contas'}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono-numbers font-semibold">
              {transfers.length} {transfers.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {transfers.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <ArrowRightLeft className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'es'
                  ? 'No hay transferencias registradas aún.'
                  : 'Nenhuma transferência entre contas registrada ainda.'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {language === 'es'
                  ? 'Las transferencias mueven saldos entre tus cuentas sin contarse como gasto o ingreso.'
                  : 'As transferências movimentam saldos entre suas contas sem alterar relatórios de gastos ou receitas.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transfers.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ArrowRightLeft className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex-wrap">
                        <span className="text-rose-600 dark:text-rose-400">{tx.fromAccountName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400">{tx.toAccountName}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                        <span className="font-semibold">{formatDayMonthLabel(tx.date, locale)}</span>
                        {tx.notes && (
                          <>
                            <span>•</span>
                            <span className="italic truncate max-w-[200px]">{tx.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm sm:text-base font-black font-mono-numbers text-slate-900 dark:text-white">
                      {formatCurrency(tx.amount, currency)}
                    </span>

                    {/* Undo / Delete Transfer Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTransferConfirm(tx)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={language === 'es' ? 'Deshacer transferencia y revertir saldos' : 'Desfazer transferência e reverter saldos'}
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

      {/* Account Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currency={currency}
        language={language}
        editingAccount={accountToEdit}
        onSave={async (params) => {
          if (accountToEdit) {
            await updateAccount(accountToEdit.id, params);
          } else {
            await addAccount(params);
          }
        }}
      />

      {/* Transfer Modal */}
      <TransferBetweenAccountsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        currency={currency}
        language={language}
        onExecuteTransfer={transferBetweenAccounts}
      />
    </div>
  );
};
