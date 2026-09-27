import { AppBackupData, CloudflareConfig, CloudflareFileRecord, CloudflareSyncResponse, Receipt } from '../types';
import { StorageService } from './storage';

export const DEFAULT_CLOUDFLARE_CONFIG: CloudflareConfig = {
  workerUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDFLARE_WORKER_URL) || '',
  apiKey: '',
  autoSaveFiles: true,
  autoSyncData: true,
  lastStatus: 'untested',
  filesFolder: 'receipts',
};

function normalizeUrl(url: string): string {
  if (!url) return '';
  let trimmed = url.trim();
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

export const CloudflareService = {
  getConfig(): CloudflareConfig {
    return StorageService.getCloudflareConfig();
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
    return this.isConfigured() && config.autoSaveFiles !== false;
  },

  shouldAutoSyncData(): boolean {
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

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        let errorMsg = `Worker responded with HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errorMsg = parsed.error;
        } catch {
          if (errorText) errorMsg = errorText;
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

      const data = await res.json();
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
  }): Promise<{
    success: boolean;
    url?: string;
    key?: string;
    filename?: string;
    size?: number;
    message: string;
  }> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloudflare Worker is not configured. Go to Settings to set it up.',
      };
    }

    const { filename, mimeType = 'application/octet-stream', folder = config.filesFolder || 'receipts' } = options;
    const { data } = options;

    try {
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/files/upload`;

      let response: Response;

      if (data instanceof Blob) {
        const formData = new FormData();
        formData.append('file', data, filename);
        formData.append('filename', filename);
        formData.append('mimeType', mimeType);
        formData.append('folder', folder);

        response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: formData,
        });
      } else if (data instanceof ArrayBuffer) {
        const blob = new Blob([data], { type: mimeType });
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);
        formData.append('mimeType', mimeType);
        formData.append('folder', folder);

        response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: formData,
        });
      } else if (typeof data === 'string') {
        // Send JSON with base64 string
        let payload = data;
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename,
            data: payload,
            mimeType,
            folder,
          }),
        });
      } else {
        return {
          success: false,
          message: 'Unsupported data format for Cloudflare upload',
        };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorMsg = `HTTP ${response.status} upload failed`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errorMsg = parsed.error;
        } catch {
          if (errorText) errorMsg = errorText;
        }
        return {
          success: false,
          message: errorMsg,
        };
      }

      const result = await response.json();
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
      console.error('Cloudflare file upload error:', errMsg);
      return {
        success: false,
        message: `Cloudflare R2 upload error: ${errMsg}`,
      };
    }
  },

  /**
   * Syncs all application data (profile, settings, receipts, inventory, staff) to Cloudflare D1
   */
  async syncAllToCloudflare(customBackup?: AppBackupData): Promise<CloudflareSyncResponse> {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloudflare Worker is not configured. Set up the worker URL in Settings.',
      };
    }

    try {
      const backupData = customBackup || StorageService.exportBackup();
      const headers = this.getAuthHeaders();
      const targetUrl = `${config.workerUrl}/api/sync/push`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupData }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorMsg = `Sync failed with HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errorMsg = parsed.error;
        } catch {
          if (errorText) errorMsg = errorText;
        }
        return {
          success: false,
          message: errorMsg,
          error: errorMsg,
        };
      }

      const result = await response.json();
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
      console.error('Cloudflare D1 sync error:', errMsg);
      return {
        success: false,
        message: `Cloudflare D1 sync failed: ${errMsg}`,
        error: errMsg,
      };
    }
  },

  /**
   * Pulls data from Cloudflare D1 and restores it into local storage
   */
  async pullFromCloudflare(): Promise<{
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
      const targetUrl = `${config.workerUrl}/api/sync/pull`;

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorMsg = `Pull failed with HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errorMsg = parsed.error;
        } catch {
          if (errorText) errorMsg = errorText;
        }
        return {
          success: false,
          message: errorMsg,
        };
      }

      const result = await response.json();
      if (!result.backupData) {
        return {
          success: false,
          message: 'No backup records found on Cloudflare D1',
        };
      }

      const importResult = StorageService.importBackup(result.backupData);
      if (importResult.success) {
        this.saveConfig({
          lastSyncAt: new Date().toISOString(),
          lastStatus: 'connected',
        });
        return {
          success: true,
          message: `Successfully restored ${result.backupData.receipts?.length || 0} receipts from Cloudflare D1!`,
          count: result.backupData.receipts?.length || 0,
          data: result.backupData,
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

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receipt),
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
      const data = await res.json();
      return data.files || [];
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
};
