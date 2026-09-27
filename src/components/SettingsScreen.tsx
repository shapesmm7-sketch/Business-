import React, { useState, useEffect, useRef } from 'react';
import { saveFile } from '../services/fileSaver';
import {
  Moon,
  Sun,
  Download,
  Upload,
  Info,
  ShieldCheck,
  ChevronRight,
  Check,
  FileText,
  Crown,
  Sparkles,
  Lock,
  KeyRound,
  Cloud,
  Database,
  RefreshCw,
  FolderOpen,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ActiveScreen, AppBackupData, AppSettings, AppLockConfig, CloudflareConfig } from '../types';
import { StorageService } from '../services/storage';
import { CloudflareService } from '../services/cloudflareService';
import { CloudflareFilesModal } from './CloudflareFilesModal';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onNavigate?: (screen: ActiveScreen) => void;
  onDataRestored: () => void;
  onLockApp?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
  onDataRestored,
  onLockApp,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
    setLockConfig(StorageService.getAppLockConfig());
    setCfConfig(CloudflareService.getConfig());
  }, [settings]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [lockConfig, setLockConfig] = useState<AppLockConfig | null>(() =>
    StorageService.getAppLockConfig()
  );
  const [cfConfig, setCfConfig] = useState<CloudflareConfig>(() =>
    CloudflareService.getConfig()
  );
  const [isTestingCf, setIsTestingCf] = useState(false);
  const [isSyncingCf, setIsSyncingCf] = useState(false);
  const [isPullingCf, setIsPullingCf] = useState(false);
  const [cfTestResult, setCfTestResult] = useState<{
    success: boolean;
    d1Bound: boolean;
    r2Bound: boolean;
    message: string;
  } | null>(null);
  const [showCfFilesModal, setShowCfFilesModal] = useState(false);
  const [showCfGuide, setShowCfGuide] = useState(false);

  const subscription = StorageService.getSubscription();
  const fileImportRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveCfConfig = () => {
    const saved = CloudflareService.saveConfig(cfConfig);
    setCfConfig(saved);
    showToast('Cloudflare settings saved!');
  };

  const handleTestCf = async () => {
    setIsTestingCf(true);
    setCfTestResult(null);
    try {
      const res = await CloudflareService.testConnection(cfConfig.workerUrl, cfConfig.apiKey);
      setCfTestResult(res);
      const updated = CloudflareService.getConfig();
      setCfConfig(updated);
      showToast(res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCfTestResult({
        success: false,
        d1Bound: false,
        r2Bound: false,
        message: `Connection failed: ${msg}`,
      });
      showToast('Connection failed');
    } finally {
      setIsTestingCf(false);
    }
  };

  const handleSyncAllToCf = async () => {
    setIsSyncingCf(true);
    try {
      const res = await CloudflareService.syncAllToCloudflare();
      if (res.success) {
        showToast(res.message || 'All records successfully saved to Cloudflare D1!');
        setCfConfig(CloudflareService.getConfig());
      } else {
        showToast(`Sync failed: ${res.message || res.error}`);
      }
    } catch (err: unknown) {
      showToast(`Sync error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncingCf(false);
    }
  };

  const handlePullFromCf = async () => {
    if (!confirm('This will restore receipts, products, and settings from Cloudflare D1. Continue?')) {
      return;
    }
    setIsPullingCf(true);
    try {
      const res = await CloudflareService.pullFromCloudflare();
      if (res.success) {
        showToast(res.message);
        onDataRestored();
        setCfConfig(CloudflareService.getConfig());
      } else {
        showToast(`Restore failed: ${res.message}`);
      }
    } catch (err: unknown) {
      showToast(`Restore error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPullingCf(false);
    }
  };

  const handleFieldChange = <K extends keyof AppSettings>(
    field: K,
    val: AppSettings[K]
  ) => {
    const updated = { ...localSettings, [field]: val };
    setLocalSettings(updated);
    StorageService.saveSettings(updated);
    onUpdateSettings(updated);
  };

  // Export JSON backup file
  const handleExportBackup = async () => {
    try {
      const backup = StorageService.exportBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Brivu_Backup_${dateStr}.json`;
      
      const res = await saveFile({
        data: jsonStr,
        filename,
        mimeType: 'application/json',
        title: 'Brivu Data Backup',
      });

      if (res.success) {
        showToast(res.message);
      } else {
        showToast('Failed to export backup data');
      }
    } catch (err) {
      console.error('Export backup error:', err);
      showToast('Failed to export backup data');
    }
  };

  // Import and restore JSON backup file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as AppBackupData;
        const result = StorageService.importBackup(parsed);

        if (result.success) {
          showToast(result.message);
          onDataRestored();
        } else {
          showToast(`Error: ${result.message}`);
        }
      } catch (err) {
        console.error('Parse backup file error:', err);
        showToast('Invalid backup file JSON');
      } finally {
        if (fileImportRef.current) {
          fileImportRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 pb-28 animate-fadeIn max-w-2xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Settings & Preferences
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Appearance, membership, data backup & restore, and application information
        </p>
      </div>

      {/* Pro Membership Card */}
      <div
        onClick={() => onNavigate && onNavigate('upgrade')}
        className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-black dark:via-indigo-950 dark:to-slate-950 text-white border border-amber-500/30 shadow-md relative overflow-hidden flex items-center justify-between gap-3 cursor-pointer hover:border-amber-400/50 transition-colors"
      >
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3 min-w-0 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
            <Crown className="w-5 h-5 fill-slate-950" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white">Brivu Pro Membership</span>
              {subscription && subscription.status === 'active' ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  Active ({subscription.planName})
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  From $4.6/mo
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-200/90 font-medium truncate mt-0.5">
              {subscription && subscription.status === 'active'
                ? `Expires on ${new Date(subscription.expiresAt).toLocaleDateString()}`
                : '1 Month $4.6 • 6 Months $23.9 • 1 Year $39.9'}
            </p>
          </div>
        </div>

        <button
          id="btn-settings-upgrade"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onNavigate) onNavigate('upgrade');
          }}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer relative z-10"
        >
          <span>{subscription && subscription.status === 'active' ? 'Manage' : 'Upgrade'}</span>
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Appearance (Dark Mode) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
            {localSettings.darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              Dark Mode
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Easy on the eyes for night & low light
            </span>
          </div>
        </div>

        <button
          id="btn-toggle-dark-mode-settings"
          type="button"
          onClick={() => handleFieldChange('darkMode', !localSettings.darkMode)}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-hidden cursor-pointer ${
            localSettings.darkMode ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-white shadow-md" />
        </button>
      </div>

      {/* 2. App Lock & Security Protection */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              App Lock & Intruder Security
            </h2>
          </div>
          {lockConfig && lockConfig.isEnabled && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              PIN Protected
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Lock your app with a digit passcode to keep receipts, inventory, and sales private from intruders. Reset easily with your secret recovery word or number.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {lockConfig && lockConfig.isEnabled ? (
            <>
              <button
                id="btn-settings-manage-lock"
                type="button"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('app-lock-setup');
                  }
                }}
                className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <KeyRound className="w-4 h-4" />
                <span>Open PIN & Security Page</span>
              </button>

              <button
                id="btn-settings-lock-now"
                type="button"
                onClick={() => {
                  StorageService.setAppLocked(true);
                  if (onLockApp) {
                    onLockApp();
                  }
                }}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-emerald-500" />
                <span>Lock App Screen</span>
              </button>
            </>
          ) : (
            <button
              id="btn-settings-setup-lock"
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('app-lock-setup');
                }
              }}
              className="col-span-full p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Lock className="w-4 h-4" />
              <span>Create Passcode & Enable App Lock</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Cloudflare Cloud Sync & Storage (D1 + R2) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>Cloudflare Sync & Storage</span>
                <span className="text-[10px] lowercase font-normal text-slate-400">
                  (D1 + R2)
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Save receipts & files to R2 bucket • Sync database info to D1 SQL
              </p>
            </div>
          </div>

          <div>
            {cfConfig.lastStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            ) : cfConfig.lastStatus === 'error' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {cfConfig.workerUrl ? 'Configured' : 'Not Set'}
              </span>
            )}
          </div>
        </div>

        {/* Worker URL & Key Form */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Cloudflare Worker URL
            </label>
            <input
              type="url"
              value={cfConfig.workerUrl}
              onChange={(e) => setCfConfig((prev) => ({ ...prev, workerUrl: e.target.value }))}
              placeholder="https://brivu-cloudflare-worker.yourname.workers.dev"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-orange-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Sync Secret Key <span className="font-normal text-slate-400">(optional, for authorized access)</span>
            </label>
            <input
              type="password"
              value={cfConfig.apiKey || ''}
              onChange={(e) => setCfConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Matches SYNC_SECRET_KEY in worker"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-orange-500 font-mono"
            />
          </div>

          {/* Test & Save buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestCf}
              disabled={isTestingCf || !cfConfig.workerUrl}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingCf ? 'animate-spin text-orange-500' : ''}`} />
              <span>{isTestingCf ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCfConfig}
              className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>

          {/* Test Result Message Box */}
          {cfTestResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                cfTestResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
              }`}
            >
              {cfTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{cfTestResult.message}</p>
                {cfTestResult.success && (
                  <div className="flex items-center gap-3 text-[11px] font-medium pt-1">
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          cfTestResult.d1Bound ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                      />
                      D1 Database: {cfTestResult.d1Bound ? 'Active' : 'Not Bound'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          cfTestResult.r2Bound ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                      />
                      R2 Storage: {cfTestResult.r2Bound ? 'Active' : 'Not Bound'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sync & Storage Toggles */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
          {/* Auto-save files to R2 */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-save Files to R2 Bucket
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically backup downloaded PDFs & exported files to Cloudflare R2
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const updated = CloudflareService.saveConfig({
                  autoSaveFiles: cfConfig.autoSaveFiles === false,
                });
                setCfConfig(updated);
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                cfConfig.autoSaveFiles !== false
                  ? 'bg-orange-500 justify-end'
                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Auto-sync data to D1 */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-sync Data to D1 SQL
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically sync receipts and business records to Cloudflare D1
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const updated = CloudflareService.saveConfig({
                  autoSyncData: cfConfig.autoSyncData === false,
                });
                setCfConfig(updated);
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                cfConfig.autoSyncData !== false
                  ? 'bg-orange-500 justify-end'
                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Action Buttons: Sync All to D1, Restore from CF, Browse Files */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Sync All to D1 */}
          <button
            type="button"
            onClick={handleSyncAllToCf}
            disabled={isSyncingCf || !cfConfig.workerUrl}
            className="p-3 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer border border-orange-200 dark:border-orange-800/50"
          >
            <Upload className={`w-3.5 h-3.5 ${isSyncingCf ? 'animate-bounce' : ''}`} />
            <span>{isSyncingCf ? 'Syncing...' : 'Sync All to D1'}</span>
          </button>

          {/* Restore Data from Cloudflare */}
          <button
            type="button"
            onClick={handlePullFromCf}
            disabled={isPullingCf || !cfConfig.workerUrl}
            className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Download className={`w-3.5 h-3.5 ${isPullingCf ? 'animate-bounce' : ''}`} />
            <span>{isPullingCf ? 'Restoring...' : 'Restore from D1'}</span>
          </button>

          {/* Browse R2 Files */}
          <button
            type="button"
            onClick={() => setShowCfFilesModal(true)}
            disabled={!cfConfig.workerUrl}
            className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <FolderOpen className="w-3.5 h-3.5 text-orange-500" />
            <span>Browse R2 Files</span>
          </button>
        </div>

        {/* Collapsible Step-by-Step Setup Guide */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setShowCfGuide(!showCfGuide)}
            className="w-full flex items-center justify-between text-left py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-orange-600 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>How to Connect GitHub, Cloudflare D1 & R2</span>
            </span>
            {showCfGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showCfGuide && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 space-y-3 text-xs text-slate-600 dark:text-slate-300 animate-fadeIn">
              <p className="font-semibold text-slate-900 dark:text-white">
                Quick Setup Steps:
              </p>
              <ol className="space-y-2 list-decimal list-inside pl-1 text-[11px] leading-relaxed">
                <li>
                  <strong>Connect GitHub to Cloudflare:</strong> In Cloudflare Dashboard, go to <em>Workers & Pages</em> and connect your GitHub repo. The worker code is in <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">cloudflare/worker.ts</code>.
                </li>
                <li>
                  <strong>Create D1 Database:</strong> In Cloudflare, go to <em>Storage & Databases &gt; D1</em>, create <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">brivu-db</code>, and execute the SQL from <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">cloudflare/schema.sql</code>.
                </li>
                <li>
                  <strong>Create R2 Bucket:</strong> Go to <em>Storage & Databases &gt; R2</em> and create a bucket named <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">brivu-files</code>.
                </li>
                <li>
                  <strong>Bind D1 & R2 in Worker Settings:</strong> In your Worker settings &gt; Bindings, add D1 binding <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">DB</code> pointing to <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">brivu-db</code>, and R2 binding <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">R2_BUCKET</code> pointing to <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">brivu-files</code>.
                </li>
                <li>
                  <strong>Paste Worker URL Above:</strong> Copy your deployed Worker URL (e.g. <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">https://...workers.dev</code>) and click <em>Test Connection</em>!
                </li>
              </ol>

              <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10px] space-y-1">
                <p className="text-slate-400"># Or run with Wrangler CLI in the cloudflare/ folder:</p>
                <p>npx wrangler d1 create brivu-db</p>
                <p>npx wrangler r2 bucket create brivu-files</p>
                <p>npx wrangler d1 execute brivu-db --file=./schema.sql</p>
                <p>npx wrangler deploy</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Data Backup & Restore */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Data Backup & Restore
          </h2>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Export your receipt records and business profile to a local JSON backup file anytime. You can restore your data on this or any other device.
        </p>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Export button */}
          <button
            id="btn-export-backup"
            type="button"
            onClick={handleExportBackup}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:border-emerald-500/40 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Backup</span>
          </button>

          {/* Import file input */}
          <input
            ref={fileImportRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
            id="input-restore-backup"
          />
          <button
            id="btn-import-backup"
            type="button"
            onClick={() => fileImportRef.current?.click()}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:border-blue-500/40 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Restore Data</span>
          </button>
        </div>
      </div>

      {/* 6. About & Privacy links */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-2 border border-slate-200/80 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-700/60">
        <button
          id="btn-show-about"
          onClick={() => setShowAboutModal(true)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded-xl transition"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Info className="w-4 h-4 text-slate-400" />
            <span>About Brivu</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          id="btn-show-privacy"
          onClick={() => setShowPrivacyModal(true)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded-xl transition"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Privacy Policy (100% Offline)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* ABOUT MODAL */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Brivu v1.0
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Brivu is a fast digital receipt maker designed for small businesses, shops, salons, restaurants, and freelancers.
            </p>
            <ul className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>• Real vector PDF generation with selectable text</li>
              <li>• 5 professional receipt templates</li>
              <li>• Direct WhatsApp & Android share sheet support</li>
              <li>• 100% Offline-first local storage</li>
              <li>• Instant backup and data restoration</li>
            </ul>
            <button
              onClick={() => setShowAboutModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              100% Offline & Private
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Brivu operates completely on your device.
            </p>
            <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p>• <strong>No Accounts:</strong> You do not need to register or sign in.</p>
              <p>• <strong>Zero Remote Tracking:</strong> Your receipts, prices, customer details, and business data are never uploaded to any remote server.</p>
              <p>• <strong>You Own Your Data:</strong> Export backups anytime in open JSON format.</p>
            </div>
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* CLOUDFLARE R2 FILES MODAL */}
      <CloudflareFilesModal
        isOpen={showCfFilesModal}
        onClose={() => setShowCfFilesModal(false)}
      />
    </div>
  );
};
