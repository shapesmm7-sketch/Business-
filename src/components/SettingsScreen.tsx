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
  Cloud,
} from 'lucide-react';
import { ActiveScreen, AppBackupData, AppSettings, AppLockConfig } from '../types';
import { StorageService } from '../services/storage';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

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
  }, [settings]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [lockConfig, setLockConfig] = useState<AppLockConfig | null>(() =>
    StorageService.getAppLockConfig()
  );

  const subscription = StorageService.getSubscription();
  const fileImportRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

        <div className="pt-1">
          {lockConfig && lockConfig.isEnabled ? (
            <button
              id="btn-settings-lock-now"
              type="button"
              onClick={() => {
                StorageService.setAppLocked(true);
                if (onLockApp) {
                  onLockApp();
                }
              }}
              className="w-full p-3.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Lock className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>Lock App Screen</span>
            </button>
          ) : (
            <button
              id="btn-settings-setup-lock"
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('app-lock-setup');
                }
              }}
              className="w-full p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Lock className="w-4 h-4" />
              <span>Create Passcode & Enable App Lock</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Cloud Storage & Backup Page Navigation Card */}
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
          className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded-xl transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Privacy Policy</span>
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
              Brivu is a fast digital receipt and business management platform designed for small businesses, shops, salons, restaurants, and freelancers.
            </p>
            <ul className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>• Real vector PDF generation with selectable text</li>
              <li>• 5 professional receipt templates</li>
              <li>• Direct WhatsApp & Android share sheet support</li>
              <li>• Offline-first local storage with automatic Cloud Backup</li>
              <li>• Instant backup and data restoration</li>
            </ul>
            <button
              onClick={() => setShowAboutModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE PRIVACY POLICY MODAL */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};
