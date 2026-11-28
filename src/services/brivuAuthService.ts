import { Capacitor, registerPlugin } from '@capacitor/core';
import { BrivuAuthSession, BrivuUser, BrivuActiveSessionInfo } from '../types';
import { StorageService, isAdminLifetimeEmail } from './storage';
import { CloudflareService } from './cloudflareService';
import { PlayBillingService } from './playBillingService';

const DEFAULT_SESSION_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

interface NativeGoogleSignInResult {
  success: boolean;
  cancelled?: boolean;
  idToken?: string;
  email?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  profilePictureUrl?: string;
  error?: string;
  errorCode?: string;
}

interface BrivuAuthPluginInterface {
  signInWithGoogle(options: { serverClientId?: string }): Promise<NativeGoogleSignInResult>;
  signOut(): Promise<{ success: boolean }>;
}

const BrivuAuthPlugin = registerPlugin<BrivuAuthPluginInterface>('BrivuAuthPlugin');

const WEB_CLIENT_ID_CACHE_KEY = 'brivu_google_web_client_id';
let cachedWebClientId = '';
let gsiScriptPromise: Promise<void> | null = null;
let lastSessionCheckAt = 0;
let lastUserActivityAt = Date.now();
let sessionValidationInFlight: Promise<{
  valid: boolean;
  expired?: boolean;
  user: BrivuUser | null;
}> | null = null;

function readCachedWebClientId(): string {
  if (cachedWebClientId) return cachedWebClientId;
  if (typeof localStorage === 'undefined') return '';
  try {
    const val = (localStorage.getItem(WEB_CLIENT_ID_CACHE_KEY) || '').trim();
    if (val) cachedWebClientId = val;
    return val;
  } catch {
    return '';
  }
}

function writeCachedWebClientId(value: string): void {
  const clean = (value || '').trim();
  if (!clean) return;
  cachedWebClientId = clean;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(WEB_CLIENT_ID_CACHE_KEY, clean);
    } catch {}
  }
}

function loadGoogleIdentityServicesScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Sign-In requires a browser environment.'));
  }
  if ((window as any).google?.accounts?.id) {
    return Promise.resolve();
  }
  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }
  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-brivu-gsi="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => {
        gsiScriptPromise = null;
        reject(new Error('Failed to load Google Sign-In script.'));
      }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.brivuGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('Unable to load Google Identity Services. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

export interface BrivuSignInResult {
  success: boolean;
  cancelled?: boolean;
  needsWebButtonFallback?: boolean;
  needsPasswordSetup?: boolean;
  alreadyExists?: boolean;
  linkedExistingGoogleAccount?: boolean;
  user?: BrivuUser;
  message?: string;
}

export const BrivuAuthService = {
  async hasAuthAccess(candidateEmail?: string | null): Promise<boolean> {
    if (isAdminLifetimeEmail(candidateEmail) || StorageService.isCurrentUserAdmin()) {
      return true;
    }
    let trial = StorageService.getTrialStatus();
    if (!trial.isExpired || trial.subscribed) {
      return true;
    }
    const synced = await PlayBillingService.syncActiveSubscriptionSilently(true);
    if (synced) {
      trial = StorageService.getTrialStatus();
      return !trial.isExpired || trial.subscribed;
    }
    return false;
  },

  getCurrentUser(): BrivuUser | null {
    return StorageService.getAuthUser();
  },

  getSession(): BrivuAuthSession | null {
    return StorageService.getAuthSession();
  },

  isAuthenticated(): boolean {
    const user = StorageService.getAuthUser();
    const session = StorageService.getAuthSession();
    if (!user || !user.email) return false;
    if (session?.expiresAt && Date.now() > session.expiresAt) return false;
    return true;
  },

  async getGoogleWebClientId(): Promise<string> {
    const warm = readCachedWebClientId();
    const envClientId =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_WEB_CLIENT_ID
        ? String(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID).trim()
        : '';
    const defaultClientId = '97897075021-g672moeae0a7i2834ipcjpot5u7fur8e.apps.googleusercontent.com';
    const immediateClientId = warm || envClientId || defaultClientId;

    if (!warm && immediateClientId) {
      writeCachedWebClientId(immediateClientId);
    }

    // Refresh in background so Worker updates propagate without delaying sign-in taps
    CloudflareService.getAuthConfig()
      .then((cfg) => {
        if (cfg.googleWebClientId && cfg.googleWebClientId.trim()) {
          writeCachedWebClientId(cfg.googleWebClientId);
        }
      })
      .catch(() => {});

    return immediateClientId;
  },

  /**
   * Native Android Credential Manager Sign-In (primary) or Web Google Identity Services ID Token Sign-In.
   * Never uses WorkOS, Firebase Auth, external browsers, or Custom Tabs.
   */
  async signInWithGoogle(): Promise<BrivuSignInResult> {
    const webClientId = await this.getGoogleWebClientId();

    if (Capacitor.isNativePlatform()) {
      let nativeRes: NativeGoogleSignInResult;
      try {
        StorageService.markSystemActionActive(120000);
        nativeRes = await BrivuAuthPlugin.signInWithGoogle({
          serverClientId: webClientId || undefined,
        });
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Native Google sign-in could not be completed.',
        };
      } finally {
        StorageService.consumeSystemActionActive();
      }

      if (nativeRes?.cancelled) {
        return {
          success: false,
          cancelled: true,
        };
      }

      if (!nativeRes?.success || !nativeRes.idToken) {
        return {
          success: false,
          message: nativeRes?.error || 'Could not obtain Google account credential on this device.',
        };
      }

      return await this.completeGoogleIdTokenSignIn(nativeRes.idToken);
    }

    // Web platform: Google Identity Services (returns verifiable OpenID ID token directly)
    if (!webClientId) {
      return {
        success: false,
        message:
          'Google Web Client ID (GOOGLE_WEB_CLIENT_ID) is not configured yet on the Brivu server.',
      };
    }

    try {
      await loadGoogleIdentityServicesScript();
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Could not load Google Sign-In on this browser.',
      };
    }

    const gsi = (window as any).google?.accounts?.id;
    if (!gsi) {
      return {
        success: false,
        message: 'Google Identity Services is unavailable in this browser.',
      };
    }

    return await new Promise<BrivuSignInResult>((resolve) => {
      let settled = false;
      const finish = (result: BrivuSignInResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timeout = setTimeout(() => {
        finish({
          success: false,
          needsWebButtonFallback: true,
          message: 'Use the Google Sign-In button below to choose your account.',
        });
      }, 15000);

      gsi.initialize({
        client_id: webClientId,
        callback: async (response: { credential?: string }) => {
          clearTimeout(timeout);
          if (!response?.credential) {
            finish({ success: false, message: 'No Google credential was returned.' });
            return;
          }
          const verified = await this.completeGoogleIdTokenSignIn(response.credential);
          finish(verified);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
      });

      try {
        gsi.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            clearTimeout(timeout);
            finish({
              success: false,
              needsWebButtonFallback: true,
              message: 'Select your Google account using the Sign in with Google button.',
            });
          } else if (notification?.isDismissedMoment?.()) {
            const reason = notification.getDismissedReason?.();
            if (reason !== 'credential_returned') {
              clearTimeout(timeout);
              finish({ success: false, cancelled: true });
            }
          }
        });
      } catch {
        clearTimeout(timeout);
        finish({
          success: false,
          needsWebButtonFallback: true,
          message: 'Select your Google account using the Sign in with Google button.',
        });
      }
    });
  },

  /**
   * Renders Google's official Web button when browser One Tap prompt is skipped/suppressed.
   */
  async renderWebGoogleButton(
    container: HTMLElement,
    onResult: (result: BrivuSignInResult) => void
  ): Promise<{ rendered: boolean; error?: string }> {
    if (Capacitor.isNativePlatform()) {
      return { rendered: false };
    }
    const webClientId = await this.getGoogleWebClientId();
    if (!webClientId) {
      return {
        rendered: false,
        error: 'Google Web Client ID (GOOGLE_WEB_CLIENT_ID) is not configured yet.',
      };
    }

    try {
      await loadGoogleIdentityServicesScript();
      const gsi = (window as any).google?.accounts?.id;
      if (!gsi) {
        return { rendered: false, error: 'Google Sign-In script unavailable.' };
      }

      container.innerHTML = '';
      gsi.initialize({
        client_id: webClientId,
        callback: async (response: { credential?: string }) => {
          if (!response?.credential) {
            onResult({ success: false, message: 'No Google credential was returned.' });
            return;
          }
          const res = await this.completeGoogleIdTokenSignIn(response.credential);
          onResult(res);
        },
        auto_select: false,
        context: 'signin',
      });

      gsi.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: Math.min(container.clientWidth || 320, 360),
      });
      return { rendered: true };
    } catch (err: any) {
      return {
        rendered: false,
        error: err?.message || 'Unable to render Google Sign-In button.',
      };
    }
  },

  /**
   * Sends Google ID token to Brivu backend for cryptographic verification,
   * establishes Brivu session & workspace, pulls cloud backup, and syncs profile.
   */
  async completeGoogleIdTokenSignIn(idToken: string): Promise<BrivuSignInResult> {
    const authRes = await CloudflareService.authenticateWithGoogleIdToken(idToken);
    if (!authRes.success || !authRes.user || !authRes.sessionToken) {
      return {
        success: false,
        message: authRes.message || 'Could not verify your Google account.',
      };
    }

    const hasAccess =
      isAdminLifetimeEmail(authRes.user.email) ||
      Boolean(authRes.user.trialInfo?.isSubscribed) ||
      (await this.hasAuthAccess(authRes.user.email));
    if (!hasAccess) {
      return {
        success: false,
        message: 'Your 7-day free trial has ended. Subscribe to Basic to sign in and sync with Cloudflare.',
      };
    }

    const session: BrivuAuthSession = {
      sessionToken: authRes.sessionToken,
      sessionId: authRes.sessionId,
      expiresAt: authRes.expiresAt || Date.now() + DEFAULT_SESSION_INACTIVITY_MS,
      userEmail: authRes.user.email,
    };

    const user = await this.saveAndSyncUser(authRes.user, session);
    return {
      success: true,
      user,
      message: `Signed in as ${user.name || user.email}`,
    };
  },

  /**
   * Create a new email/password account OR add password login to an existing Google account under the same email.
   */
  async registerWithEmailPassword(
    email: string,
    password: string,
    name?: string
  ): Promise<BrivuSignInResult> {
    if (!(await this.hasAuthAccess(email))) {
      return {
        success: false,
        message: 'Your 7-day free trial has ended. Subscribe to Basic to sign in and sync with Cloudflare.',
      };
    }

    const res = await CloudflareService.registerWithEmailPassword(email, password, name);
    if (!res.success || !res.user || !res.sessionToken) {
      return {
        success: false,
        alreadyExists: res.alreadyExists,
        message: res.message || 'Could not create account.',
      };
    }

    const session: BrivuAuthSession = {
      sessionToken: res.sessionToken,
      sessionId: res.sessionId,
      expiresAt: res.expiresAt || Date.now() + DEFAULT_SESSION_INACTIVITY_MS,
      userEmail: res.user.email,
    };

    const user = await this.saveAndSyncUser(res.user, session);
    return {
      success: true,
      user,
      linkedExistingGoogleAccount: res.linkedExistingGoogleAccount,
      message:
        res.message ||
        (res.linkedExistingGoogleAccount
          ? `Password linked to ${user.email}. All your Google data is ready!`
          : `Signed in as ${user.name || user.email}`),
    };
  },

  /**
   * Sign in with email and password (shares identical workspace & cloud data with Google login for the same email).
   */
  async loginWithEmailPassword(email: string, password: string): Promise<BrivuSignInResult> {
    if (!(await this.hasAuthAccess(email))) {
      return {
        success: false,
        message: 'Your 7-day free trial has ended. Subscribe to Basic to sign in and sync with Cloudflare.',
      };
    }

    const res = await CloudflareService.loginWithEmailPassword(email, password);
    if (!res.success || !res.user || !res.sessionToken) {
      return {
        success: false,
        needsPasswordSetup: res.needsPasswordSetup,
        message: res.message || 'Invalid email or password.',
      };
    }

    const session: BrivuAuthSession = {
      sessionToken: res.sessionToken,
      sessionId: res.sessionId,
      expiresAt: res.expiresAt || Date.now() + DEFAULT_SESSION_INACTIVITY_MS,
      userEmail: res.user.email,
    };

    const user = await this.saveAndSyncUser(res.user, session);
    return {
      success: true,
      user,
      message: `Signed in as ${user.name || user.email}`,
    };
  },

  /**
   * Allows an already signed-in user to add or change a backup password for their account email.
   */
  async setAccountPassword(password: string): Promise<{ success: boolean; user?: BrivuUser; message: string }> {
    const session = StorageService.getAuthSession();
    const currentUser = StorageService.getAuthUser();
    if (!session?.sessionToken || !currentUser) {
      return { success: false, message: 'Please sign in first to save a backup password.' };
    }

    const res = await CloudflareService.setAccountPassword(password, session.sessionToken);
    if (res.success) {
      const updatedUser: BrivuUser = {
        ...currentUser,
        ...res.user,
        hasPassword: true,
      };
      StorageService.saveAuthUser(updatedUser);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brivu_auth_changed', { detail: updatedUser }));
      }
      return {
        success: true,
        user: updatedUser,
        message: res.message || 'Backup password saved!',
      };
    }
    return {
      success: false,
      message: res.message || 'Could not save backup password.',
    };
  },

  async saveAndSyncUser(user: BrivuUser, session?: BrivuAuthSession): Promise<BrivuUser> {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const cleanUser: BrivuUser = {
      ...user,
      email: cleanEmail,
      id: user.id || cleanEmail,
      provider: user.provider || 'google',
    };

    if (cleanEmail) {
      StorageService.switchUserSession(cleanEmail);
    }

    StorageService.saveAuthUser(cleanUser);
    if (session) {
      StorageService.saveAuthSession(session);
      lastSessionCheckAt = Date.now();
    }

    if (cleanEmail) {
      const profile = StorageService.getProfile();
      if (!profile.email || profile.email !== cleanEmail) {
        StorageService.saveProfile({
          ...profile,
          email: cleanEmail,
          name: profile.name || cleanUser.name || cleanEmail.split('@')[0],
        });
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brivu_auth_changed', { detail: cleanUser }));
      window.dispatchEvent(new CustomEvent('brivu_data_refreshed'));
      window.dispatchEvent(new CustomEvent('brivu_data_restored'));
    }

    // Run Play Billing + Cloudflare subscription verification BEFORE cloud restore/purge on login
    if (cleanEmail) {
      setTimeout(() => {
        void (async () => {
          const playCheck = await PlayBillingService.verifyAndSyncSubscriptionSilently(true).catch(() => ({
            active: StorageService.isSubscribed(),
            verifiedFromPlay: false,
          }));
          const syncSubRes = await CloudflareService.syncSubscriptionStatusToCloud({
            playVerifiedNoPurchase: playCheck.verifiedFromPlay && !playCheck.active,
          }).catch(() => null);

          const latestTrial = StorageService.getTrialStatus();
          const confirmedSubscribed = Boolean(
            playCheck.active ||
              latestTrial.subscribed ||
              syncSubRes?.isSubscribed ||
              syncSubRes?.trialInfo?.isSubscribed
          );

          const isGraceOver = Boolean(
            !confirmedSubscribed &&
              syncSubRes?.success === true &&
              syncSubRes?.gracePeriodExpired === true
          );

          if (isGraceOver) {
            await StorageService.purgeAllCloudData().catch(() => {});
            return;
          }

          try {
            const pullRes = await CloudflareService.pullFromCloudflare(cleanEmail);
            if (pullRes.success && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('brivu_data_refreshed'));
              window.dispatchEvent(new CustomEvent('brivu_data_restored'));
            }
          } catch (pullErr) {
            console.warn('Background cloud restore note on login:', pullErr);
          }

          if (!latestTrial.isExpired || confirmedSubscribed) {
            try {
              const syncRes = await CloudflareService.syncUserProfile(cleanUser, StorageService.getProfile());
              if (syncRes.success) {
                const finalUser: BrivuUser = {
                  ...cleanUser,
                  syncedToCloudflare: true,
                  cloudflareStoredAt: new Date().toISOString(),
                };
                StorageService.saveAuthUser(finalUser);
                CloudflareService.syncAllToCloudflare().catch(() => {});
              }
            } catch {}
          }
        })();
      }, 50);
    }

    return cleanUser;
  },

  recordUserActivity(): void {
    lastUserActivityAt = Date.now();
  },

  /**
   * Checks Brivu session validity & sliding inactivity renewal without disrupting offline usage
   * or accidentally logging out sessions that are still valid on the server.
   */
  async validateSession(forceRemote = false): Promise<{
    valid: boolean;
    expired?: boolean;
    user: BrivuUser | null;
  }> {
    if (sessionValidationInFlight && !forceRemote) {
      return sessionValidationInFlight;
    }

    const runCheck = async (): Promise<{
      valid: boolean;
      expired?: boolean;
      user: BrivuUser | null;
    }> => {
      const user = StorageService.getAuthUser();
      const session = StorageService.getAuthSession();

      if (!session || !session.sessionToken) {
        return { valid: Boolean(user?.email), user };
      }

      const now = Date.now();
      const isLocallyPastExpiry = Boolean(session.expiresAt && now > session.expiresAt);
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      if (isOffline) {
        if (isLocallyPastExpiry) {
          await this.signOut({ skipRemote: true, reason: 'expired' });
          return { valid: false, expired: true, user: null };
        }
        return { valid: Boolean(user?.email), user };
      }

      if (!forceRemote && !isLocallyPastExpiry && now - lastSessionCheckAt < 5 * 60 * 1000) {
        return { valid: Boolean(user?.email), user };
      }

      lastSessionCheckAt = now;
      const remote = await CloudflareService.validateBrivuSession(session.sessionToken);

      if (remote.valid && remote.user) {
        const mergedUser: BrivuUser = {
          ...user,
          ...remote.user,
          syncedToCloudflare: true,
        };
        StorageService.saveAuthUser(mergedUser);
        StorageService.saveAuthSession({
          ...session,
          sessionId: remote.sessionId || session.sessionId,
          expiresAt: remote.expiresAt || Date.now() + DEFAULT_SESSION_INACTIVITY_MS,
          userEmail: mergedUser.email,
        });
        return { valid: true, user: mergedUser };
      }

      if (remote.expired) {
        await this.signOut({ skipRemote: true, reason: 'expired' });
        return { valid: false, expired: true, user: null };
      }

      // Offline / transient server issue -> keep local session intact unless already locally expired
      if (isLocallyPastExpiry) {
        await this.signOut({ skipRemote: true, reason: 'expired' });
        return { valid: false, expired: true, user: null };
      }
      return { valid: Boolean(user?.email), user };
    };

    const promise = runCheck().finally(() => {
      if (sessionValidationInFlight === promise) {
        sessionValidationInFlight = null;
      }
    });
    sessionValidationInFlight = promise;
    return promise;
  },

  startSessionMonitor(): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return () => {};
    }

    const markActivity = () => {
      lastUserActivityAt = Date.now();
    };

    const handleRemoteExpired = () => {
      void this.validateSession(true).catch(() => {});
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastUserActivityAt = Date.now();
        void this.validateSession(false).catch(() => {});
      }
    };

    const intervalId = window.setInterval(() => {
      const session = StorageService.getAuthSession();
      if (!session?.sessionToken) return;
      const now = Date.now();
      const recentlyActive = now - lastUserActivityAt < 12 * 60 * 1000;
      const approachingLocalExpiry = Boolean(session.expiresAt && session.expiresAt - now < 24 * 60 * 60 * 1000);
      if (document.visibilityState === 'visible' && (recentlyActive || approachingLocalExpiry)) {
        void this.validateSession(false).catch(() => {});
      }
    }, 10 * 60 * 1000);

    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('brivu_session_expired_remote', handleRemoteExpired);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('brivu_session_expired_remote', handleRemoteExpired);
    };
  },

  async syncUserData(): Promise<{ success: boolean; message: string }> {
    const user = this.getCurrentUser();
    if (!user) {
      return { success: false, message: 'No signed-in user to sync' };
    }
    if (!(await this.hasAuthAccess())) {
      return {
        success: false,
        message: 'Your 7-day free trial has ended. Subscribe to Basic to resume automatic cloud sync!',
      };
    }
    const profileRes = await CloudflareService.syncUserProfile(user, StorageService.getProfile());
    const dataRes = await CloudflareService.syncAllToCloudflare();

    if (profileRes.success || dataRes.success) {
      const updated = {
        ...user,
        syncedToCloudflare: true,
        cloudflareStoredAt: new Date().toISOString(),
      };
      StorageService.saveAuthUser(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brivu_auth_changed', { detail: updated }));
      }
      return {
        success: true,
        message: 'Profile & all app data securely synced online!',
      };
    }

    return {
      success: false,
      message: profileRes.message || dataRes.message || 'Cloud sync encountered an issue',
    };
  },

  async getActiveSessions(): Promise<{
    success: boolean;
    sessions: BrivuActiveSessionInfo[];
    message?: string;
  }> {
    const session = StorageService.getAuthSession();
    if (!session?.sessionToken) {
      return { success: false, sessions: [], message: 'Sign in to view active devices.' };
    }
    return CloudflareService.listActiveSessions(session.sessionToken);
  },

  async revokeDeviceSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
    const session = StorageService.getAuthSession();
    if (!session?.sessionToken) {
      return { success: false, message: 'No active session.' };
    }
    const res = await CloudflareService.revokeSessionById(session.sessionToken, sessionId);
    if (res.success && res.isCurrent) {
      await this.signOut({ skipRemote: true, reason: 'manual' });
    }
    return { success: res.success, message: res.message };
  },

  async signOutOtherDevices(): Promise<{ success: boolean; revokedCount: number }> {
    const session = StorageService.getAuthSession();
    if (!session?.sessionToken) {
      return { success: false, revokedCount: 0 };
    }
    const res = await CloudflareService.logoutBrivuSession(session.sessionToken, { allOtherDevices: true });
    return { success: res.ok, revokedCount: res.revokedCount || 0 };
  },

  async signOut(options?: { skipRemote?: boolean; reason?: 'manual' | 'expired' }): Promise<void> {
    const session = StorageService.getAuthSession();
    const sessionToken = session?.sessionToken;
    lastSessionCheckAt = 0;

    // Clear local session and update UI immediately so sign-out feels instant
    StorageService.clearAuthUser();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brivu_auth_changed', { detail: null }));
      window.dispatchEvent(new CustomEvent('brivu_data_refreshed'));
      if (options?.reason === 'expired') {
        window.dispatchEvent(
          new CustomEvent('brivu_auth_expired', {
            detail: { message: 'Your Brivu session expired after inactivity. Please sign in again.' },
          })
        );
      }
    }

    // Immediately invalidate server session (awaited with keepalive so reloads never drop it)
    if (!options?.skipRemote && sessionToken) {
      await CloudflareService.logoutBrivuSession(sessionToken).catch(() => {});
    }

    if (Capacitor.isNativePlatform()) {
      void BrivuAuthPlugin.signOut().catch(() => {});
    } else if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.disableAutoSelect();
      } catch {}
    }
  },
};
