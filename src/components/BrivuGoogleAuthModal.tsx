import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Cloud,
  RefreshCw,
  ShieldCheck,
  Mail,
  User as UserIcon,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ActiveScreen, BrivuUser } from '../types';
import { BrivuAuthService } from '../services/brivuAuthService';
import { StorageService } from '../services/storage';

interface BrivuGoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChange: (user: BrivuUser | null) => void;
  onNavigate?: (screen: ActiveScreen) => void;
  initialNotice?: string | null;
}

export const BrivuGoogleAuthModal: React.FC<BrivuGoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onUserChange,
  onNavigate,
  initialNotice = null,
}) => {
  const [user, setUser] = useState<BrivuUser | null>(() => BrivuAuthService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(initialNotice);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showWebFallbackButton, setShowWebFallbackButton] = useState(false);
  const webButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUser(BrivuAuthService.getCurrentUser());
      setError(initialNotice || null);
      setStatusMessage(null);
      setShowWebFallbackButton(!Capacitor.isNativePlatform());
    }
  }, [isOpen, initialNotice]);

  useEffect(() => {
    const handleAuthChanged = (e: any) => {
      const updatedUser = e?.detail ?? BrivuAuthService.getCurrentUser();
      setUser(updatedUser || null);
    };
    window.addEventListener('brivu_auth_changed', handleAuthChanged);
    return () => window.removeEventListener('brivu_auth_changed', handleAuthChanged);
  }, []);

  useEffect(() => {
    if (!isOpen || user || !showWebFallbackButton || Capacitor.isNativePlatform() || !webButtonRef.current) {
      return;
    }
    let active = true;
    BrivuAuthService.renderWebGoogleButton(webButtonRef.current, (res) => {
      if (!active) return;
      setIsLoading(false);
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
  }, [isOpen, user, showWebFallbackButton, onUserChange]);

  const handleContinueWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);
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
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    setError(null);
    setStatusMessage('Syncing user profile, email & data to Cloudflare...');
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
    setIsLoading(true);
    try {
      await BrivuAuthService.signOut();
      setUser(null);
      onUserChange(null);
      onClose();
    } finally {
      setIsLoading(false);
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
        className="w-full max-w-md max-h-[90vh] flex flex-col my-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">Brivu Account</h3>
              <p className="text-[11px] text-slate-300 font-medium">
                Google Verified &amp; Cloudflare Backup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 break-words">{error}</div>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">{statusMessage}</div>
            </div>
          )}

          {user ? (
            <div className="space-y-4">
              {/* Signed In User Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3.5">
                {user.profilePictureUrl ? (
                  <img
                    src={user.profilePictureUrl}
                    alt={user.name || user.email}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-600 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                    <span>{user.name || 'Google User'}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Verified
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.syncedToCloudflare && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
                      <Cloud className="w-3 h-3" />
                      <span>Stored in Cloudflare D1 &amp; Active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing || isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-md shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing with Cloudflare...' : 'Sync Profile & Data Online'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (() => {
            const trialStatus = StorageService.getTrialStatus();
            if (trialStatus.isExpired && !trialStatus.subscribed) {
              return (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 dark:from-rose-950/40 dark:via-amber-950/30 dark:to-orange-950/30 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-500/30">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-rose-950 dark:text-rose-100">
                      7-Day Free Trial Ended
                    </h4>
                    <p className="text-xs text-rose-800/90 dark:text-rose-200/80 leading-relaxed font-medium">
                      Your 7-day free trial has ended. Subscribe to a Pro plan to enable Google Sign-In, automatic Cloudflare backup, and live QR page hosting. Your local data remains completely safe on your device!
                    </p>
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigate('upgrade');
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 transition active:scale-[0.98] cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Subscribe to Pro Plan</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* Info Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Continue with Google
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Choose your Google account right inside Brivu to verify your identity, sync your business profile to Cloudflare, and protect your receipts and QR pages across reinstalls.
                  </p>
                </div>

                {/* Native Continue with Google Button */}
                <button
                  type="button"
                  onClick={handleContinueWithGoogle}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 font-black text-sm flex items-center justify-center gap-3 transition active:scale-[0.98] shadow-md disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Signing in...</span>
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
                    <div ref={webButtonRef} className="min-h-[42px] flex items-center justify-center" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-medium pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Direct Google verification &amp; Brivu-managed sessions</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
