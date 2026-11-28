import { registerPlugin, Capacitor } from '@capacitor/core';
import { StorageService, isAdminLifetimeEmail } from './storage';
import { PlayBillingService } from './playBillingService';

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
  switchGoogleAccount(): Promise<{
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
  invalidateToken?(options: { token: string }): Promise<{
    cleared: boolean;
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
const STOCK_AUTO_BACKUP_FILENAME = 'brivu_stock_auto_backup.json';

let stockAutoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let stockAutoSyncInFlight = false;
let stockAutoSyncQueued = false;
let autoSyncListenerAttached = false;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeItemsPreservingPhotos<T extends Record<string, any>>(
  existing: T[],
  incoming: T[],
  photoField: string,
  backupPhotoField: string,
  avoidDifferentProductCollision = false
): T[] {
  const isUnusablePhoto = (val: any): boolean => {
    if (typeof val !== 'string' || !val.trim()) return true;
    const s = val.trim().toLowerCase();
    return s.startsWith('blob:') || s.startsWith('file:') || s.startsWith('capacitor:') || s.startsWith('content:');
  };
  const mergeFields = (prev: T, item: T): T => {
    const merged: Record<string, any> = { ...prev };
    for (const [k, v] of Object.entries(item)) {
      if (v !== undefined && v !== null && v !== '') {
        merged[k] = v;
      }
    }
    const prevPhoto = !isUnusablePhoto(prev[photoField]) ? prev[photoField] : undefined;
    const nextPhoto = !isUnusablePhoto(item[photoField]) ? item[photoField] : undefined;
    const prevBackupPhoto = !isUnusablePhoto(prev[backupPhotoField]) ? prev[backupPhotoField] : undefined;
    const nextBackupPhoto = !isUnusablePhoto(item[backupPhotoField]) ? item[backupPhotoField] : undefined;

    merged[photoField] = nextPhoto || prevPhoto;
    merged[backupPhotoField] = nextBackupPhoto || prevBackupPhoto;
    return merged as T;
  };

  const map = new Map<string, T>();
  for (const item of existing || []) {
    if (item && item.id) map.set(String(item.id), item);
  }
  (incoming || []).forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const rawId = item.id || (item as any).productId || ((item as any).itemId ? `prod-${(item as any).itemId}` : `item-drv-${idx}`);
    const id = String(rawId);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, { ...item, id } as T);
      return;
    }
    if (avoidDifferentProductCollision) {
      const prevName = String(prev.name || prev.productName || '').trim().toLowerCase();
      const incName = String(item.name || item.productName || '').trim().toLowerCase();
      const prevCode = String(prev.itemId || prev.barcode || '').trim().toLowerCase();
      const incCode = String(item.itemId || item.barcode || '').trim().toLowerCase();
      if (prevName && incName && prevName !== incName && prevCode !== incCode) {
        const uniqueId = `${id}-drv-${idx}-${Math.random().toString(36).slice(2, 5)}`;
        map.set(uniqueId, { ...item, id: uniqueId } as T);
        return;
      }
    }
    map.set(id, mergeFields(prev, { ...item, id } as T));
  });
  return Array.from(map.values());
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
   * Checks whether Google Drive connect/sync is blocked because the 7-day free trial ended without a subscription.
   */
  isDriveSyncSubscriptionRequired(candidateEmail?: string | null): boolean {
    if (isAdminLifetimeEmail(candidateEmail) || StorageService.isCurrentUserAdmin()) {
      return false;
    }
    const trial = StorageService.getTrialStatus();
    return Boolean(trial.isExpired && !trial.subscribed);
  },

  async ensureDriveSyncAllowed(candidateEmail?: string | null): Promise<boolean> {
    if (!this.isDriveSyncSubscriptionRequired(candidateEmail)) {
      return true;
    }
    const synced = await PlayBillingService.syncActiveSubscriptionSilently(true);
    if (synced) {
      return !this.isDriveSyncSubscriptionRequired(candidateEmail);
    }
    return false;
  },

  /**
   * Initiates Google's official OAuth 2.0 authorization interface.
   * On Native Android: Invokes Google Play Services AuthorizationClient / GoogleSignInClient bottom-sheet account chooser.
   * On Web Browser: Opens Google's REAL account selection dialog via Google Identity Services (GIS).
   */
  async connectGoogleDrive(): Promise<GoogleDriveAccount> {
    const preAllowed = await this.ensureDriveSyncAllowed();

    if (this.isNativeAndroid()) {
      try {
        const res = await GoogleDriveNative.connectGoogleDrive();
        if (!res || !res.connected || !res.email || !res.accessToken) {
          throw new Error('Google account selection was cancelled or failed.');
        }

        if (!preAllowed && !isAdminLifetimeEmail(res.email)) {
          await GoogleDriveNative.disconnectGoogleDrive().catch(() => {});
          throw new Error(
            'Your 7-day free trial has ended. Please subscribe to Brivu Basic in order to continue saving your files to Google Drive.'
          );
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
              if (!preAllowed && !isAdminLifetimeEmail(realEmail)) {
                throw new Error(
                  'Your 7-day free trial has ended. Please subscribe to Brivu Basic in order to continue saving your files to Google Drive.'
                );
              }
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
   * Switches the active Google account.
   * On Android: Signs out active session first then launches Google Play Services account chooser.
   * On Web: Revokes session and prompts account selection.
   */
  async switchGoogleAccount(): Promise<GoogleDriveAccount> {
    const preAllowed = await this.ensureDriveSyncAllowed();

    if (this.isNativeAndroid()) {
      try {
        const res = await GoogleDriveNative.switchGoogleAccount();
        if (!res || !res.connected || !res.email || !res.accessToken) {
          throw new Error('Google account selection was cancelled or failed.');
        }

        if (!preAllowed && !isAdminLifetimeEmail(res.email)) {
          await GoogleDriveNative.disconnectGoogleDrive().catch(() => {});
          throw new Error(
            'Your 7-day free trial has ended. Please subscribe to Brivu Basic in order to continue saving your files to Google Drive.'
          );
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
        console.error('Native Android Google Drive account switch error:', nativeErr);
        throw new Error(nativeErr?.message || 'Failed to switch Google Account on Android.');
      }
    }

    await this.disconnectGoogleDrive();
    return this.connectGoogleDrive();
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
   * Invalidates a rejected (401) access token and retrieves a fresh one.
   */
  async refreshAccessToken(staleToken?: string): Promise<string> {
    const account = this.getStoredAccount();
    if (!account || !account.connected) {
      throw new Error('Google Drive is not connected. Please connect your Google account first.');
    }

    if (this.isNativeAndroid()) {
      try {
        if (staleToken && GoogleDriveNative.invalidateToken) {
          await GoogleDriveNative.invalidateToken({ token: staleToken }).catch(() => {});
        }
        const res = await GoogleDriveNative.getAccessToken();
        if (res?.accessToken) {
          account.accessToken = res.accessToken;
          account.tokenExpiresAt = Date.now() + 3600 * 1000;
          localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
          return res.accessToken;
        }
      } catch (e) {
        console.warn('Android token refresh note:', e);
      }
    }

    const freshAccount = await this.connectGoogleDrive();
    return freshAccount.accessToken;
  },

  /**
   * Executes a Google Drive fetch with automatic 401 token refresh and exponential backoff
   * on transient 429/5xx or network failures.
   */
  async driveFetch(
    url: string,
    init: RequestInit = {},
    tokenOverride?: string,
    maxRetries = 2
  ): Promise<Response> {
    let token = tokenOverride || (await this.getValidAccessToken());
    let refreshedOn401 = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const headers = new Headers(init.headers || {});
        headers.set('Authorization', `Bearer ${token}`);

        const res = await fetch(url, {
          ...init,
          cache: 'no-store',
          headers,
        });

        if (res.status === 401 && !refreshedOn401) {
          refreshedOn401 = true;
          token = await this.refreshAccessToken(token);
          continue;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          await sleep(450 * Math.pow(2, attempt));
          continue;
        }

        return res;
      } catch (err) {
        if (attempt >= maxRetries) {
          throw err;
        }
        await sleep(450 * Math.pow(2, attempt));
      }
    }

    throw new Error('Google Drive request failed after retries.');
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
   * Finds ALL non-trashed "Brivu Backups" folders without creating duplicates.
   */
  async findBrivuFolderIds(accessToken?: string): Promise<string[]> {
    const folderName = 'Brivu Backups';
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    )}&spaces=drive&pageSize=100&orderBy=createdTime asc&fields=files(id,name,createdTime)`;

    const searchRes = await this.driveFetch(searchUrl, {}, accessToken);
    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => searchRes.statusText);
      const err: any = new Error(`Google Drive folder lookup failed (${searchRes.status}): ${errText}`);
      err.status = searchRes.status;
      throw err;
    }

    const data = await searchRes.json();
    const files = Array.isArray(data?.files) ? data.files : [];
    return files.map((f: any) => f.id).filter(Boolean);
  },

  /**
   * Locates or creates the official "Brivu Backups" folder in the user's own Google Drive.
   * Never creates a duplicate folder if folder search encountered an error.
   */
  async getOrCreateBrivuFolder(accessToken?: string): Promise<string> {
    const folderName = 'Brivu Backups';
    const existingIds = await this.findBrivuFolderIds(accessToken);
    if (existingIds.length > 0) {
      return existingIds[0];
    }

    const createRes = await this.driveFetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          description: 'Brivu Business Manager Backup Directory',
        }),
      },
      accessToken
    );

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => createRes.statusText);
      throw new Error(`Failed to create "${folderName}" folder in Google Drive: ${errText}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  },

  /**
   * Uploads complete Brivu business data (receipts, invoices, inventory, clients, staff, and embedded photos)
   * directly to the "Brivu Backups" folder in the authenticated user's Google Drive.
   */
  async syncNow(customFilename?: string): Promise<{
    success: boolean;
    fileName?: string;
    fileId?: string;
    syncTime?: string;
    photoCount?: number;
    requiresSubscription?: boolean;
    error?: string;
  }> {
    const account = this.getStoredAccount();
    if (!(await this.ensureDriveSyncAllowed(account?.email))) {
      return {
        success: false,
        requiresSubscription: true,
        error:
          'Your 7-day free trial has ended. Please subscribe to Brivu Basic in order to continue saving your files to Google Drive.',
      };
    }

    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken();
    } catch (authErr: any) {
      return { success: false, error: authErr?.message || 'Please connect your Google Drive account first.' };
    }
    const payload = await StorageService.exportBackupWithEmbeddedPhotos();
    const photoStats = this.getPhotoStats();
    (payload as any).photoStats = photoStats;

    const payloadStr = JSON.stringify(payload);
    const now = new Date();
    const dateSlug = now.toISOString().split('T')[0];
    const fileName = customFilename || `brivu_backup_${dateSlug}_${now.getTime()}.json`;
    const formattedSyncTime = formatSyncTimestamp(now);

    try {
      const folderId = await this.getOrCreateBrivuFolder(accessToken);

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

      const uploadRes = await this.driveFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,modifiedTime',
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body: multipartRequestBody,
        },
        accessToken
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => uploadRes.statusText);
        throw new Error(`Google Drive upload failed: ${errText}`);
      }

      const uploadData = await uploadRes.json();

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
   * Lists all backup files across all "Brivu Backups" folders (plus any Brivu JSON backup files
   * visible to the app) with automatic token refresh, retries, pagination, and real error reporting.
   */
  async listBackupsWithStatus(): Promise<{
    files: DriveBackupFile[];
    error?: string;
    needsReconnect?: boolean;
  }> {
    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken();
    } catch (authErr: any) {
      return {
        files: [],
        error: authErr?.message || 'Google Drive session expired. Please reconnect your Google account.',
        needsReconnect: true,
      };
    }

    try {
      const folderIds = await this.findBrivuFolderIds(accessToken);

      const queryParts: string[] = [];
      if (folderIds.length > 0) {
        const parentsClause = folderIds.map((id) => `'${id}' in parents`).join(' or ');
        queryParts.push(`((${parentsClause}) and mimeType != 'application/vnd.google-apps.folder' and trashed = false)`);
      }
      queryParts.push(
        `((name contains 'brivu_backup' or name contains 'Brivu_Backup' or name contains 'brivu_stock' or name contains 'stock_auto_backup') and mimeType != 'application/vnd.google-apps.folder' and trashed = false)`
      );

      const combinedQuery = queryParts.join(' or ');
      const fileMap = new Map<string, DriveBackupFile>();
      let pageToken: string | undefined = undefined;
      let pageCount = 0;

      do {
        const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          combinedQuery
        )}&spaces=drive&pageSize=100&fields=nextPageToken,files(id,name,createdTime,modifiedTime,size,mimeType)&orderBy=modifiedTime desc${pageParam}`;

        const res = await this.driveFetch(url, {}, accessToken);
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          return {
            files: Array.from(fileMap.values()),
            error: `Could not load Google Drive backups (${res.status}). Tap Retry to try again. ${errText ? '' : ''}`.trim(),
            needsReconnect: res.status === 401 || res.status === 403,
          };
        }

        const data = await res.json();
        const files: DriveBackupFile[] = Array.isArray(data?.files) ? data.files : [];
        for (const f of files) {
          if (f && f.id && f.mimeType !== 'application/vnd.google-apps.folder') {
            fileMap.set(f.id, f);
          }
        }
        pageToken = data?.nextPageToken || undefined;
        pageCount += 1;
      } while (pageToken && pageCount < 5);

      const sortedFiles = Array.from(fileMap.values()).sort(
        (a, b) => new Date(b.modifiedTime || b.createdTime || 0).getTime() - new Date(a.modifiedTime || a.createdTime || 0).getTime()
      );

      return { files: sortedFiles };
    } catch (e: any) {
      console.warn('Failed listing backups from Google Drive:', e);
      const msg = String(e?.message || '');
      const needsReconnect = e?.status === 401 || e?.status === 403 || msg.includes('401') || msg.toLowerCase().includes('not connected');
      return {
        files: [],
        error: msg || 'Network error loading Google Drive backups. Please check your connection and tap Retry.',
        needsReconnect,
      };
    }
  },

  /**
   * Lists all backup files inside the "Brivu Backups" folder from the user's Google Drive
   */
  async listBackups(): Promise<DriveBackupFile[]> {
    const res = await this.listBackupsWithStatus();
    return res.files;
  },

  /**
   * Parses JSON text (stripping UTF-8 BOM if present) and unwraps nested backup wrappers
   * while normalizing key aliases into canonical arrays.
   */
  parseAndNormalizeBackupPayload(rawText: string): any | null {
    try {
      const cleanText = String(rawText || '').replace(/^\uFEFF/, '').trim();
      if (!cleanText) return null;
      let parsed: any = JSON.parse(cleanText);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed.replace(/^\uFEFF/, '').trim());
      }
      return this.unwrapBackupData(parsed);
    } catch {
      return null;
    }
  },

  unwrapBackupData(raw: any): any | null {
    if (!raw || typeof raw !== 'object') return null;
    let obj = raw;
    for (let depth = 0; depth < 3; depth++) {
      const inner = obj.backupData || obj.data || obj.backup || obj.payload;
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        obj = inner;
      } else {
        break;
      }
    }

    const collectAll = (...lists: any[]): any[] => {
      const out: any[] = [];
      for (const list of lists) {
        if (Array.isArray(list) && list.length > 0) out.push(...list);
      }
      return out;
    };

    const mergedReceipts = collectAll(obj.receipts, obj.invoices, obj.quotations, obj.documents);
    const mergedProducts = collectAll(obj.inventoryProducts, obj.products, obj.items, obj.stock, obj.inventory);
    const mergedCustomers = collectAll(obj.customers, obj.clients);
    const mergedWorkers = collectAll(obj.workers, obj.staff, obj.employees);

    return {
      ...obj,
      ...(mergedReceipts.length > 0 ? { receipts: mergedReceipts } : {}),
      ...(mergedProducts.length > 0 ? { inventoryProducts: mergedProducts } : {}),
      ...(mergedCustomers.length > 0 ? { customers: mergedCustomers } : {}),
      ...(mergedWorkers.length > 0 ? { workers: mergedWorkers } : {}),
    };
  },

  /**
   * Downloads and restores backup file content from Google Drive
   */
  async restoreBackup(
    fileId: string,
    mergeStrategy: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; itemCount?: any; error?: string }> {
    try {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await this.driveFetch(downloadUrl);

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to download backup from Google Drive: ${errText}`);
      }

      const rawText = await res.text();
      const backupData = this.parseAndNormalizeBackupPayload(rawText);
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('The downloaded backup file is not valid JSON data.');
      }

      return await this.applyRestoredData(backupData, mergeStrategy);
    } catch (err: any) {
      console.error('Error during Google Drive restore:', err);
      return { success: false, error: err?.message || 'Failed restoring backup from Google Drive' };
    }
  },

  /**
   * Sequentially downloads ALL backup files from the "Brivu Backups" folder
   * and restores complete business data using Replace Mode.
   */
  async restoreAllBackups(
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<{ success: boolean; restoredCount?: number; totalItems?: any; error?: string }> {
    const listRes = await this.listBackupsWithStatus();
    if (listRes.error && listRes.files.length === 0) {
      return { success: false, error: listRes.error };
    }
    const backups = listRes.files;
    if (backups.length === 0) {
      return { success: false, error: 'No backup files found in "Brivu Backups" folder.' };
    }

    const sorted = [...backups].sort(
      (a, b) => new Date(a.modifiedTime || a.createdTime || 0).getTime() - new Date(b.modifiedTime || b.createdTime || 0).getTime()
    );

    let consolidatedBackup: any = null;
    let processedFiles = 0;

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i];
      if (onProgress) {
        onProgress(i + 1, sorted.length, file.name);
      }

      try {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const res = await this.driveFetch(downloadUrl);

        if (res.ok) {
          const rawText = await res.text();
          const data = this.parseAndNormalizeBackupPayload(rawText);
          if (data && typeof data === 'object') {
            if (!consolidatedBackup) {
              consolidatedBackup = { ...data };
            } else {
              if (data.profile) {
                consolidatedBackup.profile = {
                  ...consolidatedBackup.profile,
                  ...data.profile,
                  logo: data.profile.logo || consolidatedBackup.profile?.logo,
                  logoBackupData: data.profile.logoBackupData || consolidatedBackup.profile?.logoBackupData,
                  signature: data.profile.signature || consolidatedBackup.profile?.signature,
                  signatureBackupData: data.profile.signatureBackupData || consolidatedBackup.profile?.signatureBackupData,
                };
              }
              if (data.settings) consolidatedBackup.settings = { ...consolidatedBackup.settings, ...data.settings };

              if (Array.isArray(data.receipts)) {
                const map = new Map<string, any>();
                const sameReceipt = (a: any, b: any): boolean => {
                  const numA = String(a?.receiptNumber || '').trim().toLowerCase();
                  const numB = String(b?.receiptNumber || '').trim().toLowerCase();
                  const typeA = String(a?.documentType || 'receipt').toLowerCase();
                  const typeB = String(b?.documentType || 'receipt').toLowerCase();
                  if (numA && numB && numA !== numB) return false;
                  if (typeA !== typeB) return false;
                  if (a?.createdAt && b?.createdAt && a.createdAt === b.createdAt) return true;
                  return (
                    String(a?.customerName || '').trim().toLowerCase() === String(b?.customerName || '').trim().toLowerCase() &&
                    Math.abs(Number(a?.total || 0) - Number(b?.total || 0)) < 0.01 &&
                    (Array.isArray(a?.items) ? a.items.length : 0) === (Array.isArray(b?.items) ? b.items.length : 0)
                  );
                };
                (consolidatedBackup.receipts || []).forEach((r: any) => { if (r?.id) map.set(String(r.id), r); });
                data.receipts.forEach((r: any, idx: number) => {
                  if (!r?.id) return;
                  const rid = String(r.id);
                  const prev = map.get(rid);
                  if (!prev || sameReceipt(prev, r)) {
                    map.set(rid, r);
                  } else {
                    const uniqueId = `${rid}-drv-${i}-${idx}`;
                    map.set(uniqueId, { ...r, id: uniqueId });
                  }
                });
                consolidatedBackup.receipts = Array.from(map.values());
              }

              // Inventory Products: support both inventoryProducts and legacy products keys, merge by id while NEVER losing texts or photos
              const incomingProds = Array.isArray(data.inventoryProducts)
                ? data.inventoryProducts
                : Array.isArray((data as any).products)
                ? (data as any).products
                : null;
              if (incomingProds) {
                consolidatedBackup.inventoryProducts = mergeItemsPreservingPhotos(
                  consolidatedBackup.inventoryProducts || [],
                  incomingProds,
                  'image',
                  'imageBackupData',
                  true
                );
              }

              // Customers / Clients: merge by id while preserving profilePic
              if (Array.isArray(data.customers)) {
                consolidatedBackup.customers = mergeItemsPreservingPhotos(
                  consolidatedBackup.customers || [],
                  data.customers,
                  'profilePic',
                  'profilePicBackupData'
                );
              }

              // Agents: merge by id while preserving profilePic
              if (Array.isArray(data.agents)) {
                consolidatedBackup.agents = mergeItemsPreservingPhotos(
                  consolidatedBackup.agents || [],
                  data.agents,
                  'profilePic',
                  'profilePicBackupData'
                );
              }

              // Workers / Staff: merge by id while preserving profilePic
              if (Array.isArray(data.workers)) {
                consolidatedBackup.workers = mergeItemsPreservingPhotos(
                  consolidatedBackup.workers || [],
                  data.workers,
                  'profilePic',
                  'profilePicBackupData'
                );
              }

              const mergeSimpleById = (prevArr: any[] = [], nextArr: any[] = []) => {
                const m = new Map<string, any>();
                prevArr.forEach((item: any) => { if (item?.id) m.set(String(item.id), item); });
                nextArr.forEach((item: any) => { if (item?.id) m.set(String(item.id), item); });
                return Array.from(m.values());
              };

              if (Array.isArray(data.inventorySales)) {
                consolidatedBackup.inventorySales = mergeSimpleById(consolidatedBackup.inventorySales, data.inventorySales);
              }
              if (Array.isArray(data.inventoryExpenses)) {
                consolidatedBackup.inventoryExpenses = mergeSimpleById(consolidatedBackup.inventoryExpenses, data.inventoryExpenses);
              }
              if (Array.isArray(data.inventoryDebts)) {
                consolidatedBackup.inventoryDebts = mergeSimpleById(consolidatedBackup.inventoryDebts, data.inventoryDebts);
              }
              if (Array.isArray(data.shoppingListItems)) {
                consolidatedBackup.shoppingListItems = mergeSimpleById(consolidatedBackup.shoppingListItems, data.shoppingListItems);
              }
              if (Array.isArray(data.shoppingCategories)) {
                consolidatedBackup.shoppingCategories = mergeSimpleById(consolidatedBackup.shoppingCategories, data.shoppingCategories);
              }
              if (Array.isArray(data.productCategories)) {
                consolidatedBackup.productCategories = mergeSimpleById(consolidatedBackup.productCategories, data.productCategories);
              }
              if (Array.isArray(data.staffAttendance)) {
                consolidatedBackup.staffAttendance = mergeSimpleById(consolidatedBackup.staffAttendance, data.staffAttendance);
              }
              if (Array.isArray(data.staffLosses)) {
                consolidatedBackup.staffLosses = mergeSimpleById(consolidatedBackup.staffLosses, data.staffLosses);
              }
              if (Array.isArray(data.staffSales)) {
                consolidatedBackup.staffSales = mergeSimpleById(consolidatedBackup.staffSales, data.staffSales);
              }
              if (Array.isArray(data.staffIncidents)) {
                consolidatedBackup.staffIncidents = mergeSimpleById(consolidatedBackup.staffIncidents, data.staffIncidents);
              }
              if (Array.isArray(data.websitesQrItems)) {
                consolidatedBackup.websitesQrItems = mergeSimpleById(consolidatedBackup.websitesQrItems, data.websitesQrItems);
              }
              if (Array.isArray(data.socialsQrItems)) {
                consolidatedBackup.socialsQrItems = mergeSimpleById(consolidatedBackup.socialsQrItems, data.socialsQrItems);
              }
              if (Array.isArray(data.agentLedger)) {
                consolidatedBackup.agentLedger = mergeSimpleById(consolidatedBackup.agentLedger, data.agentLedger);
              }
              if (Array.isArray(data.eventsQrItems)) {
                consolidatedBackup.eventsQrItems = mergeSimpleById(consolidatedBackup.eventsQrItems, data.eventsQrItems);
              }

              if (Array.isArray(data.qrHostedPages)) {
                const map = new Map<string, any>();
                (consolidatedBackup.qrHostedPages || []).forEach((q: any) => { if (q?.id) map.set(q.id, q); });
                data.qrHostedPages.forEach((q: any) => {
                  if (!q?.id) return;
                  const prev = map.get(q.id);
                  if (prev) {
                    map.set(q.id, {
                      ...prev,
                      ...q,
                      coverImage: q.coverImage || prev.coverImage,
                      logo: q.logo || prev.logo,
                      photos: Array.isArray(q.photos) && q.photos.length > 0 ? q.photos : (prev.photos || []),
                      menuItems: Array.isArray(q.menuItems) && q.menuItems.length > 0 ? q.menuItems : (prev.menuItems || []),
                    });
                  } else {
                    map.set(q.id, q);
                  }
                });
                consolidatedBackup.qrHostedPages = Array.from(map.values());
              }
            }
            processedFiles++;
          }
        }
      } catch (fileErr) {
        console.warn(`Could not process backup file ${file.name}:`, fileErr);
      }
    }

    if (!consolidatedBackup || processedFiles === 0) {
      return { success: false, error: 'Failed to restore backup files from Google Drive.' };
    }

    const finalResult = await this.applyRestoredData(consolidatedBackup, 'replace');
    if (!finalResult.success) {
      return { success: false, error: finalResult.error };
    }

    return {
      success: true,
      restoredCount: processedFiles,
      totalItems: finalResult.itemCount,
    };
  },

  /**
   * Restores backup directly from local JSON file upload
   */
  async restoreFromLocalJson(
    jsonString: string,
    mergeStrategy: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; itemCount?: any; error?: string }> {
    try {
      const backupData = this.parseAndNormalizeBackupPayload(jsonString);
      if (!backupData || typeof backupData !== 'object') {
        return { success: false, error: 'Invalid backup file format' };
      }
      return await this.applyRestoredData(backupData, mergeStrategy);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid JSON file' };
    }
  },

  /**
   * Internal helper to apply restored data to storage and recover embedded photos before refreshing UI
   */
  async applyRestoredData(
    rawBackupData: any,
    mergeStrategy: 'merge' | 'replace'
  ): Promise<{ success: boolean; itemCount?: any; error?: string }> {
    try {
      const backupData = this.unwrapBackupData(rawBackupData) || rawBackupData;
      const importResult = StorageService.importBackup(backupData, mergeStrategy === 'replace');
      if (!importResult.success) {
        return { success: false, error: importResult.message };
      }

      // Recover any embedded product, client, agent, staff, and profile photos directly into localStorage before reading final counts
      await StorageService.recoverRestoredProductPhotos(backupData).catch(() => {});

      const restoredReceipts = StorageService.getReceipts();
      const restoredProducts = StorageService.getInventoryProducts();
      const restoredCustomers = StorageService.getCustomers();
      const restoredAgents = StorageService.getAgents();
      const restoredWorkers = StorageService.getWorkers();

      const restoredPhotoCount =
        restoredProducts.filter((p: any) => p.image).length +
        restoredCustomers.filter((c: any) => c.profilePic).length +
        restoredAgents.filter((a: any) => a.profilePic).length +
        restoredWorkers.filter((w: any) => w.profilePic).length;

      // Dispatch global restoration events so all active React screens re-render with restored items & recovered photos
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brivu_data_restored'));
        window.dispatchEvent(new Event('storage_updated'));
        window.dispatchEvent(new Event('storage'));
      }

      const incomingReceiptsCount = Array.isArray(backupData.receipts) ? backupData.receipts.length : 0;
      const incomingProductsCount = Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts.length : 0;

      return {
        success: true,
        itemCount: {
          receipts: Math.max(incomingReceiptsCount, restoredReceipts.length),
          products: Math.max(incomingProductsCount, restoredProducts.length),
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

  /**
   * Attempts to retrieve a Google Drive access token silently without opening any UI popups.
   */
  async getSilentAccessToken(): Promise<string | null> {
    const account = this.getStoredAccount();
    if (!account || !account.connected) return null;

    if (this.isNativeAndroid()) {
      try {
        const res = await GoogleDriveNative.getAccessToken();
        if (res?.accessToken) {
          account.accessToken = res.accessToken;
          account.tokenExpiresAt = Date.now() + 3600 * 1000;
          localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
          return res.accessToken;
        }
      } catch {
        // Fall through to cached token check
      }
    }

    const isExpired = account.tokenExpiresAt ? Date.now() > account.tokenExpiresAt - 120000 : false;
    if (!isExpired && account.accessToken) {
      return account.accessToken;
    }
    return null;
  },

  /**
   * Silently upserts stock items + embedded product photos + business backup into
   * "Brivu Backups/brivu_stock_auto_backup.json" in the user's connected Google Drive.
   */
  async syncStockQuietly(): Promise<boolean> {
    if (this.isDriveSyncSubscriptionRequired()) {
      return false;
    }
    if (stockAutoSyncInFlight) {
      stockAutoSyncQueued = true;
      return false;
    }
    stockAutoSyncInFlight = true;
    try {
      const accessToken = await this.getSilentAccessToken();
      if (!accessToken) return false;

      // Never overwrite cloud auto-backup with an empty snapshot from a fresh/wiped device
      const payload = await StorageService.exportBackupWithEmbeddedPhotos();
      const pAny = payload as any;
      const hasLocalData =
        (Array.isArray(pAny.receipts) && pAny.receipts.length > 0) ||
        (Array.isArray(pAny.inventoryProducts) && pAny.inventoryProducts.length > 0) ||
        (Array.isArray(pAny.customers) && pAny.customers.length > 0) ||
        (Array.isArray(pAny.workers) && pAny.workers.length > 0) ||
        (Array.isArray(pAny.agents) && pAny.agents.length > 0) ||
        (Array.isArray(pAny.inventorySales) && pAny.inventorySales.length > 0) ||
        (Array.isArray(pAny.inventoryExpenses) && pAny.inventoryExpenses.length > 0) ||
        (Array.isArray(pAny.inventoryDebts) && pAny.inventoryDebts.length > 0) ||
        (Array.isArray(pAny.shoppingListItems) && pAny.shoppingListItems.length > 0) ||
        Boolean(pAny.profile?.name && String(pAny.profile.name).trim() !== '');
      if (!hasLocalData) {
        return false;
      }

      const folderId = await this.getOrCreateBrivuFolder(accessToken);
      const photoStats = this.getPhotoStats();
      pAny.photoStats = photoStats;
      const payloadStr = JSON.stringify(payload);
      const now = new Date();
      const formattedSyncTime = formatSyncTimestamp(now);

      // Find existing auto-backup file so Google Drive is updated in-place cleanly
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${folderId}' in parents and name = '${STOCK_AUTO_BACKUP_FILENAME}' and trashed = false`
      )}&spaces=drive&pageSize=1&fields=files(id,name)`;
      const searchRes = await fetch(searchUrl, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let existingFileId: string | null = null;
      if (searchRes.ok) {
        const searchData = await searchRes.json().catch(() => null);
        existingFileId = searchData?.files?.[0]?.id || null;
      }

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      const metadata = existingFileId
        ? {
            name: STOCK_AUTO_BACKUP_FILENAME,
            mimeType: 'application/json',
            description: `Brivu automatic local + Google Drive stock & data backup (${now.toLocaleString()})`,
          }
        : {
            name: STOCK_AUTO_BACKUP_FILENAME,
            mimeType: 'application/json',
            parents: [folderId],
            description: `Brivu automatic local + Google Drive stock & data backup (${now.toLocaleString()})`,
          };

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        payloadStr +
        closeDelimiter;

      const uploadEndpoint = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';

      const uploadRes = await fetch(uploadEndpoint, {
        method: existingFileId ? 'PATCH' : 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: multipartBody,
      });

      if (!uploadRes.ok) return false;

      localStorage.setItem(STORAGE_LAST_SYNC_KEY, formattedSyncTime);
      const account = this.getStoredAccount();
      if (account) {
        account.lastSyncTime = formattedSyncTime;
        localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
      }
      return true;
    } catch {
      return false;
    } finally {
      stockAutoSyncInFlight = false;
      if (stockAutoSyncQueued) {
        stockAutoSyncQueued = false;
        this.scheduleStockAutoSync(1500);
      }
    }
  },

  scheduleStockAutoSync(delayMs = 2500): void {
    if (typeof window === 'undefined') return;
    if (this.isDriveSyncSubscriptionRequired()) return;
    const acc = this.getStoredAccount();
    if (!acc || !acc.connected) return;
    if (stockAutoSyncTimer) clearTimeout(stockAutoSyncTimer);
    stockAutoSyncTimer = setTimeout(() => {
      stockAutoSyncTimer = null;
      this.syncStockQuietly().catch(() => {});
    }, delayMs);
  },

  initAutoSyncListener(): void {
    if (typeof window === 'undefined' || autoSyncListenerAttached) return;
    autoSyncListenerAttached = true;
    window.addEventListener('brivu_inventory_changed', () => {
      this.scheduleStockAutoSync(2500);
    });
  },
};
