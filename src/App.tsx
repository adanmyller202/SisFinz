/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useMoneyChallenge } from './hooks/useMoneyChallenge';
import { AuthScreen } from './components/AuthScreen';
import { EmailVerificationScreen } from './components/EmailVerificationScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DepositModal } from './components/DepositModal';
import { GoalModal } from './components/GoalModal';
import { EditGoalModal } from './components/EditGoalModal';
import { AvulsoDepositModal } from './components/AvulsoDepositModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { MoneChatModal } from './components/MoneChatModal';
import { CelebrationModal } from './components/CelebrationModal';
import { AchievementToast } from './components/AchievementToast';
import { FinanceDashboard } from './components/FinanceDashboard';
import { ObjectivesView } from './components/ObjectivesView';
import { NavigationDrawerModal } from './components/NavigationDrawerModal';
import { SharedAccountsView } from './components/shared/SharedAccountsView';
import { FiftyTwoWeekChallengeView } from './components/FiftyTwoWeekChallengeView';
import { FullReportView } from './components/FullReportView';
import { AccountsView } from './components/AccountsView';
import { useFinanceControl } from './hooks/useFinanceControl';
import { useSharedAccounts } from './hooks/useSharedAccounts';
import { useCategories } from './hooks/useCategories';
import { useFiftyTwoWeekChallenge } from './hooks/useFiftyTwoWeekChallenge';
import { Bot, Sparkles, Loader2 } from 'lucide-react';
import { getTranslations } from './utils/i18n';
import { db } from './firebase/config';
import { collection, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const lang = 'pt';

  const {
    goals,
    activeGoal,
    activeCurrency,
    activeGoalSquares,
    savedAmount,
    targetAmount,
    remainingAmount,
    financialProgressPercent,
    completedSquaresCount,
    totalSquaresCount,
    squaresProgressPercent,
    loadingData,
    settings,
    unlockedAchievements,
    recentAchievement,
    clearRecentAchievement,
    justFinishedAll,
    clearJustFinishedAll,
    completeSquare,
    uncompleteSquare,
    addAvulsoDeposit,
    createGoal,
    updateGoal,
    deleteGoal,
    switchGoal,
    updateSettings,
    resetActiveGoal,
    resetAllData,
    exportData,
    importData,
  } = useMoneyChallenge();

  const currentLang = settings.language || 'pt';
  const t = getTranslations(currentLang);

  const { getCategoriesFor, addCategory } = useCategories();
  const sharedAccounts = useSharedAccounts();
  const fiftyTwoChallenge = useFiftyTwoWeekChallenge();

  // Hook into finance data for Mone assistant
  const {
    bills,
    incomes,
    expenses,
    currentBalance,
    statusRecords,
    addBill,
    updateBill,
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
    updateCurrentBalance,
    resetAllFinanceData,
  } = useFinanceControl(sharedAccounts.sharedBills);

  const handleFactoryResetAll = useCallback(async () => {
    await resetAllFinanceData();
    await resetAllData();
  }, [resetAllFinanceData, resetAllData]);

  // Complete Account Backup: exports bills, incomes, expenses, categories, statusRecords, balance, goals, settings
  const handleExportCompleteBackup = useCallback(async () => {
    if (!user) return;
    try {
      let customCategories: any[] = [];
      let categoryOverrides: any = null;
      let savingsList: any[] = [];
      let savingTxList: any[] = [];
      try {
        const catSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
        catSnap.forEach((d) => customCategories.push(d.data()));
        const overridesDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'category_overrides'));
        if (overridesDoc.exists()) {
          categoryOverrides = overridesDoc.data();
        }
        const savingsSnap = await getDocs(collection(db, 'users', user.uid, 'savings'));
        savingsSnap.forEach((d) => savingsList.push(d.data()));
        const txSnap = await getDocs(collection(db, 'users', user.uid, 'saving_transactions'));
        txSnap.forEach((d) => savingTxList.push(d.data()));
      } catch (err) {
        console.warn('Could not read categories or savings for backup:', err);
      }

      const backup = {
        version: 3,
        app: 'money-challenge-finance',
        userId: user.uid,
        exportedAt: new Date().toISOString(),
        settings,
        currentBalance,
        goals,
        bills,
        incomes,
        expenses,
        savings: savingsList,
        savingTransactions: savingTxList,
        statusRecords,
        customCategories,
        categoryOverrides,
        unlockedAchievements,
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backup, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `backup-completo-financas-${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Export complete backup failed:', err);
    }
  }, [
    user,
    settings,
    currentBalance,
    goals,
    bills,
    incomes,
    expenses,
    statusRecords,
    unlockedAchievements,
  ]);

  // Complete Account Restore: restores bills, incomes, expenses, categories, statusRecords, balance, goals, settings
  const handleImportCompleteBackup = useCallback(
    async (jsonString: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Arquivo de backup inválido.');
        }

        const now = new Date().toISOString();

        // 1. Restore Goals
        if (Array.isArray(parsed.goals) && parsed.goals.length > 0) {
          for (const g of parsed.goals) {
            if (!g.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'goals', g.id), {
              ...g,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 2. Restore Bills
        if (Array.isArray(parsed.bills)) {
          for (const b of parsed.bills) {
            if (!b.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'bills', b.id), {
              ...b,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 3. Restore Incomes
        if (Array.isArray(parsed.incomes)) {
          for (const inc of parsed.incomes) {
            if (!inc.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'incomes', inc.id), {
              ...inc,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 4. Restore Expenses
        if (Array.isArray(parsed.expenses)) {
          for (const exp of parsed.expenses) {
            if (!exp.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'expenses', exp.id), {
              ...exp,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 5. Restore Status Records (monthly payment/receipt states)
        if (Array.isArray(parsed.statusRecords)) {
          for (const s of parsed.statusRecords) {
            if (!s.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'monthly_status', s.id), {
              ...s,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 6. Restore Custom Categories
        if (Array.isArray(parsed.customCategories)) {
          for (const c of parsed.customCategories) {
            if (!c.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'categories', c.id), {
              ...c,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 7. Restore Category Overrides
        if (parsed.categoryOverrides) {
          await setDoc(
            doc(db, 'users', user.uid, 'settings', 'category_overrides'),
            parsed.categoryOverrides
          );
        }

        // 8. Restore Balance / Finance Settings
        if (parsed.currentBalance !== undefined || parsed.financeSettings) {
          const bal = Number(parsed.currentBalance ?? parsed.financeSettings?.currentBalance ?? 0);
          await setDoc(doc(db, 'users', user.uid, 'finance_settings', 'main'), {
            userId: user.uid,
            currentBalance: bal,
            initialBalance: parsed.financeSettings?.initialBalance ?? bal,
            updatedAt: now,
          });
        }

        // 9. Restore App Settings (currency, language, theme, sound)
        if (parsed.settings && typeof parsed.settings === 'object') {
          await updateSettings(parsed.settings);
        }

        // 10. Restore achievements
        if (Array.isArray(parsed.unlockedAchievements)) {
          await setDoc(doc(db, 'users', user.uid, 'achievements', 'unlocked'), {
            list: parsed.unlockedAchievements,
            updatedAt: now,
          });
        }

        // 11. Restore Savings Goals
        if (Array.isArray(parsed.savings)) {
          for (const s of parsed.savings) {
            if (!s.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'savings', s.id), {
              ...s,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 12. Restore Savings Transactions
        if (Array.isArray(parsed.savingTransactions)) {
          for (const tx of parsed.savingTransactions) {
            if (!tx.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'saving_transactions', tx.id), {
              ...tx,
              userId: user.uid,
            });
          }
        }

        return true;
      } catch (err) {
        console.error('Import / Restore error:', err);
        return false;
      }
    },
    [user, updateSettings]
  );

  // Navigation View: Controle financeiro, Ahorros, Objetivos, Categorías, Gráfico Mensal, Contas Compartilhadas, ou Desafio de 52 Semanas
  const [currentView, setCurrentView] = useState<
    'finance' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts'
  >('finance');

  // Ensure every account always starts with the same clean, standard financial layout on sign-in
  React.useEffect(() => {
    setCurrentView('finance');
  }, [user?.uid]);

  const handleSaveNewGoal = useCallback(
    async (params: any) => {
      const created = await createGoal(params);
      setCurrentView('goals');
      return created;
    },
    [createGoal]
  );

  // Modals state
  const [activeSquareId, setActiveSquareId] = useState<number | null>(null);
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);
  const [isAvulsoModalOpen, setIsAvulsoModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoneChatOpen, setIsMoneChatOpen] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);

  // Selected square clicked in grid
  const handleSquareClick = (squareId: number) => {
    setActiveSquareId(squareId);
  };

  const isSquareCompleted = useMemo(() => {
    if (!activeGoal || activeSquareId === null) return false;
    return activeGoal.completedSquares.includes(activeSquareId);
  }, [activeGoal, activeSquareId]);

  const currentSquareObj = useMemo(() => {
    if (activeSquareId === null) return null;
    const found = activeGoalSquares.find((s) => s.id === activeSquareId);
    return found || { id: activeSquareId, value: activeSquareId };
  }, [activeSquareId, activeGoalSquares]);

  const depositRecord = useMemo(() => {
    if (!activeGoal || activeSquareId === null) return undefined;
    return activeGoal.history.find((h) => h.squareNumber === activeSquareId);
  }, [activeGoal, activeSquareId]);

  const [resetCode, setResetCode] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const code = params.get('oobCode');
      if (mode === 'resetPassword' && code) {
        setResetCode(code);
      }
    }
  }, []);

  if (resetCode) {
    return (
      <ResetPasswordScreen
        oobCode={resetCode}
        language={currentLang}
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          setResetCode(null);
        }}
      />
    );
  }

  // 1. Initial auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-semibold tracking-wide">
          {currentLang === 'pt'
            ? 'Carregando Controle Financeiro...'
            : currentLang === 'es'
            ? 'Cargando Control Financiero...'
            : 'Loading Financial Control...'}
        </p>
      </div>
    );
  }

  // 2. Not authenticated -> Render Login / Signup
  if (!user) {
    return <AuthScreen language={currentLang} />;
  }

  // 3. Authenticated but email NOT verified -> Render Email Verification Screen
  if (!user.emailVerified) {
    return <EmailVerificationScreen language={currentLang} />;
  }

  // 4. Authenticated & verified user
  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300 relative">
      {/* Top Navbar */}
      <Navbar
        onOpenMenu={() => setIsNavDrawerOpen(true)}
        currentView={currentView}
        goals={goals}
        activeGoal={activeGoal}
        currency={activeCurrency}
        language={currentLang}
        onSelectCurrency={(newCur) => updateSettings({ currency: newCur })}
        onOpenNewGoalModal={() => setIsNewGoalOpen(true)}
        darkMode={settings.darkMode}
        onToggleDarkMode={() => updateSettings({ darkMode: !settings.darkMode })}
        hasPendingNotifications={sharedAccounts.pendingReceivedInvitationsCount > 0 || sharedAccounts.unreadNotificationsCount > 0}
      />

      {/* Main Content Area */}
      {loadingData ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
          <p className="text-xs font-semibold">
            {currentLang === 'pt'
              ? 'Sincronizando seus dados financeiros...'
              : currentLang === 'es'
              ? 'Sincronizando tus datos financieros...'
              : 'Synchronizing your financial data...'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          {/* Content Viewport: Clean, wide, space-saving layout */}
          <main className="flex-1 min-w-0 p-2 sm:p-3.5 lg:p-5 space-y-3 max-w-full overflow-x-hidden">
            {currentView === 'goals' ? (
              <ObjectivesView
                goals={goals}
                activeGoal={activeGoal}
                activeGoalSquares={activeGoalSquares}
                currency={activeCurrency}
                language={currentLang}
                savedAmount={savedAmount}
                targetAmount={targetAmount}
                remainingAmount={remainingAmount}
                financialProgressPercent={financialProgressPercent}
                completedSquaresCount={completedSquaresCount}
                totalSquaresCount={totalSquaresCount}
                squaresProgressPercent={squaresProgressPercent}
                onSwitchGoal={switchGoal}
                onOpenNewGoalModal={() => setIsNewGoalOpen(true)}
                onOpenEditGoalModal={() => setIsEditGoalOpen(true)}
                onOpenAvulsoModal={() => setIsAvulsoModalOpen(true)}
                onDeleteGoal={deleteGoal}
                onSquareClick={handleSquareClick}
                selectedSquareId={activeSquareId}
                onReturnToFinance={() => setCurrentView('finance')}
              />
            ) : currentView === 'shared_accounts' ? (
              !user.emailVerified ? (
                <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-3xl space-y-3 my-6">
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                    {t.sharedAccountRequiresVerification}
                  </p>
                </div>
              ) : (
                <SharedAccountsView
                  currency={activeCurrency}
                  language={currentLang}
                  myUserId={user.uid}
                  connections={sharedAccounts.connections}
                  activePartners={sharedAccounts.activePartners}
                  receivedInvitations={sharedAccounts.receivedInvitations}
                  sentInvitations={sharedAccounts.sentInvitations}
                  sharedBills={sharedAccounts.sharedBills}
                  sharedTransfers={sharedAccounts.sharedTransfers}
                  sharedNotifications={sharedAccounts.sharedNotifications}
                  unreadNotificationsCount={sharedAccounts.unreadNotificationsCount}
                  pendingReceivedInvitationsCount={sharedAccounts.pendingReceivedInvitationsCount}
                  onSendInvitation={sharedAccounts.sendInvitation}
                  onRespondInvitation={sharedAccounts.respondInvitation}
                  onCreateSharedBill={sharedAccounts.createSharedBill}
                  onUpdateSharedBill={sharedAccounts.updateSharedBill}
                  onTransferShares={sharedAccounts.transferShares}
                  onPayFullBillToCreditor={sharedAccounts.payFullBillToCreditor}
                  onSettleReimbursement={sharedAccounts.settleReimbursement}
                  onDeleteSharedBill={sharedAccounts.deleteSharedBill}
                  onDeleteSharedBillOccurrence={sharedAccounts.deleteSharedBillOccurrence}
                  onRespondShareBillRequest={sharedAccounts.respondShareBillRequest}
                  onMarkNotificationRead={sharedAccounts.markNotificationRead}
                  onMarkAllNotificationsRead={sharedAccounts.markAllNotificationsRead}
                  onReturnToFinance={() => setCurrentView('finance')}
                  getCategoriesFor={getCategoriesFor}
                  onAddCategory={addCategory}
                />
              )
            ) : currentView === 'challenge_52' ? (
              <FiftyTwoWeekChallengeView
                currency={activeCurrency}
                language={currentLang}
                activeChallenge={fiftyTwoChallenge.activeChallenge}
                challenges={fiftyTwoChallenge.challenges}
                onSelectChallenge={fiftyTwoChallenge.setActiveChallengeId}
                onCreateChallenge={fiftyTwoChallenge.createChallenge}
                onCompleteWeek={fiftyTwoChallenge.completeWeek}
                onUndoWeek={fiftyTwoChallenge.undoWeek}
                onDeleteChallenge={fiftyTwoChallenge.deleteChallenge}
                onAddExpense={addExpense}
                onDeleteExpense={deleteExpense}
                onReturnToFinance={() => setCurrentView('finance')}
              />
            ) : currentView === 'full_report' ? (
              <FullReportView
                currency={activeCurrency}
                language={currentLang}
                bills={bills}
                incomes={incomes}
                expenses={expenses}
                statusRecords={statusRecords}
                sharedBills={sharedAccounts.sharedBills}
                sharedTransfers={sharedAccounts.sharedTransfers}
                activePartners={sharedAccounts.activePartners}
                myUserId={user.uid}
                onReturnToFinance={() => setCurrentView('finance')}
              />
            ) : currentView === 'accounts' ? (
              <AccountsView
                currency={activeCurrency}
                language={currentLang}
                onReturnToFinance={() => setCurrentView('finance')}
              />
            ) : (
              <FinanceDashboard
                currency={activeCurrency}
                language={currentLang}
                onOpenMoneChat={() => setIsMoneChatOpen(true)}
                goals={goals}
                activeGoal={activeGoal}
                onNavigateToGoals={() => setCurrentView('goals')}
                onNavigateToAccounts={() => setCurrentView('accounts')}
                initialTab={
                  currentView === 'savings'
                    ? 'savings'
                    : currentView === 'categories'
                    ? 'categories'
                    : currentView === 'report'
                    ? 'report'
                    : 'timeline'
                }
                onReturnToFinance={() => setCurrentView('finance')}
                activePartners={sharedAccounts.activePartners}
                onShareWithPartner={async (params) => {
                  await sharedAccounts.createSharedBill({
                    ...params,
                    splitMethod: 'fifty_fifty',
                    myPercentage: 50,
                    partnerPercentage: 50,
                    isPendingRequest: true,
                    recurrence: 'none',
                    recurrenceMonthsCount: 0,
                  });
                }}
                onToggleBillPaidCustom={async (billId, month, isPaid) => {
                  if (billId.startsWith('sb_')) {
                    const realId = billId.replace('sb_', '');
                    await sharedAccounts.toggleSharePaid(realId, isPaid, month);
                    await toggleBillPaid(billId, month, isPaid);
                  } else {
                    await toggleBillPaid(billId, month, isPaid);
                  }
                }}
                onDeleteBillCustom={async (billId) => {
                  if (billId.startsWith('sb_')) {
                    const realId = billId.replace('sb_', '');
                    await sharedAccounts.deleteSharedBill(realId);
                  } else {
                    await deleteBill(billId);
                  }
                }}
                onDeleteBillOccurrenceCustom={async (billId, month, scope) => {
                  if (billId.startsWith('sb_')) {
                    const realId = billId.replace('sb_', '');
                    await sharedAccounts.deleteSharedBillOccurrence(realId, month, scope);
                  } else {
                    await deleteBillOccurrence(billId, month, scope);
                  }
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Floating Mone Assistant Action Button */}
      <button
        type="button"
        onClick={() => setIsMoneChatOpen(true)}
        className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer group print:hidden mb-[env(safe-area-inset-bottom,0px)]"
        title={t.askMone}
      >
        <div className="relative">
          <Bot className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
          <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <span className="tracking-wide">Mone</span>
      </button>

      {/* Mone Financial Assistant Chat Modal */}
      <MoneChatModal
        isOpen={isMoneChatOpen}
        onClose={() => setIsMoneChatOpen(false)}
        currentBalance={currentBalance}
        bills={bills}
        incomes={incomes}
        expenses={expenses}
        statusRecords={statusRecords}
        goals={goals}
        currency={activeCurrency}
        language={currentLang}
        onAddExpense={addExpense}
        onUpdateExpense={updateExpense}
        onDeleteExpense={deleteExpense}
        onAddBill={addBill}
        onUpdateBill={updateBill}
        onDeleteBill={deleteBill}
        onToggleBillPaid={toggleBillPaid}
        onAddIncome={addIncome}
        onUpdateIncome={updateIncome}
        onDeleteIncome={deleteIncome}
        onToggleIncomeReceived={toggleIncomeReceived}
        onUpdateCurrentBalance={updateCurrentBalance}
        onCreateGoal={handleSaveNewGoal}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={activeSquareId !== null}
        square={currentSquareObj}
        currency={activeCurrency}
        language={currentLang}
        isCompleted={isSquareCompleted}
        depositDate={depositRecord?.timestamp}
        onClose={() => setActiveSquareId(null)}
        onConfirm={completeSquare}
        onUndo={uncompleteSquare}
      />

      {/* Avulso Deposit Modal */}
      {activeGoal && (
        <AvulsoDepositModal
          isOpen={isAvulsoModalOpen}
          onClose={() => setIsAvulsoModalOpen(false)}
          goal={activeGoal}
          currency={activeCurrency}
          language={currentLang}
          onConfirmAvulso={addAvulsoDeposit}
        />
      )}

      {/* Goal Modal (Add new goal with dynamic calculated squares) */}
      <GoalModal
        isOpen={isNewGoalOpen}
        onClose={() => setIsNewGoalOpen(false)}
        currency={activeCurrency}
        language={currentLang}
        onSave={handleSaveNewGoal}
      />

      {/* Edit Goal Modal */}
      {activeGoal && (
        <EditGoalModal
          isOpen={isEditGoalOpen}
          onClose={() => setIsEditGoalOpen(false)}
          goal={activeGoal}
          language={currentLang}
          onSave={updateGoal}
        />
      )}

      {/* Navigation Drawer Modal (3-Bars Top-Left Menu) */}
      <NavigationDrawerModal
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        currentView={currentView}
        onChangeView={setCurrentView}
        goalsCount={goals.length}
        savingsCount={0}
        sharedPendingCount={sharedAccounts.pendingReceivedInvitationsCount + sharedAccounts.unreadNotificationsCount}
        onOpenMoneChat={() => setIsMoneChatOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenProfileModal={() => setIsProfileOpen(true)}
        language={currentLang}
        darkMode={settings.darkMode}
        onToggleDarkMode={() => updateSettings({ darkMode: !settings.darkMode })}
      />

      {/* Settings Modal (Configurações) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onExportData={handleExportCompleteBackup}
        onImportData={handleImportCompleteBackup}
        onResetAllData={handleFactoryResetAll}
        bills={bills}
        incomes={incomes}
        expenses={expenses}
        currency={activeCurrency}
        language={currentLang}
      />

      {/* Profile Modal (Perfil) */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        settings={settings}
        currency={activeCurrency}
        language={currentLang}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 100% Completion Celebration Modal */}
      {activeGoal && (
        <CelebrationModal
          isOpen={justFinishedAll}
          onClose={clearJustFinishedAll}
          goal={activeGoal}
          savedAmount={savedAmount}
          currency={activeCurrency}
          language={currentLang}
        />
      )}

      {/* Achievement Unlocked Toast Notification */}
      <AchievementToast
        achievement={recentAchievement}
        language={currentLang}
        onClose={clearRecentAchievement}
      />
    </div>
  );
}
