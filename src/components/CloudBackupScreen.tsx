import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Cloud,
  Upload,
  Download,
  FolderOpen,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Database,
  Check,
  Sparkles,
  AlertTriangle,
  Info,
  Server,
  HelpCircle,
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
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<{
    loading: boolean;
    checked: boolean;
    success: boolean;
    d1Bound: boolean;
    r2Bound: boolean;
    message?: string;
  }>({
    loading: true,
    checked: false,
    success: false,
    d1Bound: false,
    r2Bound: false,
  });

  const checkLiveHealth = async () => {
    setHealthStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await CloudflareService.testConnection();
      setHealthStatus({
        loading: false,
        checked: true,
        success: res.success,
        d1Bound: res.d1Bound,
        r2Bound: res.r2Bound,
        message: res.message,
      });
      setCfConfig(CloudflareService.getConfig());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealthStatus({
        loading: false,
        checked: true,
        success: false,
        d1Bound: false,
        r2Bound: false,
        message: `Connection failed: ${msg}`,
      });
    }
  };

  useEffect(() => {
    checkLiveHealth();
  }, []);

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
        checkLiveHealth();
      } else {
        showToast(`Backup error: ${res.message}`);
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

  const isFullyOperational = healthStatus.checked && healthStatus.d1Bound && healthStatus.r2Bound;
  const isPartiallyBound = healthStatus.checked && (healthStatus.d1Bound || healthStatus.r2Bound);
  const isNotBound = healthStatus.checked && !healthStatus.d1Bound && !healthStatus.r2Bound;

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
              Cloudflare D1 SQL & R2 File Storage
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        {healthStatus.loading ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Checking...</span>
          </div>
        ) : isFullyOperational ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active & Bound</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Bindings Missing</span>
          </div>
        )}
      </div>

      {/* Binding Status Alert Card (When not fully bound) */}
      {healthStatus.checked && !isFullyOperational && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Worker Connected, but D1 & R2 are NOT bound yet
              </h3>
            </div>
            <button
              type="button"
              onClick={checkLiveHealth}
              disabled={healthStatus.loading}
              className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthStatus.loading ? 'animate-spin' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>

          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Your Cloudflare Worker is running, but Cloudflare is reporting that D1 and R2 are not attached to it yet. Until you add and deploy these bindings in Cloudflare, files and data will only be stored locally on your device.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              healthStatus.d1Bound
                ? 'bg-emerald-100/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                : 'bg-rose-100/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
            }`}>
              <span className="font-semibold">D1 Database (DB)</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/30">
                {healthStatus.d1Bound ? 'Active ✓' : 'Not Bound ✕'}
              </span>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              healthStatus.r2Bound
                ? 'bg-emerald-100/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                : 'bg-rose-100/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
            }`}>
              <span className="font-semibold">R2 Storage (R2_BUCKET)</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/30">
                {healthStatus.r2Bound ? 'Active ✓' : 'Not Bound ✕'}
              </span>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer underline"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showHelpGuide ? 'Hide Instructions' : 'How to finish binding in Cloudflare Dashboard'}</span>
            </button>
          </div>

          {showHelpGuide && (
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-2 mt-2">
              <p className="font-bold text-slate-900 dark:text-white">
                Follow these 3 exact steps in Cloudflare:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px]">
                <li>
                  Open <strong>dash.cloudflare.com</strong> &gt; <strong>Workers & Pages</strong> &gt; Click your worker <strong>brivu</strong>.
                </li>
                <li>
                  Go to <strong>Settings</strong> &gt; <strong>Variables and Bindings</strong> (or <strong>Bindings</strong>).
                </li>
                <li>
                  <strong>Add D1 Binding:</strong> Variable name must be exact uppercase <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-emerald-600">DB</code>, select your database (<strong>brivu-db</strong>).
                </li>
                <li>
                  <strong>Add R2 Binding:</strong> Variable name must be exact uppercase <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-emerald-600">R2_BUCKET</code>, select your bucket (<strong>brivu-files</strong>).
                </li>
                <li>
                  <strong>IMPORTANT:</strong> Scroll down and click the blue <strong>&quot;Save and Deploy&quot;</strong> or <strong>&quot;Deploy&quot;</strong> button. If you leave the page without deploying, Cloudflare will not activate the bindings!
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

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
              Your receipts, products, customers, and exported PDFs are preserved in cloud storage. Even if you switch devices or clear browser history, your business records remain safe.
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

      {/* Automatic Sync Options Card */}
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
                Auto-save Files, Photos & PDFs
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically upload receipts, product photos & downloaded PDFs to Cloudflare R2
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
                Automatically sync receipts, customers, and inventory data to Cloudflare D1
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

      {/* Cloud Operations Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Cloud Operations
            </h3>
          </div>
          <button
            type="button"
            onClick={checkLiveHealth}
            disabled={healthStatus.loading}
            className="text-[11px] text-slate-500 hover:text-orange-600 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${healthStatus.loading ? 'animate-spin' : ''}`} />
            <span>Check Health</span>
          </button>
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
