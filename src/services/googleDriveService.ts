import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { StorageService } from './storage';
import { CloudflareService } from './cloudflareService';

// Initialize Firebase App instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  mimeType: string;
}

export interface BusinessDataBackupPayload {
  version: string;
  app: string;
  exportedAt: string;
  businessProfile: any;
  receipts: any[];
  invoices: any[];
  inventoryProducts: any[];
  productCategories: any[];
  customers: any[];
  inventorySales: any[];
  inventoryExpenses: any[];
  inventoryDebts: any[];
  shoppingList: any[];
  itemCount: {
    receipts: number;
    invoices: number;
    products: number;
    customers: number;
    sales: number;
  };
}

export const GoogleDriveService = {
  /**
   * Listen for Firebase Auth changes and manage access token in memory
   */
  initAuthListener(
    onAuthSuccess?: (user: User, token: string) => void,
    onAuthFailure?: () => void
  ) {
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  },

  /**
   * Get cached access token
   */
  getCachedToken(): string | null {
    return cachedAccessToken;
  },

  /**
   * Get current Firebase user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  /**
   * Perform Google Sign In popup with Google Drive scope
   */
  async signInWithGoogle(): Promise<{ user: User; accessToken: string } | null> {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Could not retrieve access token from Google sign in');
      }

      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      console.error('Google Drive sign in error:', error);
      throw error;
    } finally {
      isSigningIn = false;
    }
  },

  /**
   * Sign out of Google Auth
   */
  async logout(): Promise<void> {
    await signOut(auth);
    cachedAccessToken = null;
  },

  /**
   * Get or create "Brivu Business Data" folder in Google Drive
   */
  async getOrCreateBrivuFolder(accessToken: string): Promise<string> {
    const folderName = 'Brivu Business Data';

    // Search for existing folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Create folder if it doesn't exist
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create Brivu folder in Google Drive: ${errText}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  },

  /**
   * Generate text backup payload containing receipts, invoices, inventory, clients, and sales data
   */
  generateBackupPayload(): any {
    return StorageService.exportBackup();
  },

  /**
   * Upload text backup JSON file to Google Drive folder
   */
  async exportBackupToDrive(
    accessToken: string,
    customFilename?: string
  ): Promise<{ success: boolean; fileId?: string; fileName?: string; error?: string }> {
    try {
      const folderId = await this.getOrCreateBrivuFolder(accessToken);
      const payload = this.generateBackupPayload();
      const payloadStr = JSON.stringify(payload, null, 2);

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = customFilename || `brivu_text_backup_${dateStr}.json`;

      // Multipart upload metadata + content
      const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: [folderId],
        description: `Brivu text-only backup exported on ${new Date().toLocaleString()} (Receipts, Invoices, Inventory, Clients)`,
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
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
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
        return { success: false, error: `Drive upload error: ${errText}` };
      }

      const uploadedFile = await uploadRes.json();
      return { success: true, fileId: uploadedFile.id, fileName: uploadedFile.name };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to export backup to Google Drive' };
    }
  },

  /**
   * List all Brivu backup files in Google Drive
   */
  async listBackupsFromDrive(accessToken: string): Promise<DriveBackupFile[]> {
    try {
      const folderId = await this.getOrCreateBrivuFolder(accessToken);
      const query = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
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
    } catch (err) {
      console.warn('Error listing Drive backups:', err);
      return [];
    }
  },

  /**
   * Download and import JSON backup content from Google Drive
   */
  async importBackupFromDrive(
    accessToken: string,
    fileId: string,
    mergeStrategy: 'replace' | 'merge' = 'merge'
  ): Promise<{ success: boolean; itemCount?: any; error?: string }> {
    try {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        return { success: false, error: 'Failed to download backup file from Google Drive' };
      }

      const backupData = await res.json();

      if (!backupData || (typeof backupData !== 'object')) {
        return { success: false, error: 'Invalid or corrupt Brivu backup file format' };
      }

      // Restore data using StorageService.importBackup
      const importResult = StorageService.importBackup(backupData, mergeStrategy === 'replace');

      if (!importResult.success) {
        return { success: false, error: importResult.message };
      }

      // Sync to Cloudflare cloud storage after import
      CloudflareService.syncAllToCloudflare().catch(() => {});

      return {
        success: true,
        itemCount: {
          receipts: Array.isArray(backupData.receipts) ? backupData.receipts.length : 0,
          products: Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts.length : 0,
          customers: Array.isArray(backupData.customers) ? backupData.customers.length : 0,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error importing backup from Google Drive' };
    }
  },
};
