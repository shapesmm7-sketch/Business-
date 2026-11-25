import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Mail,
  User as UserIcon,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ActiveScreen, BrivuUser } from '../types';
import { BrivuAuthService } from '../services/brivuAuthService';
import { StorageService } from '../services/storage';
import { PlayBillingService } from '../services/playBillingService';

interface BrivuGoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChange: (user: BrivuUser | null) => void;
  onNavigate?: (screen: ActiveScreen) => void;
  initialNotice?: string | null;
}

type AuthTabMode = 'login' | 'signup';

export const BrivuGoogleAuthModal: React.FC<BrivuGoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onUserChange,
  onNavigate,
  initialNotice = null,
}) => {
  const [user, setUser] = useState<BrivuUser | null>(() => BrivuAuthService.getCurrentUser());
  const [authTab, setAuthTab] = useState<AuthTabMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [error, setError] = useState<string | null>(initialNotice);
  const [needsPasswordSetupEmail, setNeedsPasswordSetupEmail] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showWebFallbackButton, setShowWebFallbackButton] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [trialStatus, setTrialStatus] = useState(() => StorageService.getTrialStatus());
  const [isRestoringPlay, setIsRestoringPlay] = useState(false);
  const [showExpiredSignIn, setShowExpiredSignIn] = useState(false);

  // Signed-in backup password state
  const [isSettingBackupPassword, setIsSettingBackupPassword] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [isSavingBackupPassword, setIsSavingBackupPassword] = useState(false);

  const webButtonRef = useRef<HTMLDivElement | null>(null);
  const isBusy = isEmailLoading || isGoogleLoading || isSyncing || isSavingBackupPassword || isRestoringPlay;

  useEffect(() => {
    if (isOpen) {
      setUser(BrivuAuthService.getCurrentUser());
      const latestTrial = StorageService.getTrialStatus();
      setTrialStatus(latestTrial);
      setError(initialNotice || null);
      setStatusMessage(null);
      setNeedsPasswordSetupEmail(null);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setBackupPassword('');
      setIsSettingBackupPassword(false);
      setImgError(false);
      setShowExpiredSignIn(false);
      setShowWebFallbackButton(!Capacitor.isNativePlatform());

      if (latestTrial.isExpired && !latestTrial.subscribed && PlayBillingService.isAndroid()) {
        PlayBillingService.syncActiveSubscriptionSilently(true)
          .then((restored) => {
            if (restored) {
              setTrialStatus(StorageService.getTrialStatus());
              setStatusMessage('Active Google Play Pro subscription verified!');
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, initialNotice]);

  useEffect(() => {
    setImgError(false);
  }, [user?.profilePictureUrl]);

  useEffect(() => {
    const handleAuthChanged = (e: any) => {
      const updatedUser = e?.detail ?? BrivuAuthService.getCurrentUser();
      setUser(updatedUser || null);
    };
    const handleSubscriptionOrRefresh = () => {
      setTrialStatus(StorageService.getTrialStatus());
    };
    window.addEventListener('brivu_auth_changed', handleAuthChanged);
    window.addEventListener('brivu_subscription_changed', handleSubscriptionOrRefresh);
    window.addEventListener('brivu_data_refreshed', handleSubscriptionOrRefresh);
    window.addEventListener('storage', handleSubscriptionOrRefresh);
    return () => {
      window.removeEventListener('brivu_auth_changed', handleAuthChanged);
      window.removeEventListener('brivu_subscription_changed', handleSubscriptionOrRefresh);
      window.removeEventListener('brivu_data_refreshed', handleSubscriptionOrRefresh);
      window.removeEventListener('storage', handleSubscriptionOrRefresh);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || user || !showWebFallbackButton || Capacitor.isNativePlatform() || !webButtonRef.current) {
      return;
    }
    let active = true;
    BrivuAuthService.renderWebGoogleButton(webButtonRef.current, (res) => {
      if (!active) return;
      setIsGoogleLoading(false);
      if (res.success && res.user) {
        setUser(res.user);
        setStatusMessage(res.message || 'Signed in with Google.');
        onUserChange(res.user);
      } else if (!res.cancelled && res.message) {
        setError(res.message);
      }
    }).then((renderRes) => {
      if (!active) return;
      if (!renderRes.rendered && renderRes.error) {
        setShowWebFallbackButton(false);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, user, showWebFallbackButton, showExpiredSignIn, onUserChange]);

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (authTab === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (confirmPassword !== password) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsEmailLoading(true);
    setError(null);
    setStatusMessage(null);
    setNeedsPasswordSetupEmail(null);

    try {
      const res =
        authTab === 'signup'
          ? await BrivuAuthService.registerWithEmailPassword(cleanEmail, password, fullName.trim() || undefined)
          : await BrivuAuthService.loginWithEmailPassword(cleanEmail, password);

      if (res.success && res.user) {
        setUser(res.user);
        onUserChange(res.user);
        setStatusMessage(res.message || 'Signed in successfully!');
        onClose();
      } else if (res.needsPasswordSetup) {
        setNeedsPasswordSetupEmail(cleanEmail);
        setError(res.message || 'This email was created with Google Login and has no password yet.');
      } else if (res.alreadyExists) {
        setError(res.message || 'An account with this email already exists.');
        setAuthTab('login');
      } else {
        setError(res.message || (authTab === 'signup' ? 'Could not create account.' : 'Invalid email or password.'));
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to complete authentication.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    if (isBusy) return;
    setIsGoogleLoading(true);
    setError(null);
    setStatusMessage(null);
    setNeedsPasswordSetupEmail(null);
    try {
      const res = await BrivuAuthService.signInWithGoogle();
      if (res.success && res.user) {
        setUser(res.user);
        onUserChange(res.user);
        setStatusMessage(res.message || 'Signed in with Google successfully!');
        onClose();
      } else if (res.cancelled) {
        setStatusMessage(null);
      } else if (res.needsWebButtonFallback) {
        setShowWebFallbackButton(true);
        setError(res.message || 'Use the Google Sign-In button below to select your account.');
      } else {
        setError(res.message || 'Could not complete Google Sign-In.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error starting Google Sign-In');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSaveBackupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isBusy) return;
    if (backupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setIsSavingBackupPassword(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await BrivuAuthService.setAccountPassword(backupPassword);
      if (res.success) {
        if (res.user) {
          setUser(res.user);
          onUserChange(res.user);
        }
        setBackupPassword('');
        setIsSettingBackupPassword(false);
        setStatusMessage(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not save backup password.');
    } finally {
      setIsSavingBackupPassword(false);
    }
  };

  const handleManualSync = async () => {
    if (!user || isBusy) return;
    setIsSyncing(true);
    setError(null);
    setStatusMessage('Syncing user profile, email & data online...');
    try {
      const res = await BrivuAuthService.syncUserData();
      if (res.success) {
        const refreshed = BrivuAuthService.getCurrentUser();
        setUser(refreshed);
        onUserChange(refreshed);
        setStatusMessage(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Sync error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    setIsGoogleLoading(true);
    try {
      await BrivuAuthService.signOut();
      setUser(null);
      onUserChange(null);
      onClose();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[999999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] flex flex-col my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">Brivu Account</h3>
              <p className="text-[11px] text-slate-300 font-medium">
                {user
                  ? 'Account & Cloud Backup'
                  : authTab === 'signup'
                  ? 'Create account or link Google email'
                  : 'Sign in with Email or Google'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 -mr-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 space-y-2 text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="flex-1 break-words leading-relaxed">{error}</div>
              </div>
              {needsPasswordSetupEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setEmail(needsPasswordSetupEmail);
                    setAuthTab('signup');
                    setError(null);
                    setNeedsPasswordSetupEmail(null);
                    setStatusMessage(
                      `Enter a new password for ${needsPasswordSetupEmail} to unlock Email & Password login with all your existing Google data.`
                    );
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  Set Password for {needsPasswordSetupEmail}
                </button>
              )}
            </div>
          )}

          {statusMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1 leading-relaxed">{statusMessage}</div>
            </div>
          )}

          {user ? (
            <div className="space-y-4">
              {/* Signed In User Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3.5">
                {user.profilePictureUrl && !imgError ? (
                  <img
                    src={user.profilePictureUrl}
                    alt={user.name || user.email}
                    onError={() => setImgError(true)}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-600 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {user.name || user.email.split('@')[0] || 'Brivu User'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    {user.hasPassword && user.hasGoogleLinked
                      ? 'Google & Password access linked'
                      : user.provider === 'email' || user.hasPassword
                      ? 'Email & Password active'
                      : 'Google account active'}
                  </div>
                </div>
              </div>

              {/* Optional Backup Password Manager */}
              {isSettingBackupPassword ? (
                <form
                  onSubmit={handleSaveBackupPassword}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {user.hasPassword ? 'Update Backup Password' : 'Add Backup Password'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingBackupPassword(false);
                        setBackupPassword('');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sign in using {user.email} and this password anytime—all your data remains linked under this email.
                  </p>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showBackupPassword ? 'text' : 'password'}
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      minLength={6}
                      maxLength={128}
                      required
                      className="w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBackupPassword(!showBackupPassword)}
                      aria-label={showBackupPassword ? 'Hide password' : 'Show password'}
                      className="w-10 h-10 absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showBackupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingBackupPassword}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-bold text-xs transition disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingBackupPassword ? 'Saving Password...' : 'Save Password'}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStatusMessage(null);
                    setIsSettingBackupPassword(true);
                  }}
                  disabled={isBusy}
                  className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{user.hasPassword ? 'Change Backup Password' : 'Add Backup Password for Email Login'}</span>
                </button>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isBusy}
                  className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-md shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing online...' : 'Sync Profile & Data Online'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isBusy}
                  className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : trialStatus.isExpired && !trialStatus.subscribed && !showExpiredSignIn ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-500/30">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-rose-950 dark:text-rose-100">
                      7-Day Free Trial Ended
                    </h4>
                    <p className="text-xs text-rose-800/90 dark:text-rose-200/80 leading-relaxed font-medium">
                      Your 7-day free trial has ended. Subscribe to a Pro plan to enable Account Sign-In, automatic cloud backup, and live QR page hosting. Your local data remains completely safe on your device!
                    </p>
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigate('upgrade');
                      }}
                      className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 transition active:scale-[0.98] cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Subscribe to Pro Plan</span>
                    </button>
                  )}

                  {PlayBillingService.isAndroid() && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        setIsRestoringPlay(true);
                        setError(null);
                        setStatusMessage(null);
                        try {
                          const res = await PlayBillingService.restorePurchases();
                          setTrialStatus(StorageService.getTrialStatus());
                          if (res.restored) {
                            setStatusMessage(res.message);
                          } else {
                            setError(res.message);
                          }
                        } finally {
                          setIsRestoringPlay(false);
                        }
                      }}
                      className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRestoringPlay ? 'animate-spin' : ''}`} />
                      <span>{isRestoringPlay ? 'Checking Google Play...' : 'Already Subscribed? Restore Purchase'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setError(null);
                      setStatusMessage(null);
                      setShowExpiredSignIn(true);
                    }}
                    className="w-full min-h-[42px] py-2.5 px-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                  >
                    <span>Admin / Existing Pro Account Sign In</span>
                  </button>
                </div>
          ) : (
              <div className="space-y-4">
                {trialStatus.isExpired && !trialStatus.subscribed && showExpiredSignIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStatusMessage(null);
                      setShowExpiredSignIn(false);
                    }}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    &larr; Back
                  </button>
                )}
                {/* Segmented Login / Create Account Tabs */}
                <div
                  role="tablist"
                  aria-label="Authentication mode"
                  className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authTab === 'login'}
                    onClick={() => {
                      setAuthTab('login');
                      setError(null);
                      setNeedsPasswordSetupEmail(null);
                    }}
                    className={`min-h-[44px] rounded-xl text-xs font-black transition cursor-pointer ${
                      authTab === 'login'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authTab === 'signup'}
                    onClick={() => {
                      setAuthTab('signup');
                      setError(null);
                      setNeedsPasswordSetupEmail(null);
                    }}
                    className={`min-h-[44px] rounded-xl text-xs font-black transition cursor-pointer ${
                      authTab === 'signup'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Email & Password Form */}
                <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
                  {authTab === 'signup' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        Full Name / Business Name (optional)
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Jane Doe"
                          maxLength={120}
                          autoComplete="name"
                          className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={authTab === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                        required
                        minLength={authTab === 'signup' ? 6 : 1}
                        maxLength={128}
                        autoComplete={authTab === 'signup' ? 'new-password' : 'current-password'}
                        className="w-full min-h-[46px] pl-10 pr-11 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="w-10 h-10 absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {authTab === 'signup' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          required
                          minLength={6}
                          maxLength={128}
                          autoComplete="new-password"
                          className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {authTab === 'signup' && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed px-0.5">
                      Already used Google Login before? Creating an account with that same Google email keeps all your existing receipts, inventory &amp; QR data linked together.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-md shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
                  >
                    {isEmailLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{authTab === 'signup' ? 'Creating Account...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <span>{authTab === 'signup' ? 'Create Account' : 'Sign In with Email'}</span>
                    )}
                  </button>
                </form>

                {/* Hairline Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    or
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>

                {/* Continue with Google Button */}
                <button
                  type="button"
                  onClick={handleContinueWithGoogle}
                  disabled={isBusy}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 font-black text-sm flex items-center justify-center gap-3 transition active:scale-[0.98] shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {isGoogleLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Connecting Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {!Capacitor.isNativePlatform() && showWebFallbackButton && (
                  <div className="pt-1 flex flex-col items-center">
                    <div ref={webButtonRef} className="min-h-[44px] flex items-center justify-center" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>One unified account &amp; backup per email address</span>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

