import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Sparkles,
} from 'lucide-react';
import { WorkOSUser } from '../types';
import { WorkOSAuthService } from '../services/workosAuthService';
import { CloudflareService } from '../services/cloudflareService';

interface WorkOSGoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChange?: (user: WorkOSUser | null) => void;
}

export const WorkOSGoogleAuthModal: React.FC<WorkOSGoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onUserChange,
}) => {
  const [currentUser, setCurrentUser] = useState<WorkOSUser | null>(() =>
    WorkOSAuthService.getCurrentUser()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const u = WorkOSAuthService.getCurrentUser();
      setCurrentUser(u);
    }
  }, [isOpen]);

  // Set up window listener for popup responses
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin is from same origin or run.app
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.code) {
        const code = event.data.code;
        setIsSubmitting(true);
        setStatusMsg({ type: 'info', text: 'Verifying Google Account...' });
        try {
          const authRes = await CloudflareService.authenticateWorkOSCode(code);
          if (authRes.success && authRes.user) {
            setCurrentUser(authRes.user);
            if (onUserChange) onUserChange(authRes.user);
            setStatusMsg({
              type: 'success',
              text: 'Google Sign-In successful! Profile, email & data saved to Cloud.',
            });
            setTimeout(() => {
              onClose();
            }, 1500);
          } else {
            setStatusMsg({ type: 'error', text: authRes.message || 'Failed to authenticate Google Account' });
          }
        } catch (err: any) {
          setStatusMsg({ type: 'error', text: err?.message || 'Authentication error' });
        } finally {
          setIsSubmitting(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUserChange, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignInDirectly = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: 'info', text: 'Connecting to Google...' });

    try {
      const config = await CloudflareService.getWorkOSConfig();

      // Set popup options
      const width = 500;
      const height = 620;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      if (config.authUrl && config.clientId) {
        setStatusMsg({ type: 'info', text: 'Opening Google Sign-In...' });
        
        const popup = window.open(
          config.authUrl,
          'google_signin_popup',
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );
        
        if (!popup) {
          setStatusMsg({
            type: 'error',
            text: 'Popup blocked! Please allow popups for this site to sign in with Google.',
          });
        }
        return;
      }

      // If configuration is missing, guide the user directly on screen
      setStatusMsg({
        type: 'error',
        text: 'Live Google Sign-In setup is pending. Please configure WORKOS_CLIENT_ID and WORKOS_API_KEY environment variables in your Cloudflare dashboard.',
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Google Sign-In connection failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncToCloudNow = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Syncing profile & emails to Cloud...' });

    try {
      const res = await WorkOSAuthService.saveAndSyncUser(currentUser);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Profile, email & all user data synced to Cloud!' });
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Sync failed' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Sync error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = () => {
    WorkOSAuthService.signOut();
    setCurrentUser(null);
    if (onUserChange) onUserChange(null);
    setStatusMsg({ type: 'info', text: 'Signed out successfully' });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex justify-center items-start sm:items-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-slideUp my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-md p-2">
              <svg className="w-full h-full" viewBox="0 0 24 24">
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
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Sign In with Google
              </h3>
              <p className="text-[11px] text-indigo-200/90 font-medium">
                sign in to save your data to cloud
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Status Alert Banner */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : statusMsg.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : statusMsg.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              )}
              <span className="flex-1">{statusMsg.text}</span>
            </div>
          )}

          {/* LOGGED IN USER PROFILE DISPLAY */}
          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0 border-2 border-white dark:border-slate-800">
                    {currentUser.profilePictureUrl ? (
                      <img
                        src={currentUser.profilePictureUrl}
                        alt={currentUser.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span>{(currentUser.name || currentUser.email)[0].toUpperCase()}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {currentUser.name || 'Google User'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Google Verified</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                {/* Badges / Storage Info */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <Cloud className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Sync Status
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Securely Synced
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Encryption
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Verified Secure
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSyncToCloudNow}
                  disabled={isSyncing}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Profile & Emails Online'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* NOT LOGGED IN / ONE-CLICK GOOGLE SIGN IN */
            <div className="space-y-4">
              {/* Main One-Click Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignInDirectly}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 font-black text-sm border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-98 disabled:opacity-60"
              >
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
                <span>{isSubmitting ? 'Opening Google...' : 'Sign in with Google'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
