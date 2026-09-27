import React, { useState } from 'react';
import {
  ArrowLeft,
  Cloud,
  Upload,
  Download,
  FolderOpen,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  FileText,
  Database,
  Check,
  Sparkles,
  Lock,
} from 'lucide-react';
import { CloudflareConfig } from '../types';
import { CloudflareService } from '../services/cloudflareService';
import { CloudflareFilesModal } from './CloudflareFilesModal';

interface CloudBackupScreenProps {
  onBack: () => void;
  onDataRestored?: () => void;
}

export function CloudBackupScreen({ onBack, onDataRestored }: CloudBackupScreenProps) {
  const [cfConfig, setCfConfig] = useState<CloudflareConfig>(() =>
    CloudflareService.getConfig()
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleAutoFiles = () => {
    const nextVal = cfConfig.autoSaveFiles === false;
    const updated = CloudflareService.saveConfig({ autoSaveFiles: nextVal });
    setCfConfig(updated);
    showToast(nextVal ? 'Auto-save files enabled' : 'Auto-save files disabled');
  };

  const handleToggleAutoSync = () => {
    const nextVal = cfConfig.autoSyncData === false;
    const updated = CloudflareService.saveConfig({ autoSyncData: nextVal });
    setCfConfig(updated);
    showToast(nextVal ? 'Auto-sync records enabled' : 'Auto-sync records disabled');
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await CloudflareService.syncAllToCloudflare();
      if (res.success) {
        showToast(res.message || 'All records successfully backed up to cloud database!');
        setCfConfig(CloudflareService.getConfig());
      } else {
        showToast(`Backup issue: ${res.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Backup failed: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async () => {
    if (
      !confirm(
        'This will download and restore your receipts, products, and settings from cloud storage. Continue?'
      )
    ) {
      return;
    }
    setIsPulling(true);
    try {
      const res = await CloudflareService.pullFromCloudflare();
      if (res.success) {
        showToast(res.message || 'Data successfully restored from cloud storage!');
        if (onDataRestored) {
          onDataRestored();
        }
        setCfConfig(CloudflareService.getConfig());
      } else {
        showToast(`Restore issue: ${res.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Restore failed: ${msg}`);
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-slate-700/50 dark:border-slate-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Cloud Backup</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Secure automated backup & cloud storage
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active & Protected</span>
        </div>
      </div>

      {/* Main Status Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-600 p-5 text-white shadow-md">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dual-Layer Storage</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight">Cloud Data Protection</h2>
            <p className="text-xs text-orange-100 mt-1 leading-relaxed">
              Your receipts, products, customers, and exported PDFs are safely preserved in cloud storage. Even if you switch devices or clear browser history, your business records remain intact.
            </p>
          </div>

          {cfConfig.lastSyncAt && (
            <div className="pt-1 text-[11px] text-orange-100 font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 opacity-80" />
              <span>Last synced: {new Date(cfConfig.lastSyncAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Backup Settings Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Automatic Sync Options
          </h3>
        </div>

        <div className="space-y-3.5">
          {/* Toggle: Auto-save files */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-save Files & PDFs
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically backup downloaded PDFs & exported documents to cloud storage
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoFiles}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer shrink-0 ${
                cfConfig.autoSaveFiles !== false
                  ? 'bg-orange-500 justify-end'
                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
              aria-label="Toggle auto-save files"
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Toggle: Auto-sync records */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-sync Business Records
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically sync receipts, customers, and inventory data
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoSync}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer shrink-0 ${
                cfConfig.autoSyncData !== false
                  ? 'bg-orange-500 justify-end'
                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
              aria-label="Toggle auto-sync records"
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Actions Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <Database className="w-4 h-4 text-orange-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Cloud Operations
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Backup Now */}
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="p-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer border border-orange-200 dark:border-orange-800/50 text-center shadow-xs"
          >
            <Upload className={`w-5 h-5 ${isSyncing ? 'animate-bounce text-orange-600' : ''}`} />
            <span>{isSyncing ? 'Backing up...' : 'Backup to Cloud'}</span>
            <span className="text-[10px] font-normal text-orange-600/80 dark:text-orange-400">
              Save all records now
            </span>
          </button>

          {/* Restore from Cloud */}
          <button
            type="button"
            onClick={handleRestore}
            disabled={isPulling}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-slate-700 text-center shadow-xs"
          >
            <Download className={`w-5 h-5 ${isPulling ? 'animate-bounce text-slate-600' : ''}`} />
            <span>{isPulling ? 'Restoring...' : 'Restore from Cloud'}</span>
            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
              Recover saved data
            </span>
          </button>

          {/* Browse Files */}
          <button
            type="button"
            onClick={() => setShowFilesModal(true)}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 text-center shadow-xs"
          >
            <FolderOpen className="w-5 h-5 text-orange-500" />
            <span>Browse Cloud Files</span>
            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
              View saved PDFs & docs
            </span>
          </button>
        </div>
      </div>

      {/* Security & Reliability Features */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Why Cloud Backup is Safe & Reliable</span>
        </h4>
        <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Offline-first:</strong> You can continue generating receipts without internet. They sync seamlessly once reconnected.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Permanent file safety:</strong> Downloaded receipts & invoices are archived in high-availability cloud storage.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Zero manual setup:</strong> Everything is connected securely and automatically in the background.
            </span>
          </li>
        </ul>
      </div>

      {/* Files Modal */}
      {showFilesModal && (
        <CloudflareFilesModal onClose={() => setShowFilesModal(false)} />
      )}
    </div>
  );
}
