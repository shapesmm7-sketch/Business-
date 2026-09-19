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
} from 'lucide-react';
import { ActiveScreen, AppBackupData, AppSettings } from '../types';
import { StorageService } from '../services/storage';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onNavigate?: (screen: ActiveScreen) => void;
  onDataRestored: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onDataRestored,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
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
      const filename = `QuickReceipt_Backup_${dateStr}.json`;
      
      const res = await saveFile({
        data: jsonStr,
        filename,
        mimeType: 'application/json',
        title: 'QuickReceipt Data Backup',
      });

      if (res.success) {
        showToast('Backup file saved successfully!');
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
          Appearance, data backup & restore, and application information
        </p>
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

      {/* 2. Data Backup & Restore */}

      {/* 5. Data Backup & Restore */}
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
            <span>About QuickReceipt</span>
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
              QuickReceipt v1.0
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              QuickReceipt is a fast digital receipt maker designed for small businesses, shops, salons, restaurants, and freelancers.
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
              QuickReceipt operates completely on your device.
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
    </div>
  );
};
