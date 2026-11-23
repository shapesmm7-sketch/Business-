import { AppBackupData, CloudflareConfig, CloudflareFileRecord, CloudflareSyncResponse, Receipt, BrivuUser, BrivuAuthConfig } from '../types';
import { StorageService } from './storage';
import { optimizeImageForR2 } from '../utils/imageCompressor';

export interface StorageQuotaInfo {
  usedBytes: number;
  limitBytes: number;
  usedMB: number;
  limitMB: number;
  percent: number;
  isExceeded: boolean;
  warning?: string | null;
}

export const ALLOWED_CLOUDFLARE_R2_FOLDERS = new Set([
  'photos',
  'menu',
  'events',
  'signatures',
  'avatars',
  'manual_uploads',
]);

export function isAllowedCloudflareR2Upload(
  folder?: string,
  mimeType = '',
  filename = ''
): boolean {
  const lowerFolder = String(folder || '').toLowerCase().trim();
  if (!lowerFolder || !ALLOWED_CLOUDFLARE_R2_FOLDERS.has(lowerFolder)) {
    return false;
  }

  const lowerMime = String(mimeType || '').toLowerCase().trim();
  const lowerName = String(filename || '').toLowerCase().trim();
  const isPdf = lowerMime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage =
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(lowerName);

  if (
    isPdf ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.txt')
  ) {
    return false;
  }

  return isImage;
}

export const DEFAULT_CLOUDFLARE_CONFIG: CloudflareConfig = {
  workerUrl: 'https://brivu.shapesmm.com',
  apiKey: '',
  autoSaveFiles: true,
  autoSyncData: true,
  lastStatus: 'connected',
  filesFolder: 'photos',
};

function normalizeUrl(url: string): string {
  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) return 'https://brivu.shapesmm.com';
  let trimmed = url.trim();
  if (!trimmed || trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) return 'https://brivu.shapesmm.com';
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

function isWorkerHostOrigin(origin: string): boolean {
  return Boolean(origin && (origin.includes('workers.dev') || origin.includes('brivu.shapesmm.com')));
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
  const cleanProfile = data.profile
    ? (() => {
        const { logoBackupData, signatureBackupData, signature, ...rest } = data.profile as any;
        return rest;
      })()
    : data.profile;
  return {
    version: data.version || 1,
    exportedAt: data.exportedAt || new Date().toISOString(),
    brivuUserId: (data as any).brivuUserId,
    profile: cleanProfile,
    settings: data.settings,
    // Inventory, receipts, invoices, and quotations remain strictly in localStorage / Google Drive
    receipts: [],
    deletedReceiptIds: [],
    inventoryProducts: [],
    inventorySales: [],
    inventoryExpenses: [],
    inventoryDebts: [],
    shoppingListItems: [],
    shoppingCategories: [],
    productCategories: [],
    customers: [],
    agents: [],
    workers: [],
    staffAttendance: [],
    staffLosses: [],
    staffSales: [],
    staffIncidents: [],
    // Keep QR Code hosted pages, websites, socials, events, and QR gallery/menu photos synced as-is
    qrHostedPages: (data.qrHostedPages || []).map((page) => ({
      ...page,
      coverImage: page.coverImage,
      logo: page.logo,
      photos: (page.photos || []).filter((photo) => Boolean(photo && photo.url)),
      menuImages: (page.menuImages || []).filter((photo) => Boolean(photo && photo.url)),
      menuItems: (page.menuItems || []).filter((item: any) => item && !String(item.id || '').startsWith('prod-')),
      websitesQrItems: page.websitesQrItems || [],
      socialsQrItems: page.socialsQrItems || [],
      eventsQrItems: page.eventsQrItems || [],
    })),
    eventsQrItems: (data.eventsQrItems || []).map((evt) => ({
      ...evt,
      photos: (evt.photos || []).filter((p) => Boolean(p)),
    })),
    websitesQrItems: data.websitesQrItems || [],
    socialsQrItems: data.socialsQrItems || [],
  };
}

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncPendingResolvers: Array<(res: CloudflareSyncResponse) => void> = [];
let syncInFlightPromise: Promise<CloudflareSyncResponse> | null = null;
let syncCooldownUntil = 0;
let consecutiveSyncFailures = 0;
const pullInFlightMap = new Map<string, Promise<{ success: boolean; message: string; count?: number; data?: AppBackupData }>>();

interface PendingQrSave {
  page: any;
  emailOverride?: string;
  timer: ReturnType<typeof setTimeout> | null;
  resolvers: Array<(res: { success: boolean; message: string }) => void>;
}
const pendingQrSaves = new Map<string, PendingQrSave>();

function getQrSaveQueueKey(page: any, userEmail: string): string {
  const rawType = String(page?.pageType || '').toLowerCase();
  const rawId = String(page?.id || '').toLowerCase();
  if (rawType.includes('website') || rawId.includes('website')) return `${userEmail}::websites`;
  if (rawType.includes('social') || rawId.includes('social')) return `${userEmail}::socials`;
  if (rawType === 'event' || (rawId.startsWith('event-') && !rawId.startsWith('events-hub') && !rawId.startsWith('event-hub'))) {
    return `${userEmail}::event::${rawId}`;
  }
  if (rawType.includes('event') || rawId.includes('event')) return `${userEmail}::events`;
  return `${userEmail}::business`;
}

function isWorkerOverloadResponse(status: number, rawText: string): boolean {
  const lower = (rawText || '').toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    status === 529 ||
    lower.includes('cpu time limit') ||
    lower.includes('exceeded') ||
    lower.includes('worker threw exception')
  );
}

export function isQrGalleryPhotoRecord(record: Pick<CloudflareFileRecord, 'key' | 'filename' | 'mimeType' | 'folder'>): boolean {
  const k = String(record?.key || '').toLowerCase();
  const f = String(record?.filename || k.split('/').pop() || '').toLowerCase();
  const folder = String(record?.folder || '').toLowerCase();
  const mime = String(record?.mimeType || '').toLowerCase();

  if (!k) return false;
  if (mime && !mime.startsWith('image/')) {
    if (!/\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f)) return false;
  }
  if (f.endsWith('.pdf') || f.endsWith('.json') || f.endsWith('.csv') || f.endsWith('.txt')) return false;

  const inPhotosFolder = folder === 'photos' || k.includes('/photos/');
  const isQrNamed =
    f.includes('qr_photo') ||
    f.includes('qr_business') ||
    /^(\d+_)?qr_\d+\.(jpg|jpeg|png|webp)$/i.test(f) ||
    /^(\d+_)?qr_photo/i.test(f);

  if (!inPhotosFolder && !isQrNamed) return false;

  if (
    f.includes('logo') ||
    f.includes('signature') ||
    f.includes('product_') ||
    f.includes('customer_') ||
    f.includes('agent_') ||
    f.includes('staff_') ||
    f.includes('event_photo') ||
    f.includes('qr_item') ||
    f.includes('qr_cover')
  ) {
    return false;
  }
  return true;
}

export const CloudflareService = {
  getConfig(): CloudflareConfig {
    const config = StorageService.getCloudflareConfig();
    if (!config.workerUrl || config.workerUrl.trim() === '') {
      config.workerUrl = DEFAULT_CLOUDFLARE_CONFIG.workerUrl;
    }
    const lowerFolder = String(config.filesFolder || '').toLowerCase().trim();
    if (!lowerFolder || !ALLOWED_CLOUDFLARE_R2_FOLDERS.has(lowerFolder)) {
      config.filesFolder = 'photos';
    }
    return config;
  },

  saveConfig(partial: Partial<CloudflareConfig>): CloudflareConfig {
    const current = this.getConfig();
    const rawFolder = partial.filesFolder !== undefined ? partial.filesFolder : current.filesFolder;
    const normalizedFolder =
      rawFolder && ALLOWED_CLOUDFLARE_R2_FOLDERS.has(rawFolder.toLowerCase().trim())
        ? rawFolder.toLowerCase().trim()
        : 'photos';
    const updated: CloudflareConfig = {
      ...current,
      ...partial,
      filesFolder: normalizedFolder,
      workerUrl: partial.workerUrl !== undefined ? normalizeUrl(partial.workerUrl) : current.workerUrl,
    };
    return StorageService.saveCloudflareConfig(updated);
  },

  isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config.workerUrl && config.workerUrl.trim().length > 0);
  },

  getUserEmail(): string {
    const authEmail = StorageService.getAuthenticatedEmail();
    if (authEmail && authEmail.includes('@')) return authEmail.toLowerCase().trim();
    const config = this.getConfig();
    if (config.apiKey && config.apiKey.includes('@')) return config.apiKey.toLowerCase().trim();
    return '';
  },

  shouldAutoSaveFiles(): boolean {
    const userEmail = this.getUserEmail();
    if (!userEmail) return false;
    const config = this.getConfig();
    return Boolean(config.workerUrl && config.workerUrl.trim().length > 0 && config.autoSaveFiles !== false);
  },

  shouldAutoSyncData(): boolean {
    const userEmail = this.getUserEmail();
    if (!userEmail) return false;
    const config = this.getConfig();
    return Boolean(config.workerUrl && config.workerUrl.trim().length > 0 && config.autoSyncData !== false);
  },

  getAuthHeaders(apiKey?: string): Record<string, string> {
    const config = this.getConfig();
    const key = apiKey !== undefined ? apiKey : config.apiKey;
    const headers: Record<string, string> = {};
    if (key && key.trim() !== '') {
      headers['X-Sync-Key'] = key.trim();
      headers['Authorization'] = `Bearer ${key.trim()}`;
    }
    const session = StorageService.getAuthSession();
    if (session?.sessionToken) {
      headers['X-Brivu-Session'] = session.sessionToken;
    }
    const cleanEmail = this.getUserEmail();
    if (cleanEmail) {
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Simple GET request without custom headers prevents cross-origin preflight issues on native Android
      const res = await fetch(`${targetUrl}/api/health`, {
        method: 'GET',
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
    customKey?: string;
    slotId?: string;
    ownerKey?: string;
  }): Promise<{
    success: boolean;
    storageLimitExceeded?: boolean;
    url?: string;
    key?: string;
    filename?: string;
    size?: number;
    message: string;
  }> {
    const isManualOrDiagnostic = Boolean(
      options.force ||
      options.folder === 'manual_uploads'
    );
    if (!isManualOrDiagnostic && !this.shouldAutoSaveFiles()) {
      return {
        success: false,
        message: 'Cloudflare auto-save files is disabled (trial expired, or toggled off)',
      };
    }

    const userEmail = this.getUserEmail();
    const isMenuUpload = (options.folder || '').toLowerCase() === 'menu' && Boolean(options.force);
    const fallbackOwnerKey = (options.ownerKey || '').trim();
    if (!userEmail && !(isMenuUpload && fallbackOwnerKey)) {
      return {
        success: false,
        message: 'Please sign in with Google to host your menu photo online.',
      };
    }

    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloudflare Worker is not configured. Go to Settings to set it up.',
      };
    }

    let { filename, mimeType = 'application/octet-stream', folder = config.filesFolder || 'photos' } = options;
    let { data } = options;

    if (!isAllowedCloudflareR2Upload(folder, mimeType, filename)) {
      return {
        success: false,
        message:
          'Cloudflare R2 only stores photos. Receipts, invoices, quotations, reports, and generated QR PNG/PDF files are created on demand locally.',
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        message: 'Device is offline. File saved locally.',
      };
    }

    const isImage =
      mimeType.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(filename) ||
      (typeof data === 'string' && data.startsWith('data:image/'));

    if (isImage) {
      try {
        const optimized = await optimizeImageForR2(data, folder, filename);
        data = optimized.data;
        mimeType = optimized.mimeType;
        filename = optimized.filename;
      } catch (optErr) {
        console.warn('Image optimization for R2 note:', optErr);
      }
    }

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
            ...(userEmail ? { 'X-User-Email': userEmail, 'X-User-Id': userEmail } : {}),
          },
          body: JSON.stringify({
            filename,
            data: payloadBase64,
            mimeType,
            folder,
            userEmail,
            ...(options.customKey ? { customKey: options.customKey } : {}),
            ...(options.slotId ? { slotId: options.slotId } : {}),
            ...(fallbackOwnerKey ? { ownerKey: fallbackOwnerKey } : {}),
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
        const isStorageExceeded = Boolean(parsed.data?.storageLimitExceeded);
        if (parsed.ok && parsed.data?.error) {
          errorMsg = parsed.data.error;
        } else if (parsed.error) {
          errorMsg = parsed.error;
        } else if (rawText) {
          errorMsg = rawText;
        }
        return {
          success: false,
          storageLimitExceeded: isStorageExceeded,
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
        message: result.message || `File ${filename} saved to Cloud`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const readable = errMsg.includes('abort')
        ? 'Upload timed out (15s)'
        : errMsg === 'Failed to fetch'
        ? 'Cloud service unreachable or blocked. Ensure connection is active.'
        : errMsg;
      console.warn('Cloud file upload note:', readable);
      return {
        success: false,
        message: `Cloud upload note: ${readable}`,
      };
    }
  },

  /**
   * Syncs all application data (profile, settings, receipts, inventory, staff) to Cloudflare D1.
   * Uses trailing debouncing + single-flight coalescing + overload backoff so rapid saves never exhaust Worker CPU limits.
   */
  async syncAllToCloudflare(
    customBackup?: AppBackupData,
    options?: { immediate?: boolean }
  ): Promise<CloudflareSyncResponse> {
    if (!this.shouldAutoSyncData()) {
      return {
        success: false,
        message: 'Cloud auto-sync is disabled (trial expired or not subscribed)',
      };
    }

    const userEmail = this.getUserEmail();
    if (!userEmail) {
      return {
        success: false,
        message: 'Visitor is not logged in: Server sync skipped',
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloud service is not configured. Check your settings.',
      };
    }

    const isImmediate = Boolean(options?.immediate || customBackup);
    if (!isImmediate && Date.now() < syncCooldownUntil) {
      return {
        success: false,
        message: 'Cloud sync paused briefly during rate-limit cooldown',
      };
    }

    if (isImmediate) {
      await this.flushPendingQrSaves().catch(() => {});
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = null;
      }
      const res = await this._executeSyncAllToCloudflare(customBackup);
      if (syncPendingResolvers.length > 0) {
        const resolvers = syncPendingResolvers.splice(0);
        resolvers.forEach((r) => r(res));
      }
      return res;
    }

    return new Promise<CloudflareSyncResponse>((resolve) => {
      syncPendingResolvers.push(resolve);
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
      }
      syncDebounceTimer = setTimeout(async () => {
        syncDebounceTimer = null;
        const resolvers = syncPendingResolvers.splice(0);
        const res = await this._executeSyncAllToCloudflare();
        resolvers.forEach((r) => r(res));
      }, 2500);
    });
  },

  async _executeSyncAllToCloudflare(customBackup?: AppBackupData): Promise<CloudflareSyncResponse> {
    if (syncInFlightPromise && !customBackup) {
      return syncInFlightPromise;
    }

    const run = async (): Promise<CloudflareSyncResponse> => {
      const userEmail = this.getUserEmail();
      const config = this.getConfig();
      if (!userEmail || !this.isConfigured()) {
        return { success: false, message: 'Cloudflare sync skipped' };
      }

      try {
        const rawBackup = customBackup || StorageService.exportBackup();
        const backupData = sanitizeBackupForD1Sync(rawBackup);
        const headers = this.getAuthHeaders();
        const query = `?email=${encodeURIComponent(userEmail)}&user_id=${encodeURIComponent(userEmail)}`;
        const targetUrl = `${normalizeUrl(config.workerUrl)}/api/sync/push${query}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let response: Response;
        try {
          response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'X-User-Email': userEmail,
              'X-User-Id': userEmail,
            },
            signal: controller.signal,
            body: JSON.stringify({ backupData, userEmail, user_id: userEmail, user: StorageService.getAuthUser() }),
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const rawText = await response.text().catch(() => response.statusText || '');
        const parsed = parseWorkerResponse(rawText);

        if (!response.ok) {
          if (isWorkerOverloadResponse(response.status, rawText)) {
            consecutiveSyncFailures += 1;
            const backoffMs = Math.min(300000, 30000 * Math.pow(2, consecutiveSyncFailures - 1));
            syncCooldownUntil = Date.now() + backoffMs;
          }
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

        consecutiveSyncFailures = 0;
        syncCooldownUntil = 0;

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
          message: result.message || 'QR code & business info saved to Cloud',
          timestamp: result.timestamp || now,
          receiptsSaved: 0,
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('Cloud sync note:', errMsg);
        return {
          success: false,
          message: `Cloud sync note: ${errMsg}`,
          error: errMsg,
        };
      }
    };

    if (!customBackup) {
      syncInFlightPromise = run().finally(() => {
        syncInFlightPromise = null;
      });
      return syncInFlightPromise;
    }

    return run();
  },

  /**
   * Receipts, invoices, and quotations are saved strictly in localStorage (and optional Google Drive backup).
   */
  async saveReceipt(_receipt: Receipt): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Saved locally on device storage.',
    };
  },

  /**
   * Receipts, invoices, and quotations are deleted strictly from localStorage.
   */
  async deleteReceipt(_id: string): Promise<{ success: boolean; message?: string }> {
    return { success: true };
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

    const email = (emailOverride || this.getUserEmail() || '').toLowerCase().trim();
    if (!email) {
      return {
        success: false,
        message: 'User email is required to pull cloud backup',
      };
    }

    const existingPull = pullInFlightMap.get(email);
    if (existingPull) {
      return existingPull;
    }

    const runPull = (async () => {
    try {
      const headers = this.getAuthHeaders();
      headers['X-User-Email'] = email;
      headers['X-User-Id'] = email;
      const query = `?email=${encodeURIComponent(email)}&user_id=${encodeURIComponent(email)}&_t=${Date.now()}`;
      const targetUrl = `${normalizeUrl(config.workerUrl)}/api/sync/pull${query}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          method: 'GET',
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
          message: 'No backup records found on Cloud for this account',
        };
      }

      // Non-destructive QR-only merge: restore QR pages, websites, socials, events, and safe business info
      // without touching local receipts, invoices, quotations, or inventory records.
      const safeIncomingProfile = rawBackupData.profile
        ? (() => {
            const { signature, signatureBackupData, ...rest } = rawBackupData.profile as any;
            return rest;
          })()
        : undefined;

      const qrOnlyBackup: AppBackupData = {
        version: rawBackupData.version || 1,
        exportedAt: rawBackupData.exportedAt || new Date().toISOString(),
        profile: safeIncomingProfile,
        settings: undefined as any,
        receipts: undefined as any,
        deletedReceiptIds: undefined,
        inventoryProducts: undefined as any,
        inventorySales: undefined as any,
        inventoryExpenses: undefined as any,
        inventoryDebts: undefined as any,
        shoppingListItems: undefined as any,
        shoppingCategories: undefined,
        productCategories: undefined,
        customers: undefined,
        agents: undefined,
        workers: undefined,
        staffAttendance: undefined,
        staffLosses: undefined,
        staffSales: undefined,
        staffIncidents: undefined,
        qrHostedPages: rawBackupData.qrHostedPages,
        websitesQrItems: rawBackupData.websitesQrItems,
        socialsQrItems: rawBackupData.socialsQrItems,
        eventsQrItems: rawBackupData.eventsQrItems,
        ...(Array.isArray((rawBackupData as any).files) ? { files: (rawBackupData as any).files } : {}),
      };

      const importResult = StorageService.importBackup(qrOnlyBackup, false);
      if (importResult.success) {
        // Recover QR gallery photos from Cloud storage asynchronously if business QR page photos are missing
        const pages = StorageService.getHostedQRPages();
        const needsPhotoRecovery = pages.some((p) => !Array.isArray(p.photos) || p.photos.length === 0);
        if (needsPhotoRecovery) {
          this.recoverQrPhotosFromCloud(email, false).catch(() => {});
        }

        this.saveConfig({
          lastSyncAt: new Date().toISOString(),
          lastStatus: 'connected',
        });
        const qrCount = Array.isArray(qrOnlyBackup.qrHostedPages) ? qrOnlyBackup.qrHostedPages.length : 0;
        return {
          success: true,
          message: `Successfully restored QR code & business hosting info (${qrCount} page${qrCount === 1 ? '' : 's'}) from Cloud!`,
          count: qrCount,
          data: qrOnlyBackup,
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
        message: `Failed to restore from Cloud: ${errMsg}`,
      };
    }
    })();

    pullInFlightMap.set(email, runPull);
    try {
      return await runPull;
    } finally {
      pullInFlightMap.delete(email);
    }
  },

  /**
   * Receipts, invoices, and quotations are saved strictly in localStorage.
   */
  async saveSingleReceipt(_receipt: Receipt): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Saved locally on device storage.',
    };
  },

  /**
   * Lists files saved in Cloudflare R2
   */
  async listFiles(prefix?: string, emailOverride?: string): Promise<CloudflareFileRecord[]> {
    const config = this.getConfig();
    if (!this.isConfigured()) return [];

    try {
      const headers = this.getAuthHeaders();
      const email = (emailOverride || this.getUserEmail() || '').toLowerCase().trim();
      if (email) {
        headers['X-User-Email'] = email;
        headers['X-User-Id'] = email;
      }
      const params = new URLSearchParams();
      if (prefix) params.set('prefix', prefix);
      if (email) params.set('email', email);
      const queryParam = params.toString() ? `?${params.toString()}` : '';
      const targetUrl = `${normalizeUrl(config.workerUrl)}/api/files${queryParam}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let res: Response;
      try {
        res = await fetch(targetUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
   * Recovers QR business gallery photos, cover banner, and logo from Cloudflare R2 (/api/files)
   * if they were cleared from D1 backups / qr_pages during an outage.
   */
  async recoverQrPhotosFromCloud(
    emailOverride?: string,
    forceMergeMissing = false
  ): Promise<{ recoveredCount: number; updated: boolean }> {
    const email = (emailOverride || this.getUserEmail() || '').toLowerCase().trim();
    if (!email || !this.isConfigured()) {
      return { recoveredCount: 0, updated: false };
    }

    try {
      const allFiles = await this.listFiles(undefined, email);
      if (!Array.isArray(allFiles) || allFiles.length === 0) {
        return { recoveredCount: 0, updated: false };
      }

      const sorted = [...allFiles].sort((a, b) => {
        const ta = new Date(a?.uploadedAt || 0).getTime() || 0;
        const tb = new Date(b?.uploadedAt || 0).getTime() || 0;
        return tb - ta;
      });

      let recoveredCoverUrl: string | undefined;
      let recoveredLogoUrl: string | undefined;
      const r2GalleryPhotos: Array<{ id: string; url: string; title: string; description: string }> = [];
      const seenUrls = new Set<string>();

      for (const file of sorted) {
        if (!file?.url) continue;
        const fname = String(file.filename || file.key || '').toLowerCase();
        const keyLower = String(file.key || '').toLowerCase();

        if (!recoveredLogoUrl && (fname === 'logo.webp' || fname.includes('qr_logo') || keyLower.endsWith('/logo.webp'))) {
          recoveredLogoUrl = file.url;
          continue;
        }
        if (!recoveredCoverUrl && fname.includes('qr_cover')) {
          recoveredCoverUrl = file.url;
          continue;
        }
        if (isQrGalleryPhotoRecord(file) && !seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          r2GalleryPhotos.push({
            id: `photo-r2-${r2GalleryPhotos.length}-${String(file.key || '').slice(-10).replace(/[^a-zA-Z0-9]/g, '')}`,
            url: file.url,
            title: 'Business Photo',
            description: '',
          });
          if (r2GalleryPhotos.length >= 20) break;
        }
      }

      if (r2GalleryPhotos.length === 0 && !recoveredCoverUrl && !recoveredLogoUrl) {
        return { recoveredCount: 0, updated: false };
      }

      const pages = StorageService.getHostedQRPages();
      if (!Array.isArray(pages) || pages.length === 0) {
        return { recoveredCount: 0, updated: false };
      }

      let totalRecovered = 0;
      let didUpdate = false;

      const updatedPages = pages.map((page, index) => {
        if (index !== 0) return page;
        const existingPhotos = Array.isArray(page.photos) ? page.photos.filter((p) => Boolean(p && p.url)) : [];
        let nextPhotos = existingPhotos;

        if (existingPhotos.length === 0 && r2GalleryPhotos.length > 0) {
          nextPhotos = r2GalleryPhotos;
          totalRecovered = r2GalleryPhotos.length;
          didUpdate = true;
        } else if (forceMergeMissing && r2GalleryPhotos.length > 0) {
          const existingUrlSet = new Set(existingPhotos.map((p) => p.url));
          const missing = r2GalleryPhotos.filter((p) => !existingUrlSet.has(p.url));
          if (missing.length > 0) {
            nextPhotos = [...existingPhotos, ...missing].slice(0, 20);
            totalRecovered = missing.length;
            didUpdate = true;
          }
        }

        const nextCover = page.coverImage || recoveredCoverUrl;
        const nextLogo = page.logo || recoveredLogoUrl;
        if ((!page.coverImage && nextCover) || (!page.logo && nextLogo)) {
          didUpdate = true;
        }

        return {
          ...page,
          photos: nextPhotos,
          coverImage: nextCover,
          logo: nextLogo,
          updatedAt: didUpdate ? new Date().toISOString() : page.updatedAt,
        };
      });

      if (didUpdate) {
        try {
          StorageService.saveHostedQRPagesLocalOnly(updatedPages);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('brivu_data_refreshed'));
          }
          // Preserve any existing text/menu/social fields in D1 qr_pages so photo recovery never clobbers business info
          await this.saveSingleQrPage({ ...updatedPages[0], preserveExistingIfEmpty: true }, email).catch(() => {});
        } catch (_) {}
      }

      return { recoveredCount: totalRecovered, updated: didUpdate };
    } catch (err) {
      console.warn('recoverQrPhotosFromCloud note:', err);
      return { recoveredCount: 0, updated: false };
    }
  },

  /**
   * Deletes a file from Cloudflare R2 and D1 files table
   */
  async deleteFile(keyOrUrl: string): Promise<boolean> {
    if (!keyOrUrl || typeof keyOrUrl !== 'string') return false;
    const config = this.getConfig();
    if (!this.isConfigured()) return false;

    try {
      let cleanKey = keyOrUrl.trim();
      if (cleanKey.includes('/api/files/')) {
        cleanKey = cleanKey.split('/api/files/')[1].split('?')[0].split('#')[0];
      }
      cleanKey = decodeURIComponent(cleanKey);

      const headers = this.getAuthHeaders();
      const userEmail = this.getUserEmail();
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
        headers['X-User-Id'] = userEmail;
      }
      const targetUrl = `${config.workerUrl}/api/files/${encodeURIComponent(cleanKey)}`;

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
   * Fetches the 200 MB user storage quota and current usage
   */
  async getStorageQuota(): Promise<StorageQuotaInfo> {
    const config = this.getConfig();
    const defaultQuota: StorageQuotaInfo = {
      usedBytes: 0,
      limitBytes: 200 * 1024 * 1024,
      usedMB: 0,
      limitMB: 200,
      percent: 0,
      isExceeded: false,
      warning: null,
    };
    if (!this.isConfigured()) return defaultQuota;

    try {
      const headers = this.getAuthHeaders();
      const email = this.getUserEmail();
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      const queryParam = params.toString() ? `?${params.toString()}` : '';
      const targetUrl = `${config.workerUrl}/api/storage/quota${queryParam}`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      if (!res.ok) return defaultQuota;
      const rawText = await res.text().catch(() => '');
      const parsed = parseWorkerResponse(rawText);
      if (!parsed.ok || !parsed.data) return defaultQuota;

      const data = parsed.data;
      return {
        usedBytes: Number(data.usedBytes) || 0,
        limitBytes: Number(data.limitBytes) || 200 * 1024 * 1024,
        usedMB: typeof data.usedMB === 'number' ? data.usedMB : parseFloat(data.usedMB) || 0,
        limitMB: Number(data.limitMB) || 200,
        percent: Number(data.percent) || 0,
        isExceeded: Boolean(data.isExceeded),
        warning: data.warning || null,
      };
    } catch (err) {
      console.warn('Failed to fetch storage quota:', err);
      return defaultQuota;
    }
  },

  /**
   * Fetches a specific hosted QR page directly from Cloudflare, scoped by pageId and optional owner email.
   * Uses a fast AbortController timeout and simple GET headers to prevent CORS preflight stalls or multi-minute hangs.
   */
  async getHostedQrPage(pageId: string, emailOverride?: string, timeoutMs = 4000): Promise<any | null> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const effectiveWorkerUrl = isWorkerHostOrigin(currentOrigin)
      ? currentOrigin
      : (config.workerUrl || DEFAULT_CLOUDFLARE_CONFIG.workerUrl);

    if (!effectiveWorkerUrl) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const user = StorageService.getAuthUser();
      const profile = StorageService.getProfile();
      const brivuId = StorageService.getBrivuUserId();
      const userEmail = (
        emailOverride ||
        user?.email ||
        profile?.email ||
        (brivuId && brivuId.includes('@') ? brivuId : '') ||
        ''
      ).toLowerCase().trim();

      const separator = userEmail ? '&' : '?';
      const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}&user_id=${encodeURIComponent(userEmail)}` : '';
      const targetUrl = `${normalizeUrl(effectiveWorkerUrl)}/api/qr/${encodeURIComponent(pageId)}${emailParam}${separator}_t=${Date.now()}`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Fetches user's complete cloud backup directly from Cloudflare without importing into local state
   */
  async fetchUserBackupData(email: string, timeoutMs = 4500): Promise<AppBackupData | null> {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) return null;

    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const effectiveWorkerUrl = isWorkerHostOrigin(currentOrigin)
      ? currentOrigin
      : (config.workerUrl || DEFAULT_CLOUDFLARE_CONFIG.workerUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = this.getAuthHeaders();
      headers['X-User-Email'] = cleanEmail;
      headers['X-User-Id'] = cleanEmail;
      const query = `?email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`;
      const targetUrl = `${normalizeUrl(effectiveWorkerUrl)}/api/sync/pull${query}`;

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!res.ok) return null;
      const rawText = await res.text().catch(() => '');
      const parsed = parseWorkerResponse(rawText);
      if (!parsed.ok) return null;

      const result = parsed.data || {};
      const backupData: AppBackupData | undefined =
        result?.backupData || result?.data?.backupData || (result?.receipts ? result : undefined);
      return backupData || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async flushPendingQrSaves(): Promise<void> {
    const keys = Array.from(pendingQrSaves.keys());
    if (keys.length === 0) return;
    await Promise.all(
      keys.map(async (k) => {
        const entry = pendingQrSaves.get(k);
        if (!entry) return;
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        pendingQrSaves.delete(k);
        const res = await this._executeSaveSingleQrPage(entry.page, entry.emailOverride);
        entry.resolvers.forEach((r) => r(res));
      })
    );
  },

  /**
   * Saves or updates a hosted QR page directly in Cloudflare D1 and R2, indexed by owner email.
   * Debounces rapid keystrokes (unless immediate=true) so later state is never overwritten by slower earlier requests.
   */
  async saveSingleQrPage(
    page: any,
    emailOverride?: string,
    options?: { immediate?: boolean }
  ): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return { success: false, message: 'Cloudflare Worker is not configured' };
    }

    const authEmail = StorageService.getAuthenticatedEmail();
    const userEmail = (
      authEmail && authEmail.includes('@')
        ? authEmail
        : (emailOverride || page?.userEmail || page?.email || '')
    ).toLowerCase().trim();

    if (!userEmail || !userEmail.includes('@')) {
      return { success: false, message: 'Visitor is not logged in: Single QR page save skipped' };
    }

    const queueKey = getQrSaveQueueKey(page, userEmail);

    if (options?.immediate) {
      const existing = pendingQrSaves.get(queueKey);
      if (existing) {
        if (existing.timer) clearTimeout(existing.timer);
        pendingQrSaves.delete(queueKey);
        const res = await this._executeSaveSingleQrPage(page, userEmail);
        existing.resolvers.forEach((r) => r(res));
        return res;
      }
      return this._executeSaveSingleQrPage(page, userEmail);
    }

    return new Promise<{ success: boolean; message: string }>((resolve) => {
      const existing = pendingQrSaves.get(queueKey);
      if (existing) {
        if (existing.timer) clearTimeout(existing.timer);
        existing.page = page;
        existing.emailOverride = userEmail;
        existing.resolvers.push(resolve);
        existing.timer = setTimeout(async () => {
          pendingQrSaves.delete(queueKey);
          const res = await this._executeSaveSingleQrPage(existing.page, existing.emailOverride);
          existing.resolvers.forEach((r) => r(res));
        }, 450);
        return;
      }

      const entry: PendingQrSave = {
        page,
        emailOverride: userEmail,
        resolvers: [resolve],
        timer: null,
      };
      entry.timer = setTimeout(async () => {
        pendingQrSaves.delete(queueKey);
        const res = await this._executeSaveSingleQrPage(entry.page, entry.emailOverride);
        entry.resolvers.forEach((r) => r(res));
      }, 450);
      pendingQrSaves.set(queueKey, entry);
    });
  },

  async _executeSaveSingleQrPage(page: any, emailOverride?: string): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return { success: false, message: 'Cloudflare Worker is not configured' };
    }

    try {
      const authEmail = StorageService.getAuthenticatedEmail();
      const userEmail = (
        authEmail && authEmail.includes('@')
          ? authEmail
          : (emailOverride || page?.userEmail || page?.email || '')
      ).toLowerCase().trim();

      if (!userEmail || !userEmail.includes('@')) {
        return { success: false, message: 'Visitor is not logged in: Single QR page save skipped' };
      }

      const headers = this.getAuthHeaders();
      headers['X-User-Email'] = userEmail;
      headers['X-User-Id'] = userEmail;

      const query = userEmail ? `?email=${encodeURIComponent(userEmail)}&user_id=${encodeURIComponent(userEmail)}` : '';
      const currentOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
      const effectiveWorkerUrl = isWorkerHostOrigin(currentOrigin)
        ? currentOrigin
        : (config.workerUrl || DEFAULT_CLOUDFLARE_CONFIG.workerUrl);
      const targetUrl = `${normalizeUrl(effectiveWorkerUrl)}/api/qr${query}`;

      const cleanPage = {
        ...page,
        userEmail: userEmail || page.userEmail || page.email,
        email: page.email || userEmail,
        coverImage: page.coverImage,
        logo: page.logo,
        photos: (page.photos || []).filter((photo: any) => Boolean(photo && photo.url)),
        menuImages: (page.menuImages || []).filter((photo: any) => Boolean(photo && photo.url)),
        menuItems: (page.menuItems || []).filter((item: any) => item && !String(item.id || '').startsWith('prod-')),
        websitesQrItems: page.websitesQrItems || [],
        socialsQrItems: page.socialsQrItems || [],
        eventsQrItems: page.eventsQrItems || [],
        ...(page?.preserveExistingIfEmpty ? { preserveExistingIfEmpty: true } : {}),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify(cleanPage),
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
  async syncUserProfile(user: BrivuUser, businessProfile?: any): Promise<CloudflareSyncResponse> {
    const config = this.getConfig();
    const cleanUrl = normalizeUrl(config.workerUrl);
    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';

      const rawProf = businessProfile || StorageService.getProfile();
      const { signature: _sig, ...safeBusinessProfile } = rawProf as any;

      const payload = {
        user: {
          ...user,
          syncedToCloudflare: true,
          cloudflareStoredAt: new Date().toISOString(),
        },
        businessProfile: safeBusinessProfile,
        appData: {
          lastSync: new Date().toISOString(),
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/user/profile`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify(payload),
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
   * Fetch Brivu independent Google Sign-In configuration from Cloudflare Worker
   */
  async getAuthConfig(): Promise<BrivuAuthConfig> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);
    const envWebClientId =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_WEB_CLIENT_ID
        ? String(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID).trim()
        : '') || '97897075021-g672moeae0a7i2834ipcjpot5u7fur8e.apps.googleusercontent.com';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${cleanUrl}/api/auth/config`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const webClientId = String(data.googleWebClientId || envWebClientId || '').trim();
          return {
            configured: Boolean(webClientId),
            googleWebClientId: webClientId,
            androidClientId: data.androidClientId || '97897075021-nm7g3g62r1hluqo2gc19k95fa32083k7.apps.googleusercontent.com',
            authProvider: data.authProvider || 'brivu-google',
            workerUrl: cleanUrl,
            message: data.message,
          };
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.warn('Failed to fetch Brivu auth config from Cloudflare:', err);
    }

    return {
      configured: Boolean(envWebClientId),
      googleWebClientId: envWebClientId,
      androidClientId: '97897075021-nm7g3g62r1hluqo2gc19k95fa32083k7.apps.googleusercontent.com',
      authProvider: 'brivu-google',
      workerUrl: cleanUrl,
      message: envWebClientId ? undefined : 'Could not reach Brivu server to load Google Web Client ID.',
    };
  },

  /**
   * Verify Google ID token cryptographically on the Cloudflare Worker and issue a Brivu session
   */
  async authenticateWithGoogleIdToken(idToken: string): Promise<{
    success: boolean;
    user?: BrivuUser;
    sessionToken?: string;
    expiresAt?: number;
    message?: string;
  }> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ idToken }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok && parsed.data?.user && parsed.data?.sessionToken) {
        return {
          success: true,
          user: parsed.data.user as BrivuUser,
          sessionToken: String(parsed.data.sessionToken),
          expiresAt: Number(parsed.data.expiresAt) || Date.now() + 30 * 24 * 60 * 60 * 1000,
          message: parsed.data.message || 'Signed in to Brivu successfully.',
        };
      }

      return {
        success: false,
        message: parsed.data?.error || parsed.error || `Sign-in verification failed (HTTP ${res.status}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.name === 'AbortError'
          ? 'Sign-in verification timed out. Check your internet connection and try again.'
          : err?.message || 'Unable to verify Google sign-in with Brivu server.',
      };
    }
  },

  /**
   * Create a new email/password account OR add a password to an existing Google-created account (unified by email)
   */
  async registerWithEmailPassword(
    email: string,
    password: string,
    name?: string
  ): Promise<{
    success: boolean;
    user?: BrivuUser;
    sessionToken?: string;
    expiresAt?: number;
    linkedExistingGoogleAccount?: boolean;
    alreadyExists?: boolean;
    message?: string;
  }> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ email, password, name }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok && parsed.data?.user && parsed.data?.sessionToken) {
        return {
          success: true,
          user: parsed.data.user as BrivuUser,
          sessionToken: String(parsed.data.sessionToken),
          expiresAt: Number(parsed.data.expiresAt) || Date.now() + 30 * 24 * 60 * 60 * 1000,
          linkedExistingGoogleAccount: Boolean(parsed.data.linkedExistingGoogleAccount),
          message: parsed.data.message || 'Account created and signed into Brivu.',
        };
      }

      return {
        success: false,
        alreadyExists: Boolean(parsed.data?.alreadyExists || res.status === 409),
        message: parsed.data?.error || parsed.error || `Could not create account (HTTP ${res.status}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err?.name === 'AbortError'
            ? 'Account request timed out. Check your internet connection and try again.'
            : err?.message || 'Unable to reach Brivu server.',
      };
    }
  },

  /**
   * Sign in using email and password
   */
  async loginWithEmailPassword(
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: BrivuUser;
    sessionToken?: string;
    expiresAt?: number;
    needsPasswordSetup?: boolean;
    message?: string;
  }> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ email, password }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok && parsed.data?.user && parsed.data?.sessionToken) {
        return {
          success: true,
          user: parsed.data.user as BrivuUser,
          sessionToken: String(parsed.data.sessionToken),
          expiresAt: Number(parsed.data.expiresAt) || Date.now() + 30 * 24 * 60 * 60 * 1000,
          message: parsed.data.message || 'Signed into Brivu.',
        };
      }

      return {
        success: false,
        needsPasswordSetup: Boolean(parsed.data?.needsPasswordSetup),
        message: parsed.data?.error || parsed.error || `Sign-in failed (HTTP ${res.status}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err?.name === 'AbortError'
            ? 'Login timed out. Check your internet connection and try again.'
            : err?.message || 'Unable to sign in with Brivu server.',
      };
    }
  },

  /**
   * Allow an already signed-in user (e.g. Google login) to set or update a backup password
   */
  async setAccountPassword(
    password: string,
    sessionToken: string
  ): Promise<{
    success: boolean;
    user?: BrivuUser;
    message?: string;
  }> {
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/auth/set-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Brivu-Session': sessionToken,
            Authorization: `Bearer ${sessionToken}`,
          },
          signal: controller.signal,
          body: JSON.stringify({ password }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok) {
        return {
          success: true,
          user: parsed.data?.user as BrivuUser | undefined,
          message: parsed.data?.message || 'Backup password saved.',
        };
      }

      return {
        success: false,
        message: parsed.data?.error || parsed.error || `Could not save password (HTTP ${res.status}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err?.name === 'AbortError'
            ? 'Request timed out. Check your internet connection and try again.'
            : err?.message || 'Unable to save password.',
      };
    }
  },

  /**
   * Validate and refresh an active Brivu session on Cloudflare Worker
   */
  async validateBrivuSession(sessionToken: string): Promise<{
    valid: boolean;
    expired?: boolean;
    offline?: boolean;
    user?: BrivuUser;
    expiresAt?: number;
    message?: string;
  }> {
    if (!sessionToken) {
      return { valid: false, expired: false, message: 'No active session token.' };
    }

    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/auth/session`, {
          method: 'GET',
          headers: {
            'X-Brivu-Session': sessionToken,
            Authorization: `Bearer ${sessionToken}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await res.text();
      const parsed = parseWorkerResponse(text);

      if (res.ok && parsed.ok && parsed.data?.authenticated && parsed.data?.user) {
        return {
          valid: true,
          user: parsed.data.user as BrivuUser,
          expiresAt: Number(parsed.data.expiresAt),
        };
      }

      if (res.status === 401) {
        return {
          valid: false,
          expired: true,
          message: parsed.data?.error || 'Your Brivu session has expired. Please sign in again.',
        };
      }

      return {
        valid: false,
        offline: true,
        message: parsed.data?.error || parsed.error || `Session check deferred (HTTP ${res.status})`,
      };
    } catch (err: any) {
      return {
        valid: false,
        offline: true,
        message: err?.message || 'Network unavailable for session check.',
      };
    }
  },

  /**
   * Revoke an active Brivu session on Cloudflare Worker
   */
  async logoutBrivuSession(sessionToken?: string): Promise<void> {
    if (!sessionToken) return;
    const config = this.getConfig();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUrl =
      isWorkerHostOrigin(currentOrigin)
        ? normalizeUrl(currentOrigin)
        : normalizeUrl(config.workerUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch(`${cleanUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Brivu-Session': sessionToken,
          },
          signal: controller.signal,
          body: JSON.stringify({ sessionToken }),
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Best-effort remote revocation; local session is always cleared
    }
  },

  /**
   * Fetch all stored user profiles and emails from Cloudflare
   */
  async getStoredUserProfiles(): Promise<{ success: boolean; users?: BrivuUser[]; emails?: string[] }> {
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
      return { success: false };
    } catch (err) {
      console.warn('Error fetching users from Cloudflare:', err);
      return { success: false };
    }
  },
};
