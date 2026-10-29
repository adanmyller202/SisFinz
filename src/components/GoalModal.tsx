import React, { useState, useMemo, useEffect } from 'react';
import { CurrencyCode, LanguageCode, ChallengeSquare } from '../types';
import {
  CURRENCIES,
  INITIAL_VALUE_SUGGESTIONS,
  formatCurrency,
  generateDynamicSquares,
  generateEqualSquares,
} from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { Target, X, Calculator, Sparkles, Check, ArrowRight, Grid3X3, TrendingUp, Layers } from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSave: (goalData: {
    title: string;
    icon: string;
    targetAmount: number;
    initialValue: number;
    currency: CurrencyCode;
    notes?: string;
    squaresMode?: 'equal' | 'progressive';
    squaresCount?: number;
    squares?: ChallengeSquare[];
    totalSquares?: number;
  }) => Promise<unknown> | void;
}

const PRESET_ICONS = ['🎯', '🏍️', '✈️', '💻', '🏠', '🚗', '🛡️', '💍', '🎒', '🏖️', '📱', '🎓', '🎸', '💰', '👟', '🎮'];
const PRESET_SQUARE_COUNTS = [20, 30, 50, 100];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  currency: initialGlobalCurrency,
  language = 'pt',
  onSave,
}) => {
  const t = getTranslations(language);

  // Form inputs
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [currency, setCurrency] = useState<CurrencyCode>(initialGlobalCurrency || 'BRL');
  const [targetInput, setTargetInput] = useState<string>('20000');

  // Mode: 'byCount' (choose quantity of squares with fixed equal values) or 'progressive' (increasing steps)
  const [divisionMode, setDivisionMode] = useState<'byCount' | 'progressive'>('byCount');

  // By Count mode states
  const [squaresCount, setSquaresCount] = useState<number>(20);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>('20');
  const [useFixedValueDirectly, setUseFixedValueDirectly] = useState<boolean>(false);
  const [fixedValueInput, setFixedValueInput] = useState<string>('200');

  // Progressive mode states
  const [initialValue, setInitialValue] = useState<number>(100);
  const [customInitialInput, setCustomInitialInput] = useState<string>('');
  const [isCustomInitial, setIsCustomInitial] = useState<boolean>(false);

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync suggestion default if currency changes
  const handleCurrencyChange = (newCur: CurrencyCode) => {
    setCurrency(newCur);
    if (newCur === 'ARS') {
      setTargetInput('250000');
      setInitialValue(10000);
      setFixedValueInput('10000');
    } else if (newCur === 'BRL') {
      setTargetInput('20000');
      setInitialValue(100);
      setFixedValueInput('1000');
    } else {
      setTargetInput('5000');
      setInitialValue(20);
      setFixedValueInput('250');
    }
    setIsCustomInitial(false);
    setCustomInitialInput('');
  };

  useEffect(() => {
    if (isOpen) {
      handleCurrencyChange(initialGlobalCurrency || 'BRL');
      setTitle('');
      setNotes('');
      setError(null);
      setDivisionMode('byCount');
      setSquaresCount(20);
      setIsCustomCount(false);
      setUseFixedValueDirectly(false);
    }
  }, [isOpen, initialGlobalCurrency]);

  const numericTarget = Math.max(1, parseFloat(targetInput.replace(/[^0-9]/g, '')) || 0);

  // Effective count for 'byCount' mode
  const effectiveCount = useMemo(() => {
    if (useFixedValueDirectly) {
      const parsedVal = parseFloat(fixedValueInput.replace(/[^0-9]/g, '')) || 0;
      if (parsedVal > 0 && numericTarget > 0) {
        return Math.max(1, Math.min(1500, Math.round(numericTarget / parsedVal)));
      }
      return 20;
    }
    if (isCustomCount) {
      return Math.max(1, Math.min(1500, parseInt(customCountInput.replace(/[^0-9]/g, ''), 10) || 1));
    }
    return squaresCount;
  }, [useFixedValueDirectly, fixedValueInput, numericTarget, isCustomCount, customCountInput, squaresCount]);

  // Effective initial step for 'progressive' mode
  const effectiveInitial = isCustomInitial
    ? Math.max(1, parseFloat(customInitialInput.replace(/[^0-9]/g, '')) || 1)
    : initialValue;

  // Real-time calculation of dynamic squares based on chosen mode
  const calculatedSquares = useMemo<ChallengeSquare[]>(() => {
    if (numericTarget <= 0) return [];

    if (divisionMode === 'byCount') {
      return generateEqualSquares(numericTarget, effectiveCount);
    }

    // divisionMode === 'progressive'
    if (effectiveInitial <= 0) return [];
    return generateDynamicSquares(numericTarget, effectiveInitial);
  }, [numericTarget, divisionMode, effectiveCount, effectiveInitial]);

  const totalCalculated = useMemo(() => {
    return calculatedSquares.reduce((sum, s) => sum + s.value, 0);
  }, [calculatedSquares]);

  const firstSquare = calculatedSquares[0];
  const lastSquare = calculatedSquares[calculatedSquares.length - 1];

  // Value per square in equal division
  const equalValuePerSquare = useMemo(() => {
    if (calculatedSquares.length === 0) return 0;
    return Math.round(numericTarget / calculatedSquares.length);
  }, [numericTarget, calculatedSquares.length]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(
        language === 'pt'
          ? 'Por favor, digite um nome para o seu objetivo.'
          : language === 'es'
          ? 'Por favor, ingresa un nombre para tu meta.'
          : 'Please enter a title for your goal.'
      );
      return;
    }
    if (numericTarget < 10) {
      setError(
        language === 'pt'
          ? 'O valor da meta deve ser de pelo menos 10.'
          : language === 'es'
          ? 'El monto de la meta debe ser de al menos 10.'
          : 'Goal target must be at least 10.'
      );
      return;
    }
    if (divisionMode === 'progressive' && effectiveInitial > numericTarget) {
      setError(
        language === 'pt'
          ? 'O valor inicial não pode ser maior que o valor total da meta.'
          : language === 'es'
          ? 'El valor inicial no puede ser mayor que el monto total de la meta.'
          : 'Initial starting step cannot be greater than the goal target.'
      );
      return;
    }
    if (calculatedSquares.length === 0) {
      setError(
        language === 'pt'
          ? 'Não foi possível gerar os quadrados com os valores inseridos.'
          : language === 'es'
          ? 'No fue posible generar los cuadrados con estos valores.'
          : 'Could not generate squares with the provided values.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        icon,
        targetAmount: numericTarget,
        initialValue: divisionMode === 'byCount' ? equalValuePerSquare : effectiveInitial,
        currency,
        notes: notes.trim() || undefined,
        squaresMode: divisionMode === 'byCount' ? 'equal' : 'progressive',
        squaresCount: calculatedSquares.length,
        squares: calculatedSquares,
        totalSquares: calculatedSquares.length,
      });

      setTitle('');
      setIcon('🎯');
      setTargetInput('20000');
      setNotes('');
      setError(null);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create goal:', err);
      const msg = err instanceof Error ? err.message : 'Error creating goal.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencyConfig = CURRENCIES[currency] || CURRENCIES.BRL;
  const suggestions = INITIAL_VALUE_SUGGESTIONS[currency] || INITIAL_VALUE_SUGGESTIONS.BRL;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 text-lg">
              {icon}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t.newGoalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'pt'
                  ? 'Defina seu objetivo e escolha a quantidade de quadrados'
                  : language === 'es'
                  ? 'Define tu meta y elige la cantidad de cuadrados'
                  : 'Set your goal and choose your squares quantity'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl">
              {error}
            </div>
          )}

          {/* 1. Nome do Objetivo & Ícone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              {t.goalNameLabel}
            </label>
            <div className="flex gap-2.5">
              <input
                type="text"
                placeholder={t.goalNamePlaceholder}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden font-medium"
              />

              <div className="relative shrink-0">
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="px-3 py-2.5 text-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 outline-hidden cursor-pointer"
                  title={t.goalIconLabel}
                >
                  {PRESET_ICONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2 & 3. Quanto quer guardar? + Moeda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                {t.goalTargetLabel}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono-numbers pointer-events-none">
                  {currencyConfig.symbol}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="20000"
                  value={targetInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setTargetInput(raw);
                    setError(null);
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono-numbers font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                {t.currency}
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {(['BRL', 'ARS', 'USD', 'EUR'] as CurrencyCode[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCurrencyChange(c)}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      currency === c
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {currencyConfig.name} ({currencyConfig.symbol})
              </p>
            </div>
          </div>

          {/* 4. SELETOR DE MODO DE CÁLCULO DOS QUADRADOS */}
          <div className="pt-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>{t.divisionModeLabel}</span>
              <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                {divisionMode === 'byCount' ? t.modeByCountShort : t.modeProgressiveShort}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => {
                  setDivisionMode('byCount');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  divisionMode === 'byCount'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm border border-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span>{t.modeByCountShort}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDivisionMode('progressive');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  divisionMode === 'progressive'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm border border-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{t.modeProgressiveShort}</span>
              </button>
            </div>
          </div>

          {/* 5A. CONFIGURAÇÃO DO MODO: POR QUANTIDADE DE QUADRADOS (VALORES IGUAIS / FIXOS) */}
          {divisionMode === 'byCount' && (
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t.squaresCountLabel}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'pt'
                      ? 'Divida sua meta em quadrados de mesmo valor para economizar com previsibilidade'
                      : language === 'es'
                      ? 'Divide tu meta en cuadrados de igual valor para ahorrar de forma cómoda'
                      : 'Divide your goal into equal squares to save with ease'}
                  </p>
                </div>
              </div>

              {/* Botões de quantidade pré-definidos */}
              {!useFixedValueDirectly && (
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SQUARE_COUNTS.map((cnt) => {
                    const isSelected = !isCustomCount && squaresCount === cnt;
                    const calculatedVal = Math.round(numericTarget / cnt);
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          setSquaresCount(cnt);
                          setIsCustomCount(false);
                          setError(null);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex flex-col items-center min-w-[70px] ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        <span className="font-bold">{cnt} {language === 'pt' ? 'quadrados' : language === 'es' ? 'cuadrados' : 'squares'}</span>
                        <span className={`text-[10px] font-mono-numbers ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {formatCurrency(calculatedVal, currency)}/un
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCount(true);
                      setError(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                      isCustomCount
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <span>{language === 'pt' ? 'Outra quantidade' : language === 'es' ? 'Otra cantidad' : 'Custom count'}</span>
                  </button>
                </div>
              )}

              {/* Input para quantidade personalizada */}
              {isCustomCount && !useFixedValueDirectly && (
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {language === 'pt' ? 'Digite o número exato de quadrados:' : language === 'es' ? 'Ingresa el número exacto de cuadrados:' : 'Enter exact square count:'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 25"
                      value={customCountInput}
                      onChange={(e) => {
                        setCustomCountInput(e.target.value.replace(/[^0-9]/g, ''));
                        setError(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs font-mono-numbers font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <span className="text-[10px] text-slate-400 block">{t.valuePerSquareSummary}:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-numbers">
                      {formatCurrency(equalValuePerSquare, currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Alternativa: Definir valor fixo por quadrado (Ex: quero quadrados de 200) */}
              <div className="pt-2 border-t border-emerald-100/80 dark:border-emerald-900/40">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useFixedValueDirectly}
                      onChange={(e) => {
                        setUseFixedValueDirectly(e.target.checked);
                        setError(null);
                      }}
                      className="w-3.5 h-3.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>{t.orFixedValuePerSquare}</span>
                  </label>
                  {useFixedValueDirectly && (
                    <span className="text-[11px] font-mono-numbers font-bold text-emerald-600 dark:text-emerald-400">
                      = {calculatedSquares.length} {language === 'pt' ? 'quadrados' : language === 'es' ? 'cuadrados' : 'squares'}
                    </span>
                  )}
                </div>

                {useFixedValueDirectly && (
                  <div className="mt-2 relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono-numbers pointer-events-none">
                      {currencyConfig.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="200"
                      value={fixedValueInput}
                      onChange={(e) => {
                        setFixedValueInput(e.target.value.replace(/[^0-9]/g, ''));
                        setError(null);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono-numbers font-bold outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5B. CONFIGURAÇÃO DO MODO: PROGRESSIVO (VALORES CRESCENTES) */}
          {divisionMode === 'progressive' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t.goalInitialValueLabel}
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {currency}
                </span>
              </div>

              {/* Sugestões da moeda */}
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((val) => {
                  const isSelected = !isCustomInitial && initialValue === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setInitialValue(val);
                        setIsCustomInitial(false);
                        setError(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-mono-numbers font-semibold rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      {formatCurrency(val, currency)}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCustomInitial(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isCustomInitial
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {language === 'pt' ? 'Outro valor' : language === 'es' ? 'Otro valor' : 'Other amount'}
                </button>
              </div>

              {/* Campo para valor personalizado */}
              {isCustomInitial && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in duration-150">
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono-numbers pointer-events-none">
                      {currencyConfig.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="250"
                      value={customInitialInput}
                      onChange={(e) => {
                        setCustomInitialInput(e.target.value.replace(/[^0-9]/g, ''));
                        setError(null);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono-numbers font-bold outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PREVIEW DO DESAFIO */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                {t.calculatedSquaresSummary}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono-numbers">
                {calculatedSquares.length} {t.squaresCountSummary}
              </span>
            </div>

            {/* KPIs do Desafio */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              <div>
                <span className="text-[11px] text-slate-400 block">{t.totalTargetSummary}</span>
                <span className="text-sm sm:text-base font-extrabold text-white font-mono-numbers mt-0.5 block">
                  {formatCurrency(numericTarget, currency)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">
                  {divisionMode === 'byCount' ? t.valuePerSquareSummary : t.goalInitialValueLabel}
                </span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono-numbers mt-0.5 block">
                  {divisionMode === 'byCount'
                    ? formatCurrency(equalValuePerSquare, currency)
                    : formatCurrency(effectiveInitial, currency)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">{t.squaresCountSummary}</span>
                <span className="text-sm sm:text-base font-extrabold text-white font-mono-numbers mt-0.5 block">
                  {calculatedSquares.length} {language === 'pt' ? 'unidades' : language === 'es' ? 'unidades' : 'units'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">1º {language === 'pt' ? 'Quadrado' : language === 'es' ? 'Cuadrado' : 'Square'}</span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 font-mono-numbers mt-0.5 block">
                  {firstSquare ? formatCurrency(firstSquare.value, currency) : '—'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">{t.lastSquareSummary}</span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 font-mono-numbers mt-0.5 flex items-center gap-1">
                  {lastSquare ? formatCurrency(lastSquare.value, currency) : '—'}
                  {lastSquare?.isAdjustment && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                      {t.finalAdjustmentBadge}
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">{t.totalLabel}</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono-numbers mt-0.5 flex items-center gap-1">
                  {formatCurrency(totalCalculated, currency)}
                  <Check className="w-3 h-3 text-emerald-400" />
                </span>
              </div>
            </div>

            {/* Mini preview visual dos primeiros quadrados */}
            {calculatedSquares.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  {t.squaresPreviewTitle}
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-hidden">
                  {calculatedSquares.slice(0, 10).map((sq) => (
                    <div
                      key={sq.id}
                      className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700/80 text-center text-[10px] font-mono-numbers text-slate-200"
                    >
                      <span className="text-[9px] text-emerald-400 font-bold block">#{sq.id}</span>
                      <span className="font-semibold">{formatCurrency(sq.value, currency)}</span>
                    </div>
                  ))}
                  {calculatedSquares.length > 10 && (
                    <div className="px-2.5 py-1 rounded-lg bg-slate-800/40 border border-slate-700/40 text-center text-[10px] text-slate-400 flex items-center justify-center font-medium">
                      + {calculatedSquares.length - 10} {t.moreSquares}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notas opcionais */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              {t.goalNotesLabel}
            </label>
            <textarea
              rows={2}
              placeholder={t.goalNotesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          </div>

          {/* Fixed Action buttons (pinned) */}
          <div className="flex items-center justify-end gap-3 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={calculatedSquares.length === 0 || isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t.savingBtn}</span>
                </>
              ) : (
                <>
                  <span>{t.createGoalSubmitBtn}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
