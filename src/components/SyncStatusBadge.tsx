import React from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { LanguageCode } from '../types';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';

interface SyncStatusBadgeProps {
  language?: LanguageCode;
  className?: string;
  showTextOnMobile?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  language = 'pt',
  className = '',
  showTextOnMobile = false,
}) => {
  const { isOnline, syncState } = useSyncStatus();

  const labels = {
    offline: language === 'es' ? 'Offline' : language === 'pt' ? 'Offline' : 'Offline',
    syncing: language === 'es' ? 'Sincronizando...' : language === 'pt' ? 'Sincronizando...' : 'Syncing...',
    synced: language === 'es' ? 'Sincronizado' : language === 'pt' ? 'Sincronizado' : 'Synced',
  };

  if (!isOnline || syncState === 'offline') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/60 dark:border-amber-800/80 transition-all ${className}`}
        title={
          language === 'pt'
            ? 'Você está offline. Todas as alterações serão salvas localmente e sincronizadas quando a conexão voltar.'
            : language === 'es'
            ? 'Estás sin conexión. Los cambios se guardan localmente y se sincronizarán al reconectar.'
            : 'You are offline. Changes are saved locally and will sync when reconnected.'
        }
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className={showTextOnMobile ? 'inline' : 'hidden sm:inline'}>
          {labels.offline}
        </span>
      </div>
    );
  }

  if (syncState === 'syncing') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-300/60 dark:border-blue-800/80 transition-all ${className}`}
        title={
          language === 'pt'
            ? 'Sincronizando dados com a nuvem...'
            : language === 'es'
            ? 'Sincronizando datos con la nube...'
            : 'Syncing data with cloud...'
        }
      >
        <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
        <span className={showTextOnMobile ? 'inline' : 'hidden sm:inline'}>
          {labels.syncing}
        </span>
      </div>
    );
  }

  // Synced state
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300/60 dark:border-emerald-800/80 transition-all ${className}`}
      title={
        language === 'pt'
          ? 'Todos os dados locais estão sincronizados com a nuvem'
          : language === 'es'
          ? 'Todos los datos locales están sincronizados con la nube'
          : 'All local data is synced with the cloud'
      }
    >
      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className={showTextOnMobile ? 'inline' : 'hidden sm:inline'}>
        {labels.synced}
      </span>
    </div>
  );
};
