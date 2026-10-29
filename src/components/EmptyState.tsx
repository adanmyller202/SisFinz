import React from 'react';
import { Target, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onOpenNewGoalModal: () => void;
  userName?: string | null;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onOpenNewGoalModal,
  userName,
}) => {
  return (
    <div className="py-12 sm:py-20 px-4 text-center max-w-lg mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="mx-auto w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10">
        <Target className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Bem-vindo{userName ? `, ${userName}` : ''}!
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Você ainda não possui objetivos
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          Transforme sua economia em um desafio visual interativo. Defina quanto quer guardar e o sistema calculará os quadrados automaticamente.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onOpenNewGoalModal}
          className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-2xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all cursor-pointer transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Criar meu primeiro objetivo</span>
          <Sparkles className="w-4 h-4 text-emerald-200" />
        </button>
      </div>

      <div className="pt-4 grid grid-cols-3 gap-3 text-left">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-lg">🏍️</span>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">Metas Livres</p>
          <p className="text-[10px] text-slate-400">Moto, viagem, reserva ou eletrônicos.</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-lg">⚡</span>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">Cálculo Preciso</p>
          <p className="text-[10px] text-slate-400">Quadrados dinâmicos e soma 100% exata.</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-lg">🔒</span>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">Dados Privados</p>
          <p className="text-[10px] text-slate-400">Acesso exclusivo e seguro da sua conta.</p>
        </div>
      </div>
    </div>
  );
};
