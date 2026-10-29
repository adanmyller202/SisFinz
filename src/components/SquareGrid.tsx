import React, { useState, useMemo } from 'react';
import { ChallengeGoal, CurrencyCode, ChallengeSquare, LanguageCode } from '../types';
import { formatCurrency, getGoalSquares } from '../utils/currency';
import { Check, Search, Sparkles, Filter, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

interface SquareGridProps {
  goal: ChallengeGoal;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSquareClick: (squareId: number) => void;
  selectedSquareId: number | null;
  onAddAvulsoClick?: () => void;
}

type FilterType = 'all' | 'pending' | 'completed';

export const SquareGrid: React.FC<SquareGridProps> = ({
  goal,
  currency,
  language = 'pt',
  onSquareClick,
  selectedSquareId,
  onAddAvulsoClick,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Retrieve dynamic or legacy squares
  const allSquares = useMemo<ChallengeSquare[]>(() => {
    return getGoalSquares(goal);
  }, [goal]);

  const completedSet = useMemo(() => {
    return new Set(goal.completedSquares);
  }, [goal.completedSquares]);

  // Filtered squares
  const filteredSquares = useMemo(() => {
    let result = allSquares;

    // Filter by status
    if (filter === 'pending') {
      result = result.filter((s) => !completedSet.has(s.id));
    } else if (filter === 'completed') {
      result = result.filter((s) => completedSet.has(s.id));
    }

    // Filter by search (id or value)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().replace('#', '').toLowerCase();
      result = result.filter(
        (s) =>
          s.id.toString().includes(q) ||
          s.value.toString().includes(q) ||
          formatCurrency(s.value, currency).toLowerCase().includes(q)
      );
    }

    return result;
  }, [allSquares, completedSet, filter, searchQuery, currency]);

  // Pagination calculation
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredSquares.length / pageSize);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedSquares = useMemo(() => {
    if (pageSize === 0) return filteredSquares;
    const start = (safePage - 1) * pageSize;
    return filteredSquares.slice(start, start + pageSize);
  }, [filteredSquares, safePage, pageSize]);

  // Pick a random uncompleted square
  const handleSuggestSquare = () => {
    const pending = allSquares.filter((s) => !completedSet.has(s.id));
    if (pending.length === 0) return;
    const randomSquare = pending[Math.floor(Math.random() * pending.length)];
    onSquareClick(randomSquare.id);
  };

  const pendingCount = allSquares.length - goal.completedSquares.length;
  const completedCount = goal.completedSquares.length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-5">
      {/* Grid Controls Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {language === 'es' ? 'Cuadrícula del Desafío' : language === 'pt' ? 'Grade do Desafio' : 'Challenge Grid'}
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono-numbers bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
              {allSquares.length} {language === 'es' ? 'cuadrados' : language === 'pt' ? 'quadrados' : 'squares'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'es'
              ? 'Cada cuadrado representa exactamente el monto a guardar. Haz clic para registrar tu depósito.'
              : language === 'pt'
              ? 'Cada quadrado representa exatamente o valor a ser guardado. Clique para registrar seu depósito.'
              : 'Each square represents the exact amount to save. Click to record your deposit.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick avulso deposit */}
          {onAddAvulsoClick && (
            <button
              type="button"
              onClick={onAddAvulsoClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer shadow-xs"
              title={
                language === 'es'
                  ? 'Agregar monto extra y recalcular cuadrados restantes'
                  : language === 'pt'
                  ? 'Adicionar valor avulso e recalcular quadrados restantes'
                  : 'Add extra amount and recalculate remaining squares'
              }
            >
              <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{language === 'es' ? '+ Monto Extra' : language === 'pt' ? '+ Valor Avulso' : '+ Extra Amount'}</span>
            </button>
          )}

          {/* Quick random suggest */}
          <button
            type="button"
            onClick={handleSuggestSquare}
            disabled={pendingCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={
              language === 'es'
                ? 'Elegir un cuadrado pendiente al azar'
                : language === 'pt'
                ? 'Escolher um quadrado pendente aleatório'
                : 'Pick a random pending square'
            }
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{language === 'es' ? 'Sugerir Cuadrado' : language === 'pt' ? 'Sugerir Quadrado' : 'Suggest Square'}</span>
          </button>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                language === 'es'
                  ? 'Buscar # o monto...'
                  : language === 'pt'
                  ? 'Buscar # ou valor...'
                  : 'Search # or amount...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-32 sm:w-40 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Chunks Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        {/* Interactive Segmented Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'es' ? 'Todos' : language === 'pt' ? 'Todos' : 'All'} ({allSquares.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('pending');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              filter === 'pending'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'es' ? 'Pendientes' : language === 'pt' ? 'Pendentes' : 'Pending'} ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('completed');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              filter === 'completed'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'es' ? 'Completados' : language === 'pt' ? 'Concluídos' : 'Completed'} ({completedCount})
          </button>
        </div>

        {/* Chunks selector for large grids */}
        {allSquares.length > 80 && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 self-end sm:self-auto">
            <span>{language === 'es' ? 'Mostrar:' : language === 'pt' ? 'Exibir:' : 'Show:'}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value={100}>{language === 'es' ? '100 por bloque' : language === 'pt' ? '100 por bloco' : '100 per block'}</option>
              <option value={50}>{language === 'es' ? '50 por bloque' : language === 'pt' ? '50 por bloco' : '50 per block'}</option>
              <option value={0}>{language === 'es' ? 'Todos' : language === 'pt' ? 'Todos' : 'All'} ({allSquares.length})</option>
            </select>
          </div>
        )}
      </div>

      {/* Grid Canvas */}
      {paginatedSquares.length === 0 ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500">
          <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">
            {language === 'es'
              ? 'Ningún cuadrado encontrado con los filtros actuales.'
              : language === 'pt'
              ? 'Nenhum quadrado encontrado com os filtros atuais.'
              : 'No squares found with the current filters.'}
          </p>
          <button
            onClick={() => {
              setFilter('all');
              setSearchQuery('');
            }}
            className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
          >
            {language === 'es' ? 'Limpiar filtros' : language === 'pt' ? 'Limpar filtros' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-2.5">
          {paginatedSquares.map((square) => {
            const isCompleted = completedSet.has(square.id);
            const isSelected = selectedSquareId === square.id;
            const formattedVal = formatCurrency(square.value, currency);

            return (
              <button
                key={square.id}
                type="button"
                onClick={() => onSquareClick(square.id)}
                aria-label={`Quadrado ${square.id}, valor ${formattedVal}, ${isCompleted ? 'concluído' : 'disponível'}`}
                className={`
                  relative group flex flex-col items-center justify-between min-h-[58px] sm:min-h-[66px] p-2 rounded-xl transition-all duration-150 cursor-pointer select-none
                  focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500
                  ${
                    isCompleted
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/30 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-emerald-500/40'
                      : isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 hover:bg-emerald-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 hover:shadow-xs'
                  }
                `}
              >
                {/* Top: Square Index */}
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono-numbers font-medium ${
                      isCompleted ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    #{square.id}
                  </span>
                  {square.isAdjustment && !isCompleted && (
                    <span className="text-[9px] px-1 rounded-sm bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold">
                      {language === 'es' ? 'Ajuste' : language === 'pt' ? 'Ajuste' : 'Adjust'}
                    </span>
                  )}
                  {isCompleted && (
                    <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
                  )}
                </div>

                {/* Main: Exact Amount */}
                <div className="my-auto text-center w-full">
                  <span
                    className={`font-mono-numbers text-xs sm:text-sm font-extrabold tracking-tight block truncate ${
                      isCompleted ? 'text-white' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formattedVal}
                  </span>
                </div>

                {/* Sub: Status label */}
                <div className="text-[9px] font-semibold tracking-wide">
                  {isCompleted ? (
                    <span className="text-emerald-100">{language === 'es' ? 'Listo' : language === 'pt' ? 'Feito' : 'Done'}</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">{language === 'es' ? 'Pendiente' : language === 'pt' ? 'Pendente' : 'Pending'}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div>
            {language === 'es' ? 'Página' : language === 'pt' ? 'Página' : 'Page'}{' '}
            <strong className="text-slate-900 dark:text-white">{safePage}</strong>{' '}
            {language === 'es' ? 'de' : language === 'pt' ? 'de' : 'of'}{' '}
            <strong className="text-slate-900 dark:text-white">{totalPages}</strong> (
            {filteredSquares.length} {language === 'es' ? 'cuadrados' : language === 'pt' ? 'quadrados' : 'squares'})
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono-numbers font-medium">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
          <span>{language === 'es' ? 'Disponible' : language === 'pt' ? 'Disponível' : 'Available'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-white dark:bg-slate-800 border-2 border-emerald-500" />
          <span>{language === 'es' ? 'Seleccionado' : language === 'pt' ? 'Selecionado' : 'Selected'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-emerald-600 flex items-center justify-center text-white text-[9px] font-bold">
            ✓
          </div>
          <span>{language === 'es' ? 'Completado' : language === 'pt' ? 'Concluído' : 'Completed'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
            {language === 'es' ? 'Ajuste' : language === 'pt' ? 'Ajuste' : 'Adjust'}
          </div>
          <span>
            {language === 'es'
              ? 'Ajuste final para alcanzar la meta exacta'
              : language === 'pt'
              ? 'Ajuste final para atingir a meta exata'
              : 'Final adjustment to reach the exact target'}
          </span>
        </div>
      </div>
    </div>
  );
};
