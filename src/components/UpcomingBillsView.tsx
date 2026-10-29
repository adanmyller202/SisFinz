/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BillItem, CurrencyCode, LanguageCode, MonthlyStatusRecord } from '../types';
import {
  shiftMonthStr,
  formatMonthName,
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  getMonthDiff,
} from '../utils/finance';
import { formatCurrency } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  Calendar,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
  ArrowDownCircle,
  Trash2,
} from 'lucide-react';

interface UpcomingBillsViewProps {
  bills: BillItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  startMonthStr: string;
  statusRecords: MonthlyStatusRecord[];
  userId?: string;
  onSelectBill: (bill: BillItem, month: string) => void;
  onToggleBillPaid: (billId: string, month: string, isPaid: boolean) => void;
  onDeleteBillClick?: (bill: BillItem) => void;
  onNewBill: () => void;
}

interface MonthGroup {
  month: string; // YYYY-MM
  monthName: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  occurrences: {
    bill: BillItem;
    month: string;
    effectiveDueDate: string;
    dueDay: number;
    amount: number;
    status: 'paid' | 'overdue' | 'pending';
    installmentLabel?: string;
  }[];
}

export const UpcomingBillsView: React.FC<UpcomingBillsViewProps> = ({
  bills,
  currency,
  language = 'pt',
  startMonthStr,
  statusRecords,
  userId,
  onSelectBill,
  onToggleBillPaid,
  onDeleteBillClick,
  onNewBill,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Number of months to show continuously (user can expand)
  const [monthsToShow, setMonthsToShow] = useState<number>(12);

  // Status mapping
  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    for (const rec of statusRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [statusRecords]);

  // Calculate grouped bills month by month
  const groupedMonths = useMemo<MonthGroup[]>(() => {
    const groups: MonthGroup[] = [];

    for (let i = 0; i < monthsToShow; i++) {
      const targetMonth = shiftMonthStr(startMonthStr, i);
      const occurrences: MonthGroup['occurrences'] = [];

      for (const bill of bills) {
        if (doesItemOccurInMonth(bill.startMonth, targetMonth, bill.recurrence, bill.recurrenceMonthsCount)) {
          const exception = bill.exceptions?.[targetMonth];
          if (exception?.isDeleted || bill.excludedMonths?.includes(targetMonth)) {
            continue;
          }

          const effectiveDueDay = exception?.dueDay ?? bill.dueDay;
          const effectiveDueDate =
            exception?.dueDate ?? getEffectiveDateForMonth(targetMonth, effectiveDueDay);
          const effectiveAmount = exception?.amount ?? bill.amount;

          const recordKey = `bill_${bill.id}_${targetMonth}`;
          const record = statusMap.get(recordKey);
          const monthShares = (exception as any)?.shares;
          const userShareStatus = userId && monthShares?.[userId]?.status;
          const isPaid =
            record?.isCompleted === true ||
            (exception as any)?.status === 'paid' ||
            userShareStatus === 'paid' ||
            userShareStatus === 'transferred' ||
            ((bill as any).recurrence === 'none' && ((bill as any).status === 'paid' || (userId && (bill as any).shares?.[userId]?.status === 'paid') || (userId && (bill as any).shares?.[userId]?.status === 'transferred')));

          let status: 'paid' | 'overdue' | 'pending';
          if (isPaid) {
            status = 'paid';
          } else if (effectiveDueDate < todayStr) {
            status = 'overdue';
          } else {
            status = 'pending';
          }

          let installmentLabel: string | undefined = undefined;
          if (bill.recurrence === 'monthly') {
            const diff = getMonthDiff(bill.startMonth, targetMonth);
            const currentInstallment = diff + 1;
            if (bill.recurrenceMonthsCount && bill.recurrenceMonthsCount > 0) {
              installmentLabel = `${t.installmentPrefix} ${currentInstallment}/${bill.recurrenceMonthsCount}`;
            } else {
              installmentLabel = `${t.recurrenceMonthly} (${currentInstallment})`;
            }
          }

          occurrences.push({
            bill,
            month: targetMonth,
            effectiveDueDate,
            dueDay: effectiveDueDay,
            amount: effectiveAmount,
            status,
            installmentLabel,
          });
        }
      }

      if (occurrences.length > 0) {
        // Sort by due date within month
        occurrences.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate));

        const totalAmount = occurrences.reduce((sum, o) => sum + o.amount, 0);
        const paidAmount = occurrences
          .filter((o) => o.status === 'paid')
          .reduce((sum, o) => sum + o.amount, 0);
        const pendingAmount = totalAmount - paidAmount;

        groups.push({
          month: targetMonth,
          monthName: formatMonthName(targetMonth, locale),
          totalAmount,
          paidAmount,
          pendingAmount,
          occurrences,
        });
      }
    }

    return groups;
  }, [bills, startMonthStr, monthsToShow, statusMap, todayStr, locale, t]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-600" />
            <span>{t.upcomingBillsTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.upcomingBillsSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onNewBill}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addBill}</span>
        </button>
      </div>

      {/* Empty State */}
      {groupedMonths.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t.noUpcomingBills}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {t.noUpcomingBillsDesc}
          </p>
          <button
            type="button"
            onClick={onNewBill}
            className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 rounded-xl hover:bg-rose-100 cursor-pointer"
          >
            {t.addBillNow}
          </button>
        </div>
      ) : (
        /* Continuous Scroll Months List */
        <div className="space-y-4">
          {groupedMonths.map((group) => (
            <div
              key={group.month}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
            >
              {/* Month Header Banner */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white capitalize">
                    {group.monthName}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {group.occurrences.length} {t.itemsCount}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    {t.totalLabel}: <strong className="text-rose-600 dark:text-rose-400 font-extrabold">{formatCurrency(group.totalAmount, currency)}</strong>
                  </div>
                  {group.paidAmount > 0 && (
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                      ({t.paidLabel}: {formatCurrency(group.paidAmount, currency)})
                    </div>
                  )}
                </div>
              </div>

              {/* Bills in this month */}
              <div className="p-3 sm:p-4 divide-y divide-slate-100 dark:divide-slate-800/80 space-y-1">
                {group.occurrences.map((occ) => {
                  const isPaid = occ.status === 'paid';
                  const isOverdue = occ.status === 'overdue';

                  return (
                    <div
                      key={`${occ.bill.id}_${occ.month}`}
                      onClick={() => onSelectBill(occ.bill, occ.month)}
                      className={`pt-2.5 first:pt-0 pb-2.5 last:pb-0 flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group`}
                    >
                      {/* Left: Due Date + Name + Tags */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 sm:w-14 py-1 px-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0">
                          <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200 block whitespace-nowrap">
                            {t.dayPrefix} {occ.dueDay}
                          </span>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                              {occ.bill.name}
                            </span>
                            {occ.installmentLabel && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 font-mono-numbers shrink-0">
                                {occ.installmentLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate">{occ.bill.category}</span>
                            {occ.bill.notes && (
                              <>
                                <span>•</span>
                                <span className="truncate italic text-slate-400 max-w-[150px]">
                                  {occ.bill.notes}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount + Status + Check Button */}
                      <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <span className="text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-400">
                            {formatCurrency(occ.amount, currency)}
                          </span>
                        </div>

                        {/* Toggle Paid Button */}
                        <button
                          type="button"
                          onClick={() => onToggleBillPaid(occ.bill.id, occ.month, !isPaid)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                            isPaid
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : isOverdue
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-emerald-50'
                          }`}
                          title={t.togglePaymentTooltip}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t.statusPaid}</span>
                            </>
                          ) : isOverdue ? (
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

                        <button
                          type="button"
                          onClick={() => onSelectBill(occ.bill, occ.month)}
                          className="p-1 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title={t.viewDetailsTooltip}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        {onDeleteBillClick && (
                          <button
                            type="button"
                            onClick={() => onDeleteBillClick(occ.bill)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                            title={t.deleteItem}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More Months Button for continuous scrolling */}
          <div className="text-center pt-2 pb-6">
            <button
              type="button"
              onClick={() => setMonthsToShow((prev) => prev + 12)}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <ArrowDownCircle className="w-4 h-4 text-rose-500" />
              <span>{t.loadMoreMonths}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
