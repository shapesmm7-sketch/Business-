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

function mergeItemsPreservingPhotos<T extends Record<string, any>>(existing: T[], incoming: T[], photoField: string, backupPhotoField: string): T[] {
  const map = new Map<string, T>();
  for (const item of existing || []) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of incoming || []) {
    if (!item || !item.id) continue;
    const prev = map.get(item.id);
    if (prev) {
      map.set(item.id, {
        ...prev,
        ...item,
        [photoField]: item[photoField] || prev[photoField],
        [backupPhotoField]: item[backupPhotoField] || prev[backupPhotoField],
      });
    } else {
      map.set(item.id, item);
    }
  }
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
   * Switches the active Google account.
   * On Android: Signs out active session first then launches Google Play Services account chooser.
   * On Web: Revokes session and prompts account selection.
   */
  async switchGoogleAccount(): Promise<GoogleDriveAccount> {
    if (this.isNativeAndroid()) {
      try {
        const res = await GoogleDriveNative.switchGoogleAccount();
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
    error?: string;
  }> {
    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken();
    } catch (authErr: any) {
      return { success: false, error: authErr?.message || 'Please connect your Google Drive account first.' };
    }

    const account = this.getStoredAccount();
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
        `((name contains 'brivu_backup' or name contains 'Brivu_Backup') and mimeType != 'application/vnd.google-apps.folder' and trashed = false)`
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
      (a, b) => new Date(a.modifiedTime || a.createdTime).getTime() - new Date(b.modifiedTime || b.createdTime).getTime()
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
          const data = await res.json();
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
                (consolidatedBackup.receipts || []).forEach((r: any) => { if (r?.id) map.set(r.id, r); });
                data.receipts.forEach((r: any) => { if (r?.id) map.set(r.id, r); });
                consolidatedBackup.receipts = Array.from(map.values());
              }

              // Inventory Products: merge by id while NEVER losing an existing image or imageBackupData
              if (Array.isArray(data.inventoryProducts)) {
                consolidatedBackup.inventoryProducts = mergeItemsPreservingPhotos(
                  consolidatedBackup.inventoryProducts || [],
                  data.inventoryProducts,
                  'image',
                  'imageBackupData'
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

              if (Array.isArray(data.inventorySales)) {
                const map = new Map<string, any>();
                (consolidatedBackup.inventorySales || []).forEach((s: any) => { if (s?.id) map.set(s.id, s); });
                data.inventorySales.forEach((s: any) => { if (s?.id) map.set(s.id, s); });
                consolidatedBackup.inventorySales = Array.from(map.values());
              }

              if (Array.isArray(data.inventoryExpenses)) {
                const map = new Map<string, any>();
                (consolidatedBackup.inventoryExpenses || []).forEach((e: any) => { if (e?.id) map.set(e.id, e); });
                data.inventoryExpenses.forEach((e: any) => { if (e?.id) map.set(e.id, e); });
                consolidatedBackup.inventoryExpenses = Array.from(map.values());
              }

              if (Array.isArray(data.inventoryDebts)) {
                const map = new Map<string, any>();
                (consolidatedBackup.inventoryDebts || []).forEach((d: any) => { if (d?.id) map.set(d.id, d); });
                data.inventoryDebts.forEach((d: any) => { if (d?.id) map.set(d.id, d); });
                consolidatedBackup.inventoryDebts = Array.from(map.values());
              }

              if (Array.isArray(data.productCategories)) {
                const map = new Map<string, any>();
                (consolidatedBackup.productCategories || []).forEach((c: any) => { if (c?.id) map.set(c.id, c); });
                data.productCategories.forEach((c: any) => { if (c?.id) map.set(c.id, c); });
                consolidatedBackup.productCategories = Array.from(map.values());
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

    const finalResult = this.applyRestoredData(consolidatedBackup, 'replace');
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

      // Count restored photos (after importBackup normalized image fields)
      const restoredProducts = StorageService.getInventoryProducts();
      const restoredCustomers = StorageService.getCustomers();
      const restoredAgents = StorageService.getAgents();
      const restoredWorkers = StorageService.getWorkers();

      const restoredPhotoCount =
        restoredProducts.filter((p: any) => p.image).length +
        restoredCustomers.filter((c: any) => c.profilePic).length +
        restoredAgents.filter((a: any) => a.profilePic).length +
        restoredWorkers.filter((w: any) => w.profilePic).length;

      // Verify remote photo URLs & recover/re-upload any embedded or missing photos asynchronously
      StorageService.recoverRestoredProductPhotos(backupData)
        .then(() => CloudflareService.syncAllToCloudflare().catch(() => {}))
        .catch(() => {
          CloudflareService.syncAllToCloudflare().catch(() => {});
        });

      // Dispatch global restoration events so all active React screens re-render with restored items
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brivu_data_restored'));
        window.dispatchEvent(new Event('storage'));
      }

      return {
        success: true,
        itemCount: {
          receipts: Array.isArray(backupData.receipts) ? backupData.receipts.length : 0,
          products: Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts.length : restoredProducts.length,
          customers: Array.isArray(backupData.customers) ? backupData.customers.length : restoredCustomers.length,
          agents: Array.isArray(backupData.agents) ? backupData.agents.length : restoredAgents.length,
          staff: Array.isArray(backupData.workers) ? backupData.workers.length : restoredWorkers.length,
          photos: restoredPhotoCount,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error restoring data from Google Drive' };
    }
  },
};
