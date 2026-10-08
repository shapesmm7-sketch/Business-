import { WorkOSUser, CloudflareSyncResponse } from '../types';
import { StorageService } from './storage';
import { CloudflareService } from './cloudflareService';

export const WorkOSAuthService = {
  /**
   * Returns current authenticated WorkOS User from storage
   */
  getCurrentUser(): WorkOSUser | null {
    return StorageService.getWorkOSUser();
  },

  /**
   * Save user session locally & sync user profile, email & data to Cloudflare
   */
  async saveAndSyncUser(user: WorkOSUser): Promise<CloudflareSyncResponse> {
    const updatedUser: WorkOSUser = {
      ...user,
      provider: 'google',
      updatedAt: new Date().toISOString(),
      syncedToCloudflare: true,
    };

    // 1. Save in local storage
    StorageService.saveWorkOSUser(updatedUser);

    // 2. If business email is empty, prefill with user email
    const profile = StorageService.getProfile();
    if (!profile.email) {
      StorageService.saveProfile({
        ...profile,
        email: updatedUser.email,
      });
    }

    // 3. Sync user profile, email & data directly to Cloudflare
    const syncRes = await CloudflareService.syncUserProfile(updatedUser, profile);
    
    // Also trigger full cloud backup sync to Cloudflare
    await CloudflareService.syncAllToCloudflare().catch(() => {});

    return syncRes;
  },

  /**
   * Sign in with Google using WorkOS AuthKit
   */
  async signInWithGoogle(): Promise<{ success: boolean; user?: WorkOSUser; message?: string }> {
    try {
      // 1. If URL callback code is present in current window location, exchange it immediately
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        const authRes = await CloudflareService.authenticateWorkOSCode(code);
        if (authRes.success && authRes.user) {
          await this.saveAndSyncUser(authRes.user);
          // Clean code parameter from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return { success: true, user: authRes.user, message: 'Google Sign-In successful with WorkOS AuthKit!' };
        } else {
          return { success: false, message: authRes.message || 'Failed to exchange authorization code' };
        }
      }

      // 2. Check WorkOS configuration on Cloudflare Worker
      const config = await CloudflareService.getWorkOSConfig();
      const clientId = config.clientId || 'client_01M4BGNT60CPMEA9P83WD6NRSB';
      const redirectUri = window.location.origin;

      const authUrl = config.authUrl || `https://api.workos.com/user_management/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&provider=GoogleOAuth`;

      // Redirect to WorkOS AuthKit Google Sign-In
      window.location.href = authUrl;
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
      if (code) {
        const authRes = await CloudflareService.authenticateWorkOSCode(code);
        if (authRes.success && authRes.user) {
          await this.saveAndSyncUser(authRes.user);
          window.history.replaceState({}, document.title, window.location.pathname);
          return authRes.user;
        }
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
  },
};
