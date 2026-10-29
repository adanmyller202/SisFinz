import React, { useState, useMemo } from 'react';
import { DepositRecord, CurrencyCode } from '../types';
import { formatCurrency, formatHistoryDate } from '../utils/currency';
import { History, Search, ArrowUpDown, RotateCcw, CheckCircle2, Zap } from 'lucide-react';

interface HistorySectionProps {
  history: DepositRecord[];
  currency: CurrencyCode;
  onUndoDeposit: (squareNumber: number) => void;
  onUndoAvulsoDeposit?: (recordId: string) => void;
  onSquareClick?: (squareNumber: number) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  currency,
  onUndoDeposit,
  onUndoAvulsoDeposit,
  onSquareClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

  const totalAccumulated = useMemo(() => {
    return history.reduce((acc, curr) => acc + curr.amount, 0);
  }, [history]);

  const filteredHistory = useMemo(() => {
    let list = [...history];

    if (searchTerm.trim() !== '') {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.squareNumber.toString().includes(q) ||
          item.amount.toString().includes(q) ||
          (item.note && item.note.toLowerCase().includes(q)) ||
          (item.isAvulso && 'avulso'.includes(q))
      );
    }

    switch (sortOrder) {
      case 'newest':
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        break;
      case 'highest':
        list.sort((a, b) => b.amount - a.amount);
        break;
      case 'lowest':
        list.sort((a, b) => a.amount - b.amount);
        break;
    }

    return list;
  }, [history, searchTerm, sortOrder]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-5">
      {/* Header with Title and Total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-500" />
            Histórico de Depósitos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro de todos os quadrados concluídos e depósitos avulsos desta meta.
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-4 py-2 text-right">
          <span className="text-[11px] font-semibold uppercase text-emerald-800 dark:text-emerald-400 tracking-wider">
            Total Acumulado
          </span>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-numbers">
            {formatCurrency(totalAccumulated, currency)}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {history.length} {history.length === 1 ? 'depósito' : 'depósitos'}
          </span>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por número, valor ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span>Ordenar:</span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="highest">Maior valor</option>
            <option value="lowest">Menor valor</option>
          </select>
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
          <p className="text-sm font-medium">Nenhum depósito registrado no histórico.</p>
          <p className="text-xs text-slate-400 mt-1">
            Escolha um quadrado na grade ou adicione um valor avulso para começar!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[460px] overflow-y-auto pr-1">
          {filteredHistory.map((item) => {
            const isAvulso = Boolean(item.isAvulso);

            return (
              <div
                key={item.id}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-xl transition-colors group"
              >
                <div
                  className={`flex items-center gap-3 ${!isAvulso ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!isAvulso && item.squareNumber) {
                      onSquareClick?.(item.squareNumber);
                    }
                  }}
                  title={!isAvulso ? 'Ver detalhes do quadrado' : undefined}
                >
                  {/* Icon */}
                  {isAvulso ? (
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-xs border border-amber-300 dark:border-amber-700 shrink-0 shadow-xs">
                      <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-200 dark:border-emerald-800 shrink-0">
                      ✓
                    </div>
                  )}

                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {isAvulso ? (
                        <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-extrabold">
                          Depósito Avulso
                          {item.note && (
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                              ({item.note})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>Quadrado #{item.squareNumber}</span>
                      )}
                      <span className="text-slate-400 dark:text-slate-600 font-normal">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono-numbers">
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers mt-0.5 flex items-center gap-2">
                      <span>{formatHistoryDate(item.timestamp)}</span>
                      {isAvulso && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800/60">
                          Recalculou restantes
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Undo action */}
                <div className="flex items-center gap-2">
                  {confirmUndoId === item.id ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <span className="text-[11px] text-rose-500 font-semibold">Desfazer?</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isAvulso) {
                            onUndoAvulsoDeposit?.(item.id);
                          } else {
                            onUndoDeposit(item.squareNumber);
                          }
                          setConfirmUndoId(null);
                        }}
                        className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs cursor-pointer"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmUndoId(null)}
                        className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmUndoId(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title={isAvulso ? 'Desfazer este depósito avulso' : 'Desfazer este depósito'}
                      aria-label="Desfazer depósito"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
