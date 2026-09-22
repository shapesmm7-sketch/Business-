import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  Info,
} from 'lucide-react';
import { AppLockConfig } from '../types';
import { StorageService } from '../services/storage';

interface AppLockSetupScreenProps {
  onBack: () => void;
  onLockNow: () => void;
  onConfigChange?: (config: AppLockConfig | null) => void;
  initialMode?: 'view' | 'form';
}

export const AppLockSetupScreen: React.FC<AppLockSetupScreenProps> = ({
  onBack,
  onLockNow,
  onConfigChange,
  initialMode,
}) => {
  const [currentConfig, setCurrentConfig] = useState<AppLockConfig | null>(() =>
    StorageService.getAppLockConfig()
  );

  const [mode, setMode] = useState<'view' | 'form'>(() => {
    if (initialMode) return initialMode;
    const existing = StorageService.getAppLockConfig();
    return existing && existing.isEnabled ? 'view' : 'form';
  });

  // Form states - app lock disabled by default
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [secretWord, setSecretWord] = useState<string>('');
  const [autoLockOnExit, setAutoLockOnExit] = useState<boolean>(true);

  const [showPin, setShowPin] = useState<boolean>(false);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const cfg = StorageService.getAppLockConfig();
    setCurrentConfig(cfg);
    if (cfg && cfg.isEnabled) {
      setAutoLockOnExit(cfg.autoLockOnExit !== false);
    } else {
      setAutoLockOnExit(true);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate PIN
    const cleanedPin = pin.trim();
    if (!/^\d{4,8}$/.test(cleanedPin)) {
      setErrorMsg('Passcode must be between 4 and 8 numeric digits (0-9).');
      return;
    }

    if (cleanedPin !== confirmPin.trim()) {
      setErrorMsg('Passcodes do not match. Please re-type your passcode carefully.');
      return;
    }

    // Validate Secret Word / Number
    const cleanedSecret = secretWord.trim();
    if (!cleanedSecret || cleanedSecret.length < 2) {
      setErrorMsg('Please enter a recovery Secret Word or Number (at least 2 characters).');
      return;
    }

    const newConfig: AppLockConfig = {
      isEnabled: true,
      pin: cleanedPin,
      secretWord: cleanedSecret,
      autoLockOnExit: true,
      updatedAt: new Date().toISOString(),
    };

    StorageService.saveAppLockConfig(newConfig);
    StorageService.setAppLocked(true);
    setCurrentConfig(newConfig);
    if (onConfigChange) {
      onConfigChange(newConfig);
    }

    setSuccessMsg('Passcode saved! Locking app now...');
    setTimeout(() => {
      setSuccessMsg(null);
      onLockNow();
    }, 500);
  };

  const handleToggleAutoLock = (enabled: boolean) => {
    setAutoLockOnExit(enabled);
    if (currentConfig) {
      const updated: AppLockConfig = {
        ...currentConfig,
        autoLockOnExit: enabled,
      };
      StorageService.saveAppLockConfig(updated);
      setCurrentConfig(updated);
      if (onConfigChange) {
        onConfigChange(updated);
      }
    }
  };

  const handleDisableLock = () => {
    if (
      confirm(
        'Are you sure you want to turn off App Lock? Anyone opening this device will have unrestricted access to all records.'
      )
    ) {
      StorageService.saveAppLockConfig(null);
      StorageService.setAppLocked(false);
      setCurrentConfig(null);
      if (onConfigChange) {
        onConfigChange(null);
      }
      setSuccessMsg('App Lock disabled.');
      setTimeout(() => {
        onBack();
      }, 800);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 animate-fadeIn">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <button
          id="btn-back-app-lock"
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="text-center flex-1 min-w-0 pr-6">
          <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
            {currentConfig && currentConfig.isEnabled ? 'App Lock Security' : 'Create App Lock'}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            PIN passcode protection & intruder lock
          </p>
        </div>
      </div>

      {/* Toast Feedback */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Security Hero Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-black dark:via-indigo-950 dark:to-slate-950 text-white border border-indigo-900/60 shadow-xl relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white tracking-tight">
                  {currentConfig && currentConfig.isEnabled ? 'App Lock Active' : 'Intruder Lock Disabled'}
                </h2>
                {currentConfig && currentConfig.isEnabled ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                    Protected
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 leading-snug">
                {currentConfig && currentConfig.isEnabled
                  ? `${currentConfig.pin.length}-Digit Passcode & Secret Word Recovery Enabled`
                  : 'Protect all sales, receipts, stock, and business privacy with a numeric PIN'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW / MANAGE MODE */}
      {mode === 'view' && currentConfig && currentConfig.isEnabled && (
        <div className="space-y-4">
          {/* Lock Action Hero Button */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Instant Security Actions
            </h3>

            <button
              id="btn-page-lock-app-now"
              type="button"
              onClick={() => {
                StorageService.setAppLocked(true);
                onLockNow();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4.5 h-4.5" />
              <span>Lock App Immediately</span>
            </button>

            {/* Auto Lock On App Open Toggle */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Auto-Lock on App Open / Reload
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Always ask for passcode when the app is launched
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoLockOnExit}
                  onChange={(e) => handleToggleAutoLock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Manage Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setPin('');
                setConfirmPin('');
                setSecretWord('');
                setMode('form');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition active:scale-[0.99] flex items-center gap-3 cursor-pointer shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Change Passcode & Secret
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Update PIN or recovery secret
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDisableLock}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition active:scale-[0.99] flex items-center gap-3 cursor-pointer shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  Turn Off App Lock
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Remove passcode protection
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* FORM MODE: CREATE / UPDATE PASSCODE & SECRET WORD */}
      {(mode === 'form' || !currentConfig || !currentConfig.isEnabled) && (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Card 1: Passcode Digits */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Step 1: Set Numeric Passcode (PIN)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Choose 4 to 8 numeric digits to lock and unlock the app
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Create Passcode:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPin ? 'Hide Digits' : 'Show Digits'}</span>
                  </button>
                </div>
                <input
                  id="input-create-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. 1234"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono text-lg tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Confirm Passcode:
                </label>
                <input
                  id="input-confirm-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, ''));
                    setErrorMsg(null);
                  }}
                  placeholder="Re-enter the same digits"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono text-lg tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Secret Word or Number Recovery */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-indigo-950/30 rounded-3xl p-5 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                  Step 2: Recovery Secret Word or Number
                </h3>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  Essential for resetting your passcode if you ever forget it
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-100/60 dark:bg-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>
                If you forget your digits passcode, you can enter this secret word or number on the lock screen to instantly reset and restore access.
              </span>
            </div>

            <div className="pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Secret Word or Number:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="input-secret-word"
                  type={showSecret ? 'text' : 'password'}
                  value={secretWord}
                  onChange={(e) => {
                    setSecretWord(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. Kampala, 1994, Simba, or favorite movie"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Auto-Lock on App Open / Reload
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lock app immediately whenever you open or refresh
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoLockOnExit}
                onChange={(e) => setAutoLockOnExit(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Save Action */}
          <div className="space-y-2 pt-2">
            <button
              id="btn-save-app-lock"
              type="submit"
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4.5 h-4.5" />
              <span>
                {currentConfig && currentConfig.isEnabled
                  ? 'Update Passcode & Protection'
                  : 'Save & Enable App Lock'}
              </span>
            </button>

            {currentConfig && currentConfig.isEnabled && (
              <button
                type="button"
                onClick={() => setMode('view')}
                className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
