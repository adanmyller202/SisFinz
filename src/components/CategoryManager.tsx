/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CategoryScope, LanguageCode, CustomCategory } from '../types';
import { DisplayCategory } from '../hooks/useCategories';
import { getTranslations } from '../utils/i18n';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Filter,
  Layers,
  RotateCcw,
} from 'lucide-react';

interface CategoryManagerProps {
  language?: LanguageCode;
  allCategories: DisplayCategory[];
  onAddCategory: (name: string, scope: CategoryScope, color?: string) => Promise<CustomCategory>;
  onUpdateCategory: (id: string, partial: { name?: string; scope?: CategoryScope; color?: string }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onResetPredefined?: () => Promise<void>;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#ec4899', // Pink
];

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  language = 'pt',
  allCategories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onResetPredefined,
}) => {
  const t = getTranslations(language);

  const [activeFilter, setActiveFilter] = useState<'all' | 'bill' | 'income' | 'expense'>('all');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CategoryScope>('all');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editScope, setEditScope] = useState<CategoryScope>('all');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t.categoryNameRequired);
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddCategory(name.trim(), scope, selectedColor);
      setName('');
      setScope('all');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error adding category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (cat: DisplayCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditScope(cat.scope);
    setEditColor(cat.color || PRESET_COLORS[0]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await onUpdateCategory(id, {
        name: editName.trim(),
        scope: editScope,
        color: editColor,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Error saving edited category:', err);
    }
  };

  // Filtered categories
  const filteredCategories = React.useMemo(() => {
    return allCategories.filter((c) => {
      if (activeFilter === 'all') return true;
      return c.scope === 'all' || c.scope === activeFilter;
    });
  }, [allCategories, activeFilter]);

  const getScopeLabel = (s: CategoryScope) => {
    switch (s) {
      case 'bill':
        return t.scopeBill;
      case 'income':
        return t.scopeIncome;
      case 'expense':
        return t.scopeExpense;
      default:
        return t.scopeAll;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-5 shadow-xs animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {t.categoriesManagerTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.categoriesManagerSubtitle}
          </p>
        </div>

        {onResetPredefined && (
          <button
            type="button"
            onClick={() => {
              if (confirm(t.restoreDefaultsConfirm)) {
                onResetPredefined();
              }
            }}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            title={t.restoreDefaults}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.restoreDefaults}</span>
          </button>
        )}
      </div>

      {/* Add New Category Form */}
      <form
        onSubmit={handleAdd}
        className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
          <Plus className="w-4 h-4 text-indigo-600" />
          <span>{t.addNewCategoryTitle}</span>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-6 space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {t.categoryNameLabel}
            </label>
            <input
              type="text"
              required
              placeholder={t.categoryNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {t.categoryScopeLabel}
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as CategoryScope)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="all">{t.scopeAll}</option>
              <option value="bill">{t.scopeBill}</option>
              <option value="income">{t.scopeIncome}</option>
              <option value="expense">{t.scopeExpense}</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-98 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '...' : t.saveBtn}</span>
            </button>
          </div>
        </div>

        {/* Color swatches */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.colorMarkerLabel}</span>
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setSelectedColor(col)}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                  selectedColor === col ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>
      </form>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 flex-wrap">
        <span className="text-xs text-slate-400 font-bold flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" />
          {t.filterLabel}
        </span>
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t.filterAll} ({allCategories.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('bill')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeFilter === 'bill'
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t.tabBills}
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('income')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeFilter === 'income'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t.tabIncomes}
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('expense')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeFilter === 'expense'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t.tabExpenses}
        </button>
      </div>

      {/* Categories Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            {t.activeCategoriesHeader} ({filteredCategories.length})
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            {t.systemBadge} & {t.customBadge}
          </span>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            {t.noCategoriesForFilter}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredCategories.map((cat) => {
              const isEditing = editingId === cat.id;

              if (isEditing) {
                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-2xl border-2 border-indigo-500 bg-white dark:bg-slate-800 space-y-2 shadow-md"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <select
                      value={editScope}
                      onChange={(e) => setEditScope(e.target.value as CategoryScope)}
                      className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="all">{t.scopeAll}</option>
                      <option value="bill">{t.scopeBill}</option>
                      <option value="income">{t.scopeIncome}</option>
                      <option value="expense">{t.scopeExpense}</option>
                    </select>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        {PRESET_COLORS.slice(0, 4).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className="w-3.5 h-3.5 rounded-full cursor-pointer"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(cat.id)}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg cursor-pointer"
                        >
                          {t.saveBtn}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-2.5 hover:border-slate-300 transition-all shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {cat.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {getScopeLabel(cat.scope)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        cat.isPredefined
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {cat.isPredefined ? t.systemBadge : t.customBadge}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title={t.editItem}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`${t.deleteConfirmCategory} "${cat.name}"?`)) {
                          onDeleteCategory(cat.id);
                        }
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={t.deleteItem}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
