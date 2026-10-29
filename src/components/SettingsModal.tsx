import React, { useRef, useState } from 'react';
import { AppSettings, CurrencyCode, LanguageCode, BillItem, IncomeItem, ExpenseItem } from '../types';
import { CURRENCIES } from '../utils/currency';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { MonthlyReportSection } from './MonthlyReportSection';
import {
  Settings,
  X,
  Moon,
  Sun,
  DollarSign,
  Globe,
  Download,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onExportData: () => void;
  onImportData: (jsonString: string) => boolean | Promise<boolean>;
  onResetAllData: () => Promise<void> | void;
  bills?: BillItem[];
  incomes?: IncomeItem[];
  expenses?: ExpenseItem[];
  currency?: CurrencyCode;
  language?: LanguageCode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  onResetAllData,
  bills = [],
  incomes = [],
  expenses = [],
  currency,
  language,
}) => {
  const [localLang, setLocalLang] = useState<LanguageCode>(language || settings.language || 'pt');

  React.useEffect(() => {
    if (language) {
      setLocalLang(language);
    } else if (settings.language) {
      setLocalLang(settings.language);
    }
  }, [language, settings.language]);

  const currentLang = localLang;
  const t = getTranslations(currentLang);
  const activeCurrency = currency || settings.currency || 'BRL';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmResetAll, setShowConfirmResetAll] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isResetting, setIsResetting] = useState(false);

  React.useEffect(() => {
    let timer: any = null;
    if (showConfirmResetAll) {
      setCountdown(10);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(10);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showConfirmResetAll]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          setIsRestoring(true);
          const success = await onImportData(content);
          if (success) {
            setImportStatus({
              success: true,
              msg: t.restoreSuccessMsg || t.importSuccessMsg,
            });
            setTimeout(() => setImportStatus(null), 4000);
          } else {
            setImportStatus({
              success: false,
              msg: t.restoreErrorMsg || t.importErrorMsg,
            });
          }
        } catch {
          setImportStatus({
            success: false,
            msg: t.restoreErrorMsg || t.importErrorMsg,
          });
        } finally {
          setIsRestoring(false);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 overflow-hidden overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (pinned) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.settingsTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.settingsSubtitle}
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

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {importStatus && (
            <div
              className={`p-3 text-xs rounded-xl border ${
                importStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
              }`}
            >
              {importStatus.msg}
            </div>
          )}

          {/* Idioma do Aplicativo (Top prominence for instant translation) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-500" />
              {t.languageSettingLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(LANGUAGES) as LanguageCode[]).map((langCode) => {
                const langConfig = LANGUAGES[langCode];
                const isSelected = currentLang === langCode;
                return (
                  <button
                    key={langCode}
                    type="button"
                    onClick={() => {
                      setLocalLang(langCode);
                      onUpdateSettings({ language: langCode });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-extrabold">
                      <span>{langConfig.flag}</span>
                      <span>{langConfig.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t.languageSettingDesc}
            </p>
          </div>

          {/* Moeda e País */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              {t.currencySettingLabel}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                const isSelected = settings.currency === code;
                const config = CURRENCIES[code];
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onUpdateSettings({ currency: code })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-extrabold font-mono-numbers">
                      <span>{config.flag}</span>
                      <span>{config.symbol} {code}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {config.name}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t.currencySettingDesc}
            </p>
          </div>

          {/* Tema de Aparência (Modo Claro & Modo Escuro) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>{t.themeSettingLabel || 'Tema de Aparência'}</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Botão Modo Claro */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ darkMode: false })}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                  !settings.darkMode
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold shadow-xs ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-extrabold">{t.lightModeLabel || 'Modo Claro'}</div>
                  <div className="text-[10px] text-slate-500">{!settings.darkMode ? t.activeStatus : t.activateAction}</div>
                </div>
              </button>

              {/* Botão Modo Escuro */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ darkMode: true })}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                  settings.darkMode
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-extrabold">{t.darkModeLabel || 'Modo Escuro'}</div>
                  <div className="text-[10px] text-slate-500">{settings.darkMode ? t.activeStatus : t.activateAction}</div>
                </div>
              </button>
            </div>
          </div>

            {/* Sons */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    {t.soundLabel}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {settings.soundEnabled ? t.soundActivated : t.soundMuted}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  settings.soundEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          {/* 1. Relatório Mensal & Gráfico de Pizza por Categoria */}
          <MonthlyReportSection
            bills={bills}
            incomes={incomes}
            expenses={expenses}
            currency={activeCurrency}
            language={currentLang}
          />

          {/* 2. Backup e Restauração */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              {t.backupSectionTitle || t.backupDataTitle}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t.backupSectionDesc || t.backupDataDesc}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onExportData}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>{t.downloadBackupBtn || t.exportDataBtn}</span>
              </button>

              <button
                type="button"
                disabled={isRestoring}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Upload className={`w-4 h-4 text-teal-500 ${isRestoring ? 'animate-bounce' : ''}`} />
                <span>{isRestoring ? (t.restoringBackup || 'Restaurando...') : (t.importRestoreBackupBtn || t.importDataBtn)}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                disabled={isRestoring}
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* 3. Zona de Perigo / Apagar Dados */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="block text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {t.dangerZoneTitle}
            </span>

            {/* Reset all data (Modo de Fábrica) */}
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {t.resetAllDataTitle}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.resetAllDataDesc}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCountdown(10);
                  setShowConfirmResetAll(true);
                }}
                className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.resetAllDataBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Caixa de Pergunta com Proteção de 10 Segundos (100% Traduzida) */}
      {showConfirmResetAll && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isResetting) setShowConfirmResetAll(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-rose-300 dark:border-rose-900 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t.resetFactoryTitle}
                </h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  {t.resetFactorySubtitle}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-rose-900 dark:text-rose-200">
                {t.resetFactoryQuestion}
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li>{t.resetFactoryItem1}</li>
                <li>{t.resetFactoryItem2}</li>
                <li>{t.resetFactoryItem3}</li>
                <li>{t.resetFactoryItem4}</li>
                <li>{t.resetFactoryItem5}</li>
              </ul>
            </div>

            {/* Trava de Segurança de 10 Segundos */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {t.securityLock}
              </span>
              {countdown > 0 ? (
                <span className="font-bold font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  {t.securityWaitPrefix} {countdown}{t.securityWaitSuffix}
                </span>
              ) : (
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>✓</span> {t.securityUnlocked}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmResetAll(false);
                  setCountdown(10);
                }}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                disabled={countdown > 0 || isResetting}
                onClick={async () => {
                  try {
                    setIsResetting(true);
                    await onResetAllData();
                    setShowConfirmResetAll(false);
                    onClose();
                  } catch (err) {
                    console.error('Error during factory reset:', err);
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all ${
                  countdown > 0 || isResetting
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white cursor-pointer hover:shadow-md'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isResetting
                    ? t.resettingProgress
                    : countdown > 0
                    ? `${t.securityWaitPrefix} (${countdown}s)`
                    : t.confirmResetAllBtn}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
