import { AppBackupData, CloudflareConfig, CloudflareFileRecord, CloudflareSyncResponse, Receipt, WorkOSUser, WorkOSAuthConfig } from '../types';
import { StorageService } from './storage';

export const DEFAULT_CLOUDFLARE_CONFIG: CloudflareConfig = {
  workerUrl: 'https://brivu.shapesmm7.workers.dev',
  apiKey: '',
  autoSaveFiles: true,
  autoSyncData: true,
  lastStatus: 'connected',
  filesFolder: 'receipts',
};

function normalizeUrl(url: string): string {
  if (!url) return 'https://brivu.shapesmm7.workers.dev';
  let trimmed = url.trim();
  if (!trimmed) return 'https://brivu.shapesmm7.workers.dev';
  // Strip trailing slash
  if (trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  // Ensure http/https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

function parseWorkerResponse(rawText: string): { ok: boolean; data?: any; isStarter?: boolean; error?: string } {
  if (!rawText) {
    return { ok: false, error: 'Empty response from worker' };
  }
  try {
    const data = JSON.parse(rawText);
    return { ok: true, data };
  } catch {
    const isStarter =
      rawText.toLowerCase().includes('hello from brivu') ||
      rawText.toLowerCase().includes('hello world');
    return {
      ok: false,
      isStarter,
      error: isStarter
        ? 'Worker is running the starter template ("Hello from Brivu!"). The Brivu backend code has not been deployed yet.'
        : `Worker returned non-JSON text: ${rawText.slice(0, 120)}`,
    };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function sanitizeBackupForD1Sync(data: AppBackupData): AppBackupData {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    receipts: (data.receipts || []).map((r) => ({
      ...r,
      businessSnapshot: r.businessSnapshot
        ? {
            ...r.businessSnapshot,
            logo: r.businessSnapshot.logo?.startsWith('data:') ? undefined : r.businessSnapshot.logo,
            signature: r.businessSnapshot.signature?.startsWith('data:') ? undefined : r.businessSnapshot.signature,
          }
        : r.businessSnapshot,
    })),
    inventoryProducts: (data.inventoryProducts || []).map((p) => ({
      ...p,
      image: p.image?.startsWith('data:') ? undefined : p.image,
    })),
    customers: (data.customers || []).map((c) => ({
      ...c,
      profilePic: c.profilePic?.startsWith('data:') ? undefined : c.profilePic,
    })),
    agents: (data.agents || []).map((a) => ({
      ...a,
      profilePic: a.profilePic?.startsWith('data:') ? undefined : a.profilePic,
    })),
    workers: (data.workers || []).map((w) => ({
      ...w,
      profilePic: w.profilePic?.startsWith('data:') ? undefined : w.profilePic,
    })),
    qrHostedPages: (data.qrHostedPages || []).map((page) => ({
      ...page,
      coverImage: page.coverImage?.startsWith('data:') ? undefined : page.coverImage,
      logo: page.logo?.startsWith('data:') ? undefined : page.logo,
      photos: (page.photos || [])
        .map((photo) => ({
          ...photo,
          url: photo.url?.startsWith('data:') ? '' : photo.url,
        }))
        .filter((photo) => Boolean(photo.url)),
      menuItems: (page.menuItems || []).map((item) => ({
        ...item,
        photoUrl: item.photoUrl?.startsWith('data:') ? undefined : item.photoUrl,
      })),
    })),
    eventsQrItems: (data.eventsQrItems || []).map((evt) => ({
      ...evt,
      photos: (evt.photos || []).filter((p) => Boolean(p)),
    })),
    websitesQrItems: data.websitesQrItems || [],
    socialsQrItems: data.socialsQrItems || [],
  };
}

export const CloudflareService = {
  getConfig(): CloudflareConfig {
    const config = StorageService.getCloudflareConfig();
    if (!config.workerUrl || config.workerUrl.trim() === '') {
      config.workerUrl = DEFAULT_CLOUDFLARE_CONFIG.workerUrl;
    }
    return config;
  },

  saveConfig(partial: Partial<CloudflareConfig>): CloudflareConfig {
    const current = this.getConfig();
    const updated: CloudflareConfig = {
      ...current,
      ...partial,
      workerUrl: partial.workerUrl !== undefined ? normalizeUrl(partial.workerUrl) : current.workerUrl,
    };
    return StorageService.saveCloudflareConfig(updated);
  },

  isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config.workerUrl && config.workerUrl.trim().length > 0);
  },

  shouldAutoSaveFiles(): boolean {
    const config = this.getConfig();
    if (!this.isConfigured() || config.autoSaveFiles === false) {
      return false;
    }
    // Users signed in with Google or users with active trial/subscription can save files to Cloudflare
    const user = StorageService.getWorkOSUser();
    if (user && user.email) {
      return true;
    }
    const trial = StorageService.getTrialStatus();
    return !trial.isExpired || Boolean(trial.subscribed);
  },

  shouldAutoSyncData(): boolean {
    // All users should log in to save their data to cloud
    const user = StorageService.getWorkOSUser();
    if (!user || !user.email) {
      return false; // When not logged in, all data is saved to local storage
    }
    const trial = StorageService.getTrialStatus();
    if (trial.isExpired && !trial.subscribed) {
      return false; // Stop syncing database to cloud after trial expires unless subscribed
    }
    const config = this.getConfig();
    return this.isConfigured() && config.autoSyncData !== false;
  },

  getAuthHeaders(apiKey?: string): Record<string, string> {
    const config = this.getConfig();
    const key = apiKey !== undefined ? apiKey : config.apiKey;
    const headers: Record<string, string> = {};
    if (key && key.trim() !== '') {
      headers['X-Sync-Key'] = key.trim();
      headers['Authorization'] = `Bearer ${key.trim()}`;
    }
    const user = StorageService.getWorkOSUser();
    if (user && user.email) {
      const cleanEmail = user.email.toLowerCase().trim();
      headers['X-User-Email'] = cleanEmail;
      headers['X-User-Id'] = cleanEmail;
    }
    return headers;
  },

  /**
   * Tests connection to the Cloudflare Worker, verifying D1 and R2 availability
   */
  async testConnection(
    urlOverride?: string,
    apiKeyOverride?: string
  ): Promise<{
    success: boolean;
    d1Bound: boolean;
    r2Bound: boolean;
    isStarterTemplate?: boolean;
    message: string;
    statusDetails?: any;
  }> {
    const config = this.getConfig();
    const targetUrl = normalizeUrl(urlOverride || config.workerUrl);

    if (!targetUrl) {
      return {
        success: false,
        d1Bound: false,
        r2Bound: false,
        message: 'No Cloudflare Worker URL provided',
      };
    }

    try {
      const headers = this.getAuthHeaders(apiKeyOverride);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${targetUrl}/api/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const rawText = await res.text().catch(() => '');
      const parsed = parseWorkerResponse(rawText);

      if (parsed.isStarter) {
        const starterMsg =
          'Worker URL reached! It is currently running Cloudflare\'s starter template ("' +
          rawText.trim() +
          '"). The Brivu backend code has not been deployed to this worker yet.';
        this.saveConfig({
          lastStatus: 'error',
          lastErrorMessage: starterMsg,
        });
        return {
          success: false,
          isStarterTemplate: true,
          d1Bound: false,
          r2Bound: false,
          message: starterMsg,
        };
      }

      if (!res.ok) {
        let errorMsg = `Worker responded with HTTP ${res.status}`;
        if (parsed.ok && parsed.data?.error) {
          errorMsg = parsed.data.error;
        } else if (rawText) {
          errorMsg = rawText;
        }

        this.saveConfig({
          lastStatus: 'error',
          lastErrorMessage: errorMsg,
        });

        return {
          success: false,
          d1Bound: false,
          r2Bound: false,
          message: errorMsg,
        };
      }

      if (!parsed.ok) {
        const errorMsg = parsed.error || `Worker returned non-JSON response: ${rawText.slice(0, 100)}`;
        this.saveConfig({
          lastStatus: 'error',
          lastErrorMessage: errorMsg,
        });
        return {
          success: false,
          d1Bound: false,
          r2Bound: false,
          message: errorMsg,
        };
      }

      const data = parsed.data;
      const d1Bound = Boolean(data.d1Bound || data.storage?.d1 === 'connected');
      const r2Bound = Boolean(data.r2Bound || data.storage?.r2 === 'connected');

      let summaryNote = 'Worker connected successfully!';
      if (!d1Bound && !r2Bound) {
        summaryNote = 'Worker connected, but neither D1 nor R2 bindings are attached yet.';
      } else if (!d1Bound) {
        summaryNote = 'Worker connected with R2 file storage active (D1 database not bound yet).';
      } else if (!r2Bound) {
        summaryNote = 'Worker connected with D1 database active (R2 storage not bound yet).';
      } else {
        summaryNote = 'Worker, D1 database, and R2 storage are all fully operational!';
      }

      this.saveConfig({
        lastStatus: 'connected',
        lastErrorMessage: undefined,
      });

      return {
        success: true,
        d1Bound,
        r2Bound,
        message: summaryNote,
        statusDetails: data,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const readable = errMsg.includes('abort') ? 'Connection timed out (10s)' : errMsg;

      this.saveConfig({
        lastStatus: 'error',
        lastErrorMessage: readable,
      });

      return {
        success: false,
        d1Bound: false,
        r2Bound: false,
        message: `Could not reach Cloudflare Worker: ${readable}`,
      };
    }
  },

  /**
   * Uploads a file (PDF, image, backup JSON) to Cloudflare R2 via the worker
   */
  async uploadFile(options: {
    data: Blob | ArrayBuffer | string;
    filename: string;
    mimeType?: string;
    folder?: string;
    force?: boolean;
  }): Promise<{
    success: boolean;
    url?: string;
    key?: string;
    filename?: string;
    size?: number;
    message: string;
  }> {
    const isManualOrDiagnostic = Boolean(
      options.force ||
      options.folder === 'diagnostics' ||
      options.folder === 'manual_uploads'
    );
    if (!isManualOrDiagnostic && !this.shouldAutoSaveFiles()) {
      return {
        success: false,
        message: 'Cloudflare auto-save files is disabled (trial expired, or toggled off)',
      };
    }

    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloudflare Worker is not configured. Go to Settings to set it up.',
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        message: 'Device is offline. File saved locally.',
      };
    }

    const { filename, mimeType = 'application/octet-stream', folder = config.filesFolder || 'receipts' } = options;
    const { data } = options;

    try {
      const headers = this.getAuthHeaders();
      const cleanBaseUrl = normalizeUrl(config.workerUrl);
      const targetUrl = `${cleanBaseUrl}/api/files/upload`;

      let response: Response;

      let payloadBase64 = '';
      if (typeof data === 'string') {
        payloadBase64 = data;
      } else if (data instanceof ArrayBuffer) {
        payloadBase64 = arrayBufferToBase64(data);
      } else if (data instanceof Blob) {
        payloadBase64 = await blobToBase64(data);
      } else {
        return {
          success: false,
          message: 'Unsupported data format for Cloudflare upload',
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename,
            data: payloadBase64,
            mimeType,
            folder,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const rawText = await response.text().catch(() => response.statusText || '');
      const parsed = parseWorkerResponse(rawText);

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status} upload failed`;
        if (parsed.ok && parsed.data?.error) {
          errorMsg = parsed.data.error;
        } else if (parsed.error) {
          errorMsg = parsed.error;
        } else if (rawText) {
          errorMsg = rawText;
        }
        return {
          success: false,
          message: errorMsg,
        };
      }

      if (!parsed.ok) {
        return {
          success: false,
          message: parsed.error || 'Invalid response from Cloudflare Worker',
        };
      }

      const result = parsed.data || {};
      return {
        success: true,
        url: result.url,
        key: result.key,
        filename: result.filename || filename,
        size: result.size,
        message: result.message || `File ${filename} saved to Cloudflare R2`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const readable = errMsg.includes('abort')
        ? 'Upload timed out (15s)'
        : errMsg === 'Failed to fetch'
        ? 'Cloudflare Worker unreachable or CORS blocked. Ensure Worker URL is valid.'
        : errMsg;
      console.warn('Cloudflare file upload note:', readable);
      return {
        success: false,
        message: `Cloudflare upload note: ${readable}`,
      };
    }
  },

  /**
   * Syncs all application data (profile, settings, receipts, inventory, staff) to Cloudflare D1
   */
  async syncAllToCloudflare(customBackup?: AppBackupData): Promise<CloudflareSyncResponse> {
    if (!this.shouldAutoSyncData()) {
      return {
        success: false,
        message: 'Cloudflare auto-sync is disabled (trial expired or not subscribed)',
      };
    }

    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloudflare Worker is not configured. Set up the worker URL in Settings.',
      };
    }

    try {
      const rawBackup = customBackup || StorageService.exportBackup();
      const backupData = sanitizeBackupForD1Sync(rawBackup);
      const headers = this.getAuthHeaders();
      const user = StorageService.getWorkOSUser();
      const userEmail = (user?.email || '').toLowerCase().trim();
      const query = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
      const targetUrl = `${config.workerUrl}/api/sync/push${query}`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupData, userEmail, user }),
      });

      const rawText = await response.text().catch(() => response.statusText || '');
      const parsed = parseWorkerResponse(rawText);

      if (!response.ok) {
        let errorMsg = `Sync failed with HTTP ${response.status}`;
        if (parsed.ok && parsed.data?.error) {
          errorMsg = parsed.data.error;
        } else if (parsed.error) {
          errorMsg = parsed.error;
        } else if (rawText) {
          errorMsg = rawText;
        }
        return {
          success: false,
          message: errorMsg,
          error: errorMsg,
        };
      }

      if (!parsed.ok) {
        return {
          success: false,
          message: parsed.error || 'Failed to parse sync response',
          error: parsed.error,
        };
      }

      const result = parsed.data || {};
      const now = new Date().toISOString();

      this.saveConfig({
        lastSyncAt: now,
        lastStatus: 'connected',
        lastErrorMessage: undefined,
      });

      return {
        success: true,
        message: result.message || 'All records successfully saved to Cloudflare D1',
        timestamp: result.timestamp || now,
        receiptsSaved: result.receiptsSaved || backupData.receipts.length,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Cloudflare D1 sync note:', errMsg);
      return {
        success: false,
        message: `Cloudflare D1 sync note: ${errMsg}`,
        error: errMsg,
      };
    }
  },

  /**
   * Directly saves a single receipt or invoice to Cloudflare D1
   */
  async saveReceipt(receipt: Receipt): Promise<{ success: boolean; message: string }> {
    if (!this.shouldAutoSyncData()) {
      return { success: false, message: 'Cloudflare auto-sync is disabled (trial expired or not subscribed)' };
    }

    const config = this.getConfig();
    if (!this.isConfigured()) {
      return { success: false, message: 'Cloudflare Worker is not configured' };
    }
    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/receipts`;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receipt),
      });

      const rawText = await response.text().catch(() => '');
      const parsed = parseWorkerResponse(rawText);

      if (!response.ok) {
        return {
          success: false,
          message: parsed.data?.error || `HTTP ${response.status} saving receipt to Cloudflare`,
        };
      }

      this.saveConfig({
        lastSyncAt: new Date().toISOString(),
        lastStatus: 'connected',
      });

      return {
        success: true,
        message: parsed.data?.message || `Receipt ${receipt.receiptNumber} saved to Cloudflare D1`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Cloudflare receipt save error: ${errMsg}`,
      };
    }
  },

  /**
   * Deletes a receipt from Cloudflare D1 and synchronizes latest state
   */
  async deleteReceipt(id: string): Promise<{ success: boolean; message?: string }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return { success: false, message: 'Cloudflare Worker is not configured' };
    }
    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/receipts/${encodeURIComponent(id)}`;
      const response = await fetch(targetUrl, {
        method: 'DELETE',
        headers,
      });
      // Also push full updated state to be 100% sure D1 backup tables are in sync
      await this.syncAllToCloudflare().catch(() => {});
      return { success: response.ok };
    } catch (err) {
      console.warn('Cloudflare delete note:', err);
      await this.syncAllToCloudflare().catch(() => {});
      return { success: false };
    }
  },

  /**
   * Pulls data from Cloudflare D1 and restores it into local storage
   */
  async pullFromCloudflare(emailOverride?: string): Promise<{
    success: boolean;
    message: string;
    count?: number;
    data?: AppBackupData;
  }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloudflare Worker is not configured',
      };
    }

    try {
      const headers = this.getAuthHeaders();
      const user = StorageService.getWorkOSUser();
      const email = (emailOverride || user?.email || '').toLowerCase().trim();
      const query = email ? `?email=${encodeURIComponent(email)}` : '';
      const targetUrl = `${config.workerUrl}/api/sync/pull${query}`;

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      const rawText = await response.text().catch(() => response.statusText || '');
      const parsed = parseWorkerResponse(rawText);

      if (!response.ok) {
        let errorMsg = `Pull failed with HTTP ${response.status}`;
        if (parsed.ok && parsed.data?.error) {
          errorMsg = parsed.data.error;
        } else if (parsed.error) {
          errorMsg = parsed.error;
        } else if (rawText) {
          errorMsg = rawText;
        }
        return {
          success: false,
          message: errorMsg,
        };
      }

      if (!parsed.ok) {
        return {
          success: false,
          message: parsed.error || 'Failed to parse Cloudflare D1 data',
        };
      }

      const result = parsed.data || {};
      const rawBackupData: AppBackupData | undefined =
        result?.backupData || result?.data?.backupData || (result?.receipts ? result : undefined);

      if (!rawBackupData) {
        return {
          success: false,
          message: 'No backup records found on Cloudflare',
        };
      }

      const importResult = StorageService.importBackup(rawBackupData);
      if (importResult.success) {
        this.saveConfig({
          lastSyncAt: new Date().toISOString(),
          lastStatus: 'connected',
        });
        const receiptsCount = rawBackupData.receipts?.length || 0;
        const productsCount = rawBackupData.inventoryProducts?.length || 0;
        return {
          success: true,
          message: `Successfully restored ${receiptsCount} receipts & ${productsCount} inventory products from Cloudflare!`,
          count: receiptsCount,
          data: rawBackupData,
        };
      } else {
        return {
          success: false,
          message: `Restore error: ${importResult.message}`,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to pull from Cloudflare: ${errMsg}`,
      };
    }
  },

  /**
   * Saves a single receipt to Cloudflare D1 in the background
   */
  async saveSingleReceipt(receipt: Receipt): Promise<{ success: boolean; message: string }> {
    if (!this.shouldAutoSyncData()) {
      return { success: false, message: 'Cloudflare auto-sync is disabled' };
    }

    const config = this.getConfig();
    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/receipts`;

      const cleanReceipt = {
        ...receipt,
        businessSnapshot: receipt.businessSnapshot
          ? {
              ...receipt.businessSnapshot,
              logo: receipt.businessSnapshot.logo?.startsWith('data:') ? undefined : receipt.businessSnapshot.logo,
              signature: receipt.businessSnapshot.signature?.startsWith('data:') ? undefined : receipt.businessSnapshot.signature,
            }
          : receipt.businessSnapshot,
      };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanReceipt),
      });

      if (!response.ok) {
        return { success: false, message: `HTTP ${response.status}` };
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Receipt synced to Cloudflare D1',
      };
    } catch (err) {
      // Quiet fail in background
      return { success: false, message: String(err) };
    }
  },

  /**
   * Lists files saved in Cloudflare R2
   */
  async listFiles(prefix?: string): Promise<CloudflareFileRecord[]> {
    const config = this.getConfig();
    if (!this.isConfigured()) return [];

    try {
      const headers = this.getAuthHeaders();
      const queryParam = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
      const targetUrl = `${config.workerUrl}/api/files${queryParam}`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      if (!res.ok) return [];
      const rawText = await res.text().catch(() => '');
      const parsed = parseWorkerResponse(rawText);
      if (!parsed.ok) return [];
      return parsed.data?.files || [];
    } catch (err) {
      console.warn('Failed to list files from Cloudflare:', err);
      return [];
    }
  },

  /**
   * Deletes a file from Cloudflare R2
   */
  async deleteFile(key: string): Promise<boolean> {
    const config = this.getConfig();
    if (!this.isConfigured()) return false;

    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/files/${encodeURIComponent(key)}`;

      const res = await fetch(targetUrl, {
        method: 'DELETE',
        headers,
      });

      return res.ok;
    } catch (err) {
      console.warn('Failed to delete file from Cloudflare:', err);
      return false;
    }
  },

  /**
   * Fetches a specific hosted QR page directly from Cloudflare
   */
  async getHostedQrPage(pageId: string): Promise<any | null> {
    const config = this.getConfig();
    if (!this.isConfigured()) return null;

    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/qr/${encodeURIComponent(pageId)}`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      if (!res.ok) return null;
      const raw = await res.text().catch(() => '');
      const parsed = parseWorkerResponse(raw);
      if (parsed.ok && parsed.data?.page) {
        return parsed.data.page;
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch hosted QR page from Cloudflare:', err);
      return null;
    }
  },

  /**
   * Saves or updates a hosted QR page directly in Cloudflare D1
   */
  async saveSingleQrPage(page: any): Promise<{ success: boolean; message: string }> {
    if (!this.shouldAutoSyncData()) {
      return { success: false, message: 'Cloudflare auto-sync is disabled (trial expired or not subscribed)' };
    }

    const config = this.getConfig();
    if (!this.isConfigured()) {
      return { success: false, message: 'Cloudflare Worker is not configured' };
    }

    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/qr`;

      const cleanPage = {
        ...page,
        coverImage: page.coverImage?.startsWith('data:') ? undefined : page.coverImage,
        logo: page.logo?.startsWith('data:') ? undefined : page.logo,
        photos: (page.photos || [])
          .map((photo: any) => ({
            ...photo,
            url: photo.url?.startsWith('data:') ? '' : photo.url,
          }))
          .filter((photo: any) => Boolean(photo.url)),
        menuItems: (page.menuItems || []).map((item: any) => ({
          ...item,
          photoUrl: item.photoUrl?.startsWith('data:') ? undefined : item.photoUrl,
        })),
        websitesQrItems: page.websitesQrItems || [],
        socialsQrItems: page.socialsQrItems || [],
      };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanPage),
      });

      const rawText = await response.text().catch(() => '');
      const parsed = parseWorkerResponse(rawText);

      if (!response.ok) {
        return {
          success: false,
          message: parsed.data?.error || `HTTP ${response.status} saving QR page to Cloudflare`,
        };
      }

      return {
        success: true,
        message: parsed.data?.message || `QR Page ${page.title || page.id} saved to Cloudflare`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Cloudflare QR save error: ${errMsg}`,
      };
    }
  },

  /**
   * Deletes a hosted QR page from Cloudflare D1
   */
  async deleteHostedQrPage(pageId: string): Promise<boolean> {
    const config = this.getConfig();
    if (!this.isConfigured()) return false;
    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/qr/${encodeURIComponent(pageId)}`;
      const res = await fetch(targetUrl, {
        method: 'DELETE',
        headers,
      });
      await this.syncAllToCloudflare().catch(() => {});
      return res.ok;
    } catch (err) {
      console.warn('Failed to delete hosted QR page from Cloudflare:', err);
      await this.syncAllToCloudflare().catch(() => {});
      return false;
    }
  },

  /**
   * Sync user profile, data, and email to Cloudflare
   */
  async syncUserProfile(user: WorkOSUser, businessProfile?: any): Promise<CloudflareSyncResponse> {
    const config = this.getConfig();
    const cleanUrl = normalizeUrl(config.workerUrl);
    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';

      const payload = {
        user: {
          ...user,
          syncedToCloudflare: true,
          cloudflareStoredAt: new Date().toISOString(),
        },
        businessProfile: businessProfile || StorageService.getProfile(),
        appData: {
          receiptsCount: StorageService.getReceipts().length,
          lastSync: new Date().toISOString(),
        },
      };

      const res = await fetch(`${cleanUrl}/api/user/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok) {
        return {
          success: true,
          message: 'User profile, email & data stored in Cloudflare',
          timestamp: new Date().toISOString(),
          data: parsed.data,
        };
      } else {
        return {
          success: false,
          message: parsed.error || `HTTP ${res.status} storing user profile in Cloudflare`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Cloudflare user profile sync error: ${err?.message || err}`,
      };
    }
  },

  /**
   * Fetch WorkOS Auth configuration from Cloudflare Worker
   */
  async getWorkOSConfig(codeChallenge?: string): Promise<WorkOSAuthConfig> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl = currentOrigin && currentOrigin.includes('workers.dev')
      ? normalizeUrl(currentOrigin)
      : normalizeUrl(config.workerUrl);
    try {
      const headers = this.getAuthHeaders();
      if (config.overrideWorkosKeys && config.customWorkosClientId) {
        headers['X-WorkOS-Client-Id'] = config.customWorkosClientId;
      }
      if (config.overrideWorkosKeys && config.customWorkosApiKey) {
        headers['X-WorkOS-Api-Key'] = config.customWorkosApiKey;
      }

      const desiredRedirect = `${cleanUrl}/callback`;
      let authEndpoint = `${cleanUrl}/api/auth/workos/authorize?redirect_uri=${encodeURIComponent(desiredRedirect)}`;
      if (codeChallenge) {
        authEndpoint += `&code_challenge=${encodeURIComponent(codeChallenge)}`;
      }

      const res = await fetch(authEndpoint, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        return {
          clientId: data.clientId || 'client_01M4BGNT60CPMEA9P83WD6NRSB',
          apiKeyConfigured: Boolean(data.configured),
          authUrl: data.authUrl || '',
          redirectUri: window.location.origin,
          workerUrl: cleanUrl,
          cloudflareClientIdConfigured: data.cloudflareClientIdConfigured,
          cloudflareApiKeyConfigured: data.cloudflareApiKeyConfigured,
          isUsingFallback: data.isUsingFallback,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch WorkOS config from Cloudflare:', err);
    }
    const defaultClientId = config.overrideWorkosKeys && config.customWorkosClientId ? config.customWorkosClientId : 'client_01M4BGNT60CPMEA9P83WD6NRSB';
    const callbackUri = `${cleanUrl.replace(/\/$/, '')}/callback`;
    let defaultAuthUrl = `https://api.workos.com/user_management/authorize?response_type=code&client_id=${encodeURIComponent(defaultClientId)}&redirect_uri=${encodeURIComponent(callbackUri)}&provider=GoogleOAuth`;
    if (codeChallenge) {
      defaultAuthUrl += `&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
    }
    return {
      clientId: defaultClientId,
      apiKeyConfigured: true,
      authUrl: defaultAuthUrl,
      redirectUri: callbackUri,
      workerUrl: cleanUrl,
      cloudflareClientIdConfigured: false,
      cloudflareApiKeyConfigured: false,
      isUsingFallback: true,
    };
  },

  /**
   * Exchange WorkOS Auth code via Cloudflare Worker (with PKCE support)
   */
  async authenticateWorkOSCode(code: string, redirectUri?: string, codeVerifier?: string): Promise<{ success: boolean; user?: WorkOSUser; message?: string }> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl = currentOrigin && currentOrigin.includes('workers.dev')
      ? normalizeUrl(currentOrigin)
      : normalizeUrl(config.workerUrl);

    const resolvedVerifier = codeVerifier || (typeof window !== 'undefined' ? localStorage.getItem('workos_pkce_verifier') || sessionStorage.getItem('workos_pkce_verifier') || undefined : undefined);
    const effectiveClientId = config.overrideWorkosKeys && config.customWorkosClientId ? config.customWorkosClientId : 'client_01M4BGNT60CPMEA9P83WD6NRSB';

    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';
      if (config.overrideWorkosKeys && config.customWorkosClientId) {
        headers['X-WorkOS-Client-Id'] = config.customWorkosClientId;
      }
      if (config.overrideWorkosKeys && config.customWorkosApiKey) {
        headers['X-WorkOS-Api-Key'] = config.customWorkosApiKey;
      }

      const res = await fetch(`${cleanUrl}/api/auth/workos/authenticate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code,
          codeVerifier: resolvedVerifier,
          redirectUri: redirectUri || window.location.origin,
          workosClientId: config.overrideWorkosKeys ? config.customWorkosClientId : undefined,
          workosApiKey: config.overrideWorkosKeys ? config.customWorkosApiKey : undefined,
        }),
      });

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok && parsed.data?.user) {
        return {
          success: true,
          user: parsed.data.user,
          message: 'Authenticated successfully with WorkOS & Cloudflare',
        };
      }

      // If worker returned an error and resolvedVerifier is available, try direct WorkOS PKCE exchange
      if (resolvedVerifier) {
        try {
          const directRes = await fetch('https://api.workos.com/user_management/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: effectiveClientId,
              code,
              code_verifier: resolvedVerifier,
              grant_type: 'authorization_code',
            }),
          });
          if (directRes.ok) {
            const wData = await directRes.json();
            const u = wData.user || wData;
            const firstName = u.first_name || u.firstName || '';
            const lastName = u.last_name || u.lastName || '';
            const user: WorkOSUser = {
              id: u.id || `workos_usr_${Date.now()}`,
              email: u.email || '',
              firstName,
              lastName,
              name: (u.name || `${firstName} ${lastName}`.trim() || u.email || 'Google User').trim(),
              profilePictureUrl: u.profile_picture_url || u.profilePictureUrl || u.avatar_url || '',
              emailVerified: u.email_verified ?? u.emailVerified ?? true,
              provider: 'google',
              updatedAt: new Date().toISOString(),
              syncedToCloudflare: false,
            };
            return {
              success: true,
              user,
              message: 'Authenticated successfully with Google & WorkOS',
            };
          }
        } catch (_) {}
      }

      return {
        success: false,
        message: parsed.error || parsed.data?.error || 'Authentication failed',
      };
    } catch (err: any) {
      // Direct PKCE fallback in case worker is completely unreachable
      if (resolvedVerifier) {
        try {
          const directRes = await fetch('https://api.workos.com/user_management/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: effectiveClientId,
              code,
              code_verifier: resolvedVerifier,
              grant_type: 'authorization_code',
            }),
          });
          if (directRes.ok) {
            const wData = await directRes.json();
            const u = wData.user || wData;
            const firstName = u.first_name || u.firstName || '';
            const lastName = u.last_name || u.lastName || '';
            const user: WorkOSUser = {
              id: u.id || `workos_usr_${Date.now()}`,
              email: u.email || '',
              firstName,
              lastName,
              name: (u.name || `${firstName} ${lastName}`.trim() || u.email || 'Google User').trim(),
              profilePictureUrl: u.profile_picture_url || u.profilePictureUrl || u.avatar_url || '',
              emailVerified: u.email_verified ?? u.emailVerified ?? true,
              provider: 'google',
              updatedAt: new Date().toISOString(),
              syncedToCloudflare: false,
            };
            return {
              success: true,
              user,
              message: 'Authenticated successfully with Google & WorkOS',
            };
          }
        } catch (_) {}
      }

      return {
        success: false,
        message: err?.message || 'Error authenticating with WorkOS via Cloudflare',
      };
    }
  },

  /**
   * Fetch all stored user profiles and emails from Cloudflare
   */
  async getStoredUserProfiles(): Promise<{ success: boolean; users?: WorkOSUser[]; emails?: string[] }> {
    const config = this.getConfig();
    const cleanUrl = normalizeUrl(config.workerUrl);
    try {
      const headers = this.getAuthHeaders();
      const res = await fetch(`${cleanUrl}/api/users/all`, { headers });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          users: data.users || [],
          emails: data.emails || [],
        };
      }
    } catch (err) {
      console.warn('Error fetching users from Cloudflare:', err);
    }
    return { success: false, users: [], emails: [] };
  },
};
