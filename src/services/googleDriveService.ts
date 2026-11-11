import { registerPlugin, Capacitor } from '@capacitor/core';
import { StorageService } from './storage';
import { CloudflareService } from './cloudflareService';

export interface GoogleDriveAccount {
  connected: boolean;
  email: string;
  displayName: string;
  photoUrl?: string;
  accessToken: string;
  tokenExpiresAt?: number;
  lastSyncTime?: string;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  mimeType: string;
}

interface GoogleDrivePluginInterface {
  connectGoogleDrive(): Promise<{
    success: boolean;
    connected: boolean;
    email: string;
    displayName?: string;
    photoUrl?: string;
    accessToken: string;
  }>;
  getConnectedAccount(): Promise<{
    connected: boolean;
    email?: string;
    displayName?: string;
    photoUrl?: string;
    accessToken?: string;
    tokenError?: string;
  }>;
  getAccessToken(): Promise<{
    accessToken: string;
  }>;
  disconnectGoogleDrive(): Promise<{
    success: boolean;
    connected: boolean;
  }>;
}

// Register Android native GoogleDrivePlugin with Capacitor Bridge
const GoogleDriveNative = registerPlugin<GoogleDrivePluginInterface>('GoogleDrivePlugin');

const STORAGE_ACCOUNT_KEY = 'brivu_google_drive_account';
const STORAGE_LAST_SYNC_KEY = 'brivu_google_drive_last_sync';

// Google Cloud Console OAuth 2.0 Web Client ID
export const GOOGLE_OAUTH_CLIENT_ID =
  '97897075021-nm7g3g62r1hluqo2gc19k95fa32083k7.apps.googleusercontent.com';

// Required Google Drive and User profile scopes (drive.file for minimum app permissions)
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

/**
 * Ensures Google Identity Services (GIS) client script is loaded on window for web browser
 */
function ensureGoogleIdentityServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      if ((window as any).google?.accounts?.oauth2) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services library'));
    document.head.appendChild(script);
  });
}

function formatSyncTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

export const GoogleDriveService = {
  /**
   * Check if running natively inside Android app
   */
  isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  /**
   * Get cached or locally stored connected Google Drive account
   */
  getStoredAccount(): GoogleDriveAccount | null {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      if (!raw) return null;
      const acc: GoogleDriveAccount = JSON.parse(raw);
      const lastSync = localStorage.getItem(STORAGE_LAST_SYNC_KEY) || acc.lastSyncTime || '';
      return { ...acc, lastSyncTime: lastSync };
    } catch {
      return null;
    }
  },

  /**
   * Calculate total photos available for backup across Inventory, Clients, Agents, and Staff
   */
  getPhotoStats(): {
    inventoryPhotos: number;
    clientPhotos: number;
    agentPhotos: number;
    staffPhotos: number;
    totalPhotos: number;
  } {
    const products = StorageService.getInventoryProducts();
    const inventoryPhotos = products.filter((p) => Boolean(p.image && p.image.trim())).length;

    const customers = StorageService.getCustomers();
    const clientPhotos = customers.filter((c) => Boolean(c.profilePic && c.profilePic.trim())).length;

    const agents = StorageService.getAgents();
    const agentPhotos = agents.filter((a) => Boolean(a.profilePic && a.profilePic.trim())).length;

    const workers = StorageService.getWorkers();
    const staffPhotos = workers.filter((w) => Boolean(w.profilePic && w.profilePic.trim())).length;

    return {
      inventoryPhotos,
      clientPhotos,
      agentPhotos,
      staffPhotos,
      totalPhotos: inventoryPhotos + clientPhotos + agentPhotos + staffPhotos,
    };
  },

  /**
   * Initiates Google's official OAuth 2.0 authorization interface.
   * On Native Android: Invokes Google Play Services AuthorizationClient / GoogleSignInClient bottom-sheet account chooser.
   * On Web Browser: Opens Google's REAL account selection dialog via Google Identity Services (GIS).
   */
  async connectGoogleDrive(): Promise<GoogleDriveAccount> {
    if (this.isNativeAndroid()) {
      try {
        const res = await GoogleDriveNative.connectGoogleDrive();
        if (!res || !res.connected || !res.email || !res.accessToken) {
          throw new Error('Google account selection was cancelled or failed.');
        }

        const lastSync = localStorage.getItem(STORAGE_LAST_SYNC_KEY) || '';
        const account: GoogleDriveAccount = {
          connected: true,
          email: res.email,
          displayName: res.displayName || res.email.split('@')[0],
          photoUrl: res.photoUrl || '',
          accessToken: res.accessToken,
          tokenExpiresAt: Date.now() + 3600 * 1000,
          lastSyncTime: lastSync,
        };

        localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
        return account;
      } catch (nativeErr: any) {
        console.error('Native Android Google Drive authorization error:', nativeErr);
        throw new Error(nativeErr?.message || 'Failed to select Google Account on Android.');
      }
    }

    // Web Browser / Preview Flow using Google Identity Services (GIS)
    await ensureGoogleIdentityServices();

    return new Promise<GoogleDriveAccount>((resolve, reject) => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        return reject(new Error('Google Identity Services library is not ready. Please try again.'));
      }

      let client: any = null;
      try {
        client = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          scope: OAUTH_SCOPES,
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (!tokenResponse) {
              return reject(new Error('No response received from Google authorization.'));
            }

            if (tokenResponse.error) {
              console.error('Google OAuth error:', tokenResponse);
              return reject(
                new Error(tokenResponse.error_description || tokenResponse.error || 'Google authorization failed.')
              );
            }

            const accessToken = tokenResponse.access_token;
            if (!accessToken) {
              return reject(new Error('Google did not return an access token.'));
            }

            try {
              // Fetch the authenticated user's real Gmail profile from Google's official userinfo endpoint
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (!userInfoRes.ok) {
                const errText = await userInfoRes.text();
                throw new Error(`Failed to retrieve Google profile: ${errText}`);
              }

              const userInfo = await userInfoRes.json();
              const realEmail = userInfo.email;
              const displayName = userInfo.name || realEmail.split('@')[0];
              const photoUrl = userInfo.picture || '';

              const lastSync = localStorage.getItem(STORAGE_LAST_SYNC_KEY) || '';
              const expiresAt = Date.now() + (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;

              const account: GoogleDriveAccount = {
                connected: true,
                email: realEmail,
                displayName,
                photoUrl,
                accessToken,
                tokenExpiresAt: expiresAt,
                lastSyncTime: lastSync,
              };

              localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
              resolve(account);
            } catch (profileErr: any) {
              console.error('Failed to fetch userinfo:', profileErr);
              reject(profileErr);
            }
          },
          error_callback: (err: any) => {
            console.error('Google Identity error callback:', err);
            reject(new Error(err?.message || 'Google account authorization popup closed or blocked.'));
          },
        });

        // Request real access token using Google's popup
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (initErr: any) {
        console.error('Error initializing Google Identity Token Client:', initErr);
        reject(initErr);
      }
    });
  },

  /**
   * Retrieves a valid access token or requests fresh authorization if expired
   */
  async getValidAccessToken(): Promise<string> {
    const account = this.getStoredAccount();
    if (!account || !account.connected) {
      throw new Error('Google Drive is not connected. Please connect your Google account first.');
    }

    if (this.isNativeAndroid()) {
      try {
        const res = await GoogleDriveNative.getAccessToken();
        if (res?.accessToken) {
          account.accessToken = res.accessToken;
          account.tokenExpiresAt = Date.now() + 3600 * 1000;
          localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
          return res.accessToken;
        }
      } catch (e) {
        console.warn('Native token refresh note:', e);
      }
    }

    // Check if current token is expired (giving 2 minutes buffer)
    const isExpired = account.tokenExpiresAt ? Date.now() > account.tokenExpiresAt - 120000 : false;
    if (isExpired || !account.accessToken) {
      // Re-prompt real authorization using Google Identity Services / Native Chooser
      const freshAccount = await this.connectGoogleDrive();
      return freshAccount.accessToken;
    }

    return account.accessToken;
  },

  /**
   * Disconnects Google Drive account and revokes access token
   */
  async disconnectGoogleDrive(): Promise<void> {
    if (this.isNativeAndroid()) {
      try {
        await GoogleDriveNative.disconnectGoogleDrive();
      } catch (e) {
        console.warn('Native disconnect note:', e);
      }
    } else {
      const account = this.getStoredAccount();
      if (account?.accessToken) {
        try {
          const google = (window as any).google;
          if (google?.accounts?.oauth2?.revoke) {
            google.accounts.oauth2.revoke(account.accessToken, () => {});
          } else {
            fetch(`https://oauth2.googleapis.com/revoke?token=${account.accessToken}`, {
              method: 'POST',
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Google revoke warning:', e);
        }
      }
    }

    localStorage.removeItem(STORAGE_ACCOUNT_KEY);
  },

  /**
   * Locates or creates the official "Brivu Backups" folder in the user's own Google Drive
   */
  async getOrCreateBrivuFolder(accessToken: string): Promise<string> {
    const folderName = 'Brivu Backups';

    // 1. Search for existing folder named "Brivu Backups"
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    )}&fields=files(id,name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // 2. Folder does not exist, create it directly in the user's Google Drive
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Brivu Business Manager Backup Directory',
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create "${folderName}" folder in Google Drive: ${errText}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  },

  /**
   * Uploads complete Brivu business data (receipts, invoices, inventory, clients, staff, and photos)
   * directly to the "Brivu Backups" folder in the authenticated user's Google Drive.
   */
  async syncNow(customFilename?: string): Promise<{
    success: boolean;
    fileName?: string;
    fileId?: string;
    syncTime?: string;
    photoCount?: number;
    error?: string;
  }> {
    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken();
    } catch (authErr: any) {
      return { success: false, error: authErr?.message || 'Please connect your Google Drive account first.' };
    }

    const account = this.getStoredAccount();
    const payload = StorageService.exportBackup();
    const photoStats = this.getPhotoStats();
    (payload as any).photoStats = photoStats;

    const payloadStr = JSON.stringify(payload, null, 2);
    const now = new Date();
    const dateSlug = now.toISOString().split('T')[0];
    const fileName = customFilename || `brivu_backup_${dateSlug}_${now.getTime()}.json`;
    const formattedSyncTime = formatSyncTimestamp(now);

    try {
      // 1. Get or create the "Brivu Backups" folder in the user's Google Drive
      const folderId = await this.getOrCreateBrivuFolder(accessToken);

      // 2. Upload the backup file directly to that user's Google Drive folder
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
        description: `Brivu backup created on ${now.toLocaleString()} (${photoStats.totalPhotos} photos included)`,
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        payloadStr +
        closeDelimiter;

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,modifiedTime',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body: multipartRequestBody,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Google Drive upload failed: ${errText}`);
      }

      const uploadData = await uploadRes.json();

      // Update last sync timestamp in storage
      localStorage.setItem(STORAGE_LAST_SYNC_KEY, formattedSyncTime);
      if (account) {
        account.lastSyncTime = formattedSyncTime;
        localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
      }

      return {
        success: true,
        fileName: uploadData.name || fileName,
        fileId: uploadData.id,
        syncTime: formattedSyncTime,
        photoCount: photoStats.totalPhotos,
      };
    } catch (uploadErr: any) {
      console.error('Google Drive backup error:', uploadErr);
      return {
        success: false,
        error: uploadErr?.message || 'Failed to backup files to Google Drive.',
      };
    }
  },

  /**
   * Lists all backup files inside the "Brivu Backups" folder from the user's Google Drive
   */
  async listBackups(): Promise<DriveBackupFile[]> {
    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken();
    } catch {
      return [];
    }

    try {
      // Find "Brivu Backups" folder
      const folderId = await this.getOrCreateBrivuFolder(accessToken);
      const query = `'${folderId}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&fields=files(id,name,createdTime,modifiedTime,size,mimeType)&orderBy=modifiedTime desc`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      return data.files || [];
    } catch (e) {
      console.warn('Failed listing backups from Google Drive:', e);
      return [];
    }
  },

  /**
   * Downloads and restores backup file content from Google Drive
   */
  async restoreBackup(
    fileId: string,
    mergeStrategy: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; itemCount?: any; error?: string }> {
    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken();
    } catch (authErr: any) {
      return { success: false, error: authErr?.message || 'Please connect your Google Drive account first.' };
    }

    try {
      // Direct download from Google Drive API
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to download backup from Google Drive: ${errText}`);
      }

      const backupData = await res.json();
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('The downloaded backup file is not valid JSON data.');
      }

      return this.applyRestoredData(backupData, mergeStrategy);
    } catch (err: any) {
      console.error('Error during Google Drive restore:', err);
      return { success: false, error: err?.message || 'Failed restoring backup from Google Drive' };
    }
  },

  /**
   * Restores backup directly from local JSON file upload
   */
  async restoreFromLocalJson(
    jsonString: string,
    mergeStrategy: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; itemCount?: any; error?: string }> {
    try {
      const backupData = JSON.parse(jsonString);
      if (!backupData || typeof backupData !== 'object') {
        return { success: false, error: 'Invalid backup file format' };
      }
      return this.applyRestoredData(backupData, mergeStrategy);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid JSON file' };
    }
  },

  /**
   * Internal helper to apply restored data to storage & sync
   */
  applyRestoredData(
    backupData: any,
    mergeStrategy: 'merge' | 'replace'
  ): { success: boolean; itemCount?: any; error?: string } {
    try {
      const importResult = StorageService.importBackup(backupData, mergeStrategy === 'replace');
      if (!importResult.success) {
        return { success: false, error: importResult.message };
      }

      // Count restored photos
      const restoredProducts = Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts : [];
      const restoredCustomers = Array.isArray(backupData.customers) ? backupData.customers : [];
      const restoredAgents = Array.isArray(backupData.agents) ? backupData.agents : [];
      const restoredWorkers = Array.isArray(backupData.workers) ? backupData.workers : [];

      const restoredPhotoCount =
        restoredProducts.filter((p: any) => p.image).length +
        restoredCustomers.filter((c: any) => c.profilePic).length +
        restoredAgents.filter((a: any) => a.profilePic).length +
        restoredWorkers.filter((w: any) => w.profilePic).length;

      // Sync to cloudflare background if available
      CloudflareService.syncAllToCloudflare().catch(() => {});

      return {
        success: true,
        itemCount: {
          receipts: Array.isArray(backupData.receipts) ? backupData.receipts.length : 0,
          products: restoredProducts.length,
          customers: restoredCustomers.length,
          agents: restoredAgents.length,
          staff: restoredWorkers.length,
          photos: restoredPhotoCount,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error restoring data from Google Drive' };
    }
  },
};
