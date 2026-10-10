import { Browser } from '@capacitor/browser';
import { WorkOSUser, CloudflareSyncResponse } from '../types';
import { StorageService } from './storage';
import { CloudflareService } from './cloudflareService';

/**
 * Generate cryptographically secure PKCE code verifier and challenge (RFC 7636)
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  let binary = '';
  for (let i = 0; i < array.byteLength; i++) {
    binary += String.fromCharCode(array[i]);
  }
  const codeVerifier = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const digestArray = new Uint8Array(digest);
  let digestBinary = '';
  for (let i = 0; i < digestArray.byteLength; i++) {
    digestBinary += String.fromCharCode(digestArray[i]);
  }
  const codeChallenge = btoa(digestBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return { codeVerifier, codeChallenge };
}

// Lock & cache to prevent duplicate OAuth code exchange calls
let inFlightExchangePromise: Promise<WorkOSUser | null> | null = null;
const exchangedCodes = new Set<string>();

export const WorkOSAuthService = {
  /**
   * Returns current authenticated WorkOS User from storage
   */
  getCurrentUser(): WorkOSUser | null {
    return StorageService.getWorkOSUser();
  },

  /**
   * Centralized, deduplicated code exchange to authenticate and log in with zero delay
   */
  async authenticateCode(code: string, codeVerifier?: string): Promise<{ success: boolean; user?: WorkOSUser; message?: string }> {
    if (!code) {
      return { success: false, message: 'No authorization code provided' };
    }

    const trial = StorageService.getTrialStatus();
    if (trial.isExpired && !trial.subscribed) {
      return { success: false, message: 'Trial expired. Please upgrade to Pro.' };
    }

    if (exchangedCodes.has(code)) {
      const existing = StorageService.getWorkOSUser();
      if (existing) {
        return { success: true, user: existing, message: 'Already signed in' };
      }
    }

    if (inFlightExchangePromise) {
      const u = await inFlightExchangePromise;
      if (u) {
        return { success: true, user: u, message: 'Signed in successfully' };
      }
    }

    exchangedCodes.add(code);
    const verifier = codeVerifier || (typeof window !== 'undefined' ? localStorage.getItem('workos_pkce_verifier') || sessionStorage.getItem('workos_pkce_verifier') || undefined : undefined);

    inFlightExchangePromise = (async () => {
      try {
        const authRes = await CloudflareService.authenticateWorkOSCode(code, undefined, verifier);
        if (authRes.success && authRes.user) {
          await this.saveAndSyncUser(authRes.user);
          return authRes.user;
        }
      } catch (err) {
        console.warn('OAuth code exchange error:', err);
      } finally {
        inFlightExchangePromise = null;
      }
      return null;
    })();

    const user = await inFlightExchangePromise;
    if (user) {
      return { success: true, user, message: 'Google Sign-In successful!' };
    }
    return { success: false, message: 'Failed to complete sign-in. Please try again.' };
  },

  /**
   * Save user session locally & sync user profile, email & data to Cloudflare.
   * Broadcasts login immediately so user logs in with zero delay!
   */
  async saveAndSyncUser(user: WorkOSUser): Promise<CloudflareSyncResponse> {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const updatedUser: WorkOSUser = {
      ...user,
      id: cleanEmail || user.id,
      email: cleanEmail,
      provider: 'google',
      updatedAt: new Date().toISOString(),
      syncedToCloudflare: true,
    };

    // 1. Save in local storage immediately with email as User ID
    StorageService.saveWorkOSUser(updatedUser);

    // 2. If business email is empty, prefill with user email
    const profile = StorageService.getProfile();
    if (!profile.email && cleanEmail) {
      StorageService.saveProfile({
        ...profile,
        email: cleanEmail,
      });
    }

    // 3. BROADCAST USER UPDATE IMMEDIATELY so the user logs in and sees the welcome message instantly!
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workos_user_updated', { detail: updatedUser }));
    }

    // 4. Run cloud restoration & sync in background without blocking or delaying login!
    const runBackgroundSync = async () => {
      let cloudRestored = false;
      if (cleanEmail) {
        try {
          const pullRes = await CloudflareService.pullFromCloudflare(cleanEmail);
          if (pullRes.success) {
            cloudRestored = true;
            // Notify UI to refresh restored receipts and products
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('workos_user_updated', { detail: updatedUser }));
            }
          }
        } catch (pullErr) {
          console.warn('Background cloud pull note:', pullErr);
        }
      }

      // Save user profile to Cloudflare
      await CloudflareService.syncUserProfile(updatedUser, StorageService.getProfile()).catch(() => {});

      // Only push data to Cloudflare if we have actual records to preserve or cloud was restored
      const hasLocalData = StorageService.getReceipts().length > 0 ||
        StorageService.getInventoryProducts().length > 0 ||
        StorageService.getInventorySales().length > 0;

      if (hasLocalData || cloudRestored) {
        await CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    };

    runBackgroundSync().catch((err) => console.warn('Background sync note:', err));

    return {
      success: true,
      message: 'Logged in successfully',
    };
  },

  /**
   * Sign in with Google using WorkOS AuthKit + PKCE
   */
  async signInWithGoogle(): Promise<{ success: boolean; user?: WorkOSUser; message?: string }> {
    try {
      // 0. Enforce 30-day trial & subscription requirement
      const trial = StorageService.getTrialStatus();
      if (trial.isExpired && !trial.subscribed) {
        return {
          success: false,
          message: 'Your 30-day free trial has ended. Please upgrade to Brivu Pro to log in and sync your data to the cloud.',
        };
      }

      // 1. If URL callback code is present in current window location, exchange it immediately
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        const verifier = localStorage.getItem('workos_pkce_verifier') || sessionStorage.getItem('workos_pkce_verifier') || undefined;
        const authRes = await CloudflareService.authenticateWorkOSCode(code, undefined, verifier);
        if (authRes.success && authRes.user) {
          await this.saveAndSyncUser(authRes.user);
          // Clean code parameter from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return { success: true, user: authRes.user, message: 'Google Sign-In successful with WorkOS AuthKit!' };
        } else {
          return { success: false, message: authRes.message || 'Failed to exchange authorization code' };
        }
      }

      // 2. Generate PKCE pair
      const { codeVerifier, codeChallenge } = await generatePKCE();
      try {
        localStorage.setItem('workos_pkce_verifier', codeVerifier);
        sessionStorage.setItem('workos_pkce_verifier', codeVerifier);
      } catch (_) {}

      // 3. Check WorkOS configuration on Cloudflare Worker
      const config = await CloudflareService.getWorkOSConfig(codeChallenge);
      const clientId = config.clientId || 'client_01M4BGNT60CPMEA9P83WD6NRSB';

      const isNative = typeof window !== 'undefined' && (
        Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
        window.location.protocol === 'file:' ||
        window.location.protocol === 'capacitor:'
      );
      const cloudflareBaseUrl = config.workerUrl || 'https://brivu.shapesmm7.workers.dev';
      const redirectUri = `${cloudflareBaseUrl.replace(/\/$/, '')}/callback`;

      const returnUrl = typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : '';
      if (!isNative && returnUrl) {
        try {
          localStorage.setItem('workos_web_return_url', returnUrl);
          sessionStorage.setItem('workos_web_return_url', returnUrl);
        } catch (_) {}
      }

      const stateObj = {
        platform: isNative ? 'app' : 'web',
        returnUrl: isNative ? '' : returnUrl,
      };
      const stateParam = encodeURIComponent(JSON.stringify(stateObj));

      let authUrl = `https://api.workos.com/user_management/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&provider=GoogleOAuth&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&state=${stateParam}`;

      // Launch WorkOS AuthKit Google Sign-In via system browser on mobile or direct redirect on web
      if (isNative) {
        try {
          await Browser.open({ url: authUrl, windowName: '_system' });
        } catch (_) {
          window.location.href = authUrl;
        }
      } else {
        window.location.href = authUrl;
      }
      return { success: true, message: 'Redirecting to WorkOS Google Sign-In...' };
    } catch (err: any) {
      console.error('WorkOS Google Sign In error:', err);
      return { success: false, message: err?.message || 'Google Sign-In failed' };
    }
  },

  /**
   * Check and process OAuth code in query string on page load
   */
  async handleCallbackIfPresent(): Promise<WorkOSUser | null> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (!code) {
        return null;
      }

      const res = await this.authenticateCode(code);
      if (res.success && res.user) {
        window.history.replaceState({}, document.title, window.location.pathname);
        return res.user;
      }
    } catch (err) {
      console.warn('Error handling OAuth callback code:', err);
    }
    return null;
  },

  /**
   * Sign out current user
   */
  signOut(): void {
    StorageService.clearWorkOSUser();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workos_user_updated', { detail: null }));
    }
  },
};
