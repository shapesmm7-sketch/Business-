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
  Cloud,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Ban,
  Lock,
  Key,
  ExternalLink,
} from 'lucide-react';
import { ActiveScreen, AppBackupData, AppSettings, CloudflareConfig } from '../types';
import { StorageService } from '../services/storage';
import { CloudflareService } from '../services/cloudflareService';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { BluetoothPrinterSettings } from './BluetoothPrinterSettings';

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
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [cfConfig, setCfConfig] = useState<CloudflareConfig>(() => CloudflareService.getConfig());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setCfConfig(CloudflareService.getConfig());
  }, [settings]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [workosState, setWorkosState] = useState<{
    loading: boolean;
    clientId: string;
    apiKeyConfigured: boolean;
    cloudflareClientIdConfigured: boolean;
    cloudflareApiKeyConfigured: boolean;
    isUsingFallback: boolean;
    redirectUri: string;
    authUrl: string;
    error: string | null;
  }>({
    loading: false,
    clientId: '',
    apiKeyConfigured: false,
    cloudflareClientIdConfigured: false,
    cloudflareApiKeyConfigured: false,
    isUsingFallback: true,
    redirectUri: '',
    authUrl: '',
    error: null,
  });

  const [overrideKeys, setOverrideKeys] = useState(cfConfig.overrideWorkosKeys || false);
  const [customClientId, setCustomClientId] = useState(cfConfig.customWorkosClientId || '');
  const [customApiKey, setCustomApiKey] = useState(cfConfig.customWorkosApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);

  const fetchWorkosDiagnostics = async () => {
    setWorkosState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const config = await CloudflareService.getWorkOSConfig();
      setWorkosState({
        loading: false,
        clientId: config.clientId || '',
        apiKeyConfigured: config.apiKeyConfigured || false,
        cloudflareClientIdConfigured: config.cloudflareClientIdConfigured || false,
        cloudflareApiKeyConfigured: config.cloudflareApiKeyConfigured || false,
        isUsingFallback: config.isUsingFallback ?? true,
        redirectUri: config.redirectUri || window.location.origin,
        authUrl: config.authUrl || '',
        error: null,
      });
    } catch (err: any) {
      setWorkosState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to fetch live WorkOS diagnostics from Cloudflare Worker.',
      }));
    }
  };

  useEffect(() => {
    fetchWorkosDiagnostics();
  }, [cfConfig]);

  const handleSaveCustomWorkos = () => {
    const updated = CloudflareService.saveConfig({
      overrideWorkosKeys: overrideKeys,
      customWorkosClientId: customClientId.trim(),
      customWorkosApiKey: customApiKey.trim(),
    });
    setCfConfig(updated);
    showToast('WorkOS overrides updated successfully!');
  };

  const subscription = StorageService.getSubscription();
  const fileImportRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleBackupNow = async () => {
    const user = StorageService.getWorkOSUser();
    if (!user || !user.email) {
      showToast('Please sign in with Google to save & backup your data to the cloud.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await CloudflareService.syncAllToCloudflare();
      const updatedCf = CloudflareService.getConfig();
      setCfConfig(updatedCf);
      if (res.success) {
        showToast('Backup completed! Cloudflare sync successful.');
      } else {
        showToast(`Backup note: ${res.message || 'Synced locally'}`);
      }
    } catch (err) {
      showToast('Failed to complete Cloudflare backup');
    } finally {
      setIsSyncing(false);
    }
  };

  const lastSyncAt = cfConfig?.lastSyncAt;
  const daysSinceSync = lastSyncAt
    ? Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const needsBackupReminder = lastSyncAt === undefined || daysSinceSync === null || daysSinceSync >= 7;

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
                  From $3.6/mo
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-200/90 font-medium truncate mt-0.5">
              {subscription && subscription.status === 'active'
                ? `Expires on ${new Date(subscription.expiresAt).toLocaleDateString()}`
                : '1 Month $3.6 • 6 Months $19.2 • 1 Year $31.9'}
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

      {/* 3. Bluetooth Thermal Printer Discovery & Setup */}
      <BluetoothPrinterSettings
        settings={localSettings}
        onUpdateSettings={(updated) => {
          setLocalSettings(updated);
          onUpdateSettings(updated);
        }}
      />

      {/* 4. Cloud Storage & Backup Page Navigation Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <button
          id="btn-settings-open-cloud-backup"
          type="button"
          onClick={() => {
            if (onNavigate) {
              onNavigate('cloud-backup');
            }
          }}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>Cloud Backup</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sync receipts, products & file storage in the cloud
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
        </button>
      </div>

      {/* Cloudflare Sync Backup Reminder Card */}
      <div
        id="card-cloudflare-backup-reminder"
        className={`rounded-2xl p-4 border shadow-xs transition-all ${
          needsBackupReminder
            ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30 text-amber-950 dark:text-amber-100'
            : 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                needsBackupReminder
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {needsBackupReminder ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider">
                  {needsBackupReminder ? 'Cloud Backup Reminder' : 'Cloud Backup Up to Date'}
                </span>
                {needsBackupReminder && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-slate-950">
                    {daysSinceSync === null ? 'Sync Needed' : `${daysSinceSync} Days Since Sync`}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-300 leading-snug">
                {needsBackupReminder
                  ? `It has been ${
                      daysSinceSync === null ? 'more than 7 days' : `${daysSinceSync} days`
                    } since your last successful Cloudflare sync. Tap 'Backup Now' to sync database & receipts.`
                  : `Last successful Cloudflare sync was ${
                      daysSinceSync === 0 ? 'today' : `${daysSinceSync} day${daysSinceSync === 1 ? '' : 's'} ago`
                    }.`}
              </p>
            </div>
          </div>

          <button
            id="btn-settings-backup-now"
            type="button"
            disabled={isSyncing}
            onClick={handleBackupNow}
            className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-md transition active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer ${
              needsBackupReminder
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            } ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Backup Now'}</span>
          </button>
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

      {/* WorkOS Google Sign-In Setup & Live Diagnostics Panel */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                WorkOS Google Sign-In Diagnostics
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Verify connections, credentials & debug "wrong secret" errors
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchWorkosDiagnostics}
            disabled={workosState.loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-orange-600 transition flex items-center gap-1 cursor-pointer text-[11px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${workosState.loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {workosState.loading ? (
          <div className="py-4 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
            <span className="text-xs text-slate-500">Retrieving Cloudflare Worker state...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection status pills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Cloudflare Worker:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Worker Status:</span>
                {workosState.isUsingFallback ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">
                    Using fallbacks
                  </span>
                ) : (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
                    Custom Active
                  </span>
                )}
              </div>
            </div>

            {/* Cloudflare Env Bindings Detection */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-800 dark:text-white block text-[11px] uppercase tracking-wider text-slate-500">
                Cloudflare Dashboard Variable Bindings
              </span>
              
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Natively Bound WORKOS_CLIENT_ID:</span>
                {workosState.cloudflareClientIdConfigured ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Detected
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Pending (Using Fallback)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Natively Bound WORKOS_API_KEY:</span>
                {workosState.cloudflareApiKeyConfigured ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Detected
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Pending (Using Fallback)
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Active WorkOS Client ID in use:</span>
                <span className="font-mono text-[10px] bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 select-all truncate max-w-[200px]" title={workosState.clientId}>
                  {workosState.clientId || 'None'}
                </span>
              </div>
            </div>

            {/* Live Override panel */}
            <div className="p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white block">
                    Local Settings Keys Override (Immediate Working Solution)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                    Allows you to specify your own Client ID & API Key right inside the app! No need to redeploy the worker.
                  </span>
                </div>
                <button
                  id="btn-toggle-override-keys"
                  type="button"
                  onClick={() => setOverrideKeys(!overrideKeys)}
                  className={`w-10 h-5 shrink-0 flex items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-hidden cursor-pointer ${
                    overrideKeys ? 'bg-orange-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {overrideKeys && (
                <div className="space-y-2.5 pt-1.5 animate-fadeIn text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      WorkOS Client ID (starts with client_...)
                    </label>
                    <input
                      type="text"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      placeholder="client_01M4B..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      WorkOS API Key / Client Secret (starts with sk_... or api_...)
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        placeholder="sk_live_..."
                        className="w-full pl-3 pr-10 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-orange-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCustomWorkos}
                    className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Locally & Override</span>
                  </button>
                </div>
              )}
            </div>

            {/* Diagnostic helper message for secrets */}
            <div className="p-3 bg-blue-500/5 dark:bg-blue-950/10 border border-blue-500/10 rounded-xl space-y-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              <div className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Info className="w-4 h-4 stroke-[2]" />
                <span>How Your Secrets & Keys Connect</span>
              </div>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                <li>
                  <strong className="text-slate-800 dark:text-white">1. WorkOS API Key (WORKOS_API_KEY):</strong>
                  <br />
                  Generated in your <strong className="text-slate-700 dark:text-slate-200">WorkOS Dashboard &rarr; API Keys</strong> (starts with <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">sk_...</code>).
                  This is the secret added in your <strong className="text-slate-700 dark:text-slate-200">Cloudflare Worker &rarr; Settings &rarr; Variables and Secrets</strong> (or entered above in Local Overrides). Always click <strong className="text-indigo-600 dark:text-indigo-400">"Save and deploy"</strong> in Cloudflare so your Worker runs the new key.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white">2. Google Client Secret:</strong>
                  <br />
                  Generated in your <strong className="text-slate-700 dark:text-slate-200">Google Cloud Console &rarr; Credentials &rarr; OAuth 2.0 Client IDs</strong> (starts with <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">GOCSPX-...</code>).
                  This secret is pasted exclusively inside your <strong className="text-slate-700 dark:text-slate-200">WorkOS Dashboard &rarr; Authentication &rarr; Social Login &rarr; Google</strong>.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white">3. Google Authorized Redirect URI:</strong>
                  <br />
                  Must be set in Google Cloud Console to:
                  <div className="mt-1 font-mono text-[10px] bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 select-all font-bold text-slate-800 dark:text-slate-300">
                    https://auth.workos.com/sso/oauth/google/callback
                  </div>
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white">4. WorkOS Redirect URIs (For Web & Android APK):</strong>
                  <br />
                  <span>
                    In your <strong className="text-slate-700 dark:text-slate-200">WorkOS Dashboard &rarr; Configuration &rarr; Redirects</strong>, add your Cloudflare Worker URL endpoints.
                    <span className="text-rose-500 font-semibold block mt-1">
                      ⚠️ Never use your Google Play app URL in WorkOS Redirects: Google Play Store cannot handle OAuth tokens or return to your app.
                    </span>
                  </span>
                  <div className="mt-1.5 space-y-1 font-mono text-[10px]">
                    <div className="bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 select-all font-bold text-slate-800 dark:text-slate-300">
                      https://brivu.shapesmm7.workers.dev/callback
                    </div>
                    <div className="bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 select-all font-bold text-slate-800 dark:text-slate-300">
                      https://brivu.shapesmm7.workers.dev
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 5. App Transparency & Ad-Free Subscription Status */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                App Transparency
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Privacy, Data Sovereignty & Ad Status
              </p>
            </div>
          </div>

          {/* Clearly Labeled Ad-Free Subscription Badge */}
          {subscription && subscription.status === 'active' ? (
            <span
              id="badge-ad-free-subscription"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs"
            >
              <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
              <span>Ad-Free Subscription: Active</span>
            </span>
          ) : (
            <span
              id="badge-ad-free-subscription"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
            >
              <AlertCircle className="w-3 h-3 stroke-[2]" />
              <span>Ad-Free Subscription: Inactive</span>
            </span>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-rose-500" />
              <span>Ad Visibility:</span>
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {subscription && subscription.status === 'active' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  100% Ad-Free (All Ads Suppressed)
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Ads Active (Free Tier)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Plan Tier:</span>
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {subscription && subscription.status === 'active'
                ? `${subscription.planName} (${subscription.formattedPrice})`
                : 'Free Standard Plan'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Data Protection:</span>
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              Zero 3rd-Party Tracking / Local First
            </span>
          </div>

          {subscription && subscription.status === 'active' && subscription.expiresAt && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Renewal / Expiry Date:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Action button if not subscribed */}
        {(!subscription || subscription.status !== 'active') && (
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('upgrade')}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 fill-white" />
            <span>Upgrade to Remove All Ads & Unlock Pro</span>
          </button>
        )}
      </div>

      {/* 6. About & Privacy links */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-2 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <button
          id="btn-show-privacy"
          onClick={() => setShowPrivacyModal(true)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded-xl transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Privacy Policy</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* COMPREHENSIVE PRIVACY POLICY MODAL */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};
