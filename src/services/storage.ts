import {
  AppBackupData,
  AppSettings,
  BusinessProfile,
  Receipt,
  ReceiptItem,
  InventoryProduct,
  InventorySale,
  InventoryExpense,
  InventoryDebt,
  ShoppingListItem,
  ShoppingCategory,
  ProductCategory,
  Customer,
  BusinessAgent,
  AgentLedgerRecord,
  BusinessWorker,
  StaffAttendanceRecord,
  StaffLossRecord,
  StaffSaleRecord,
  StaffIncidentRecord,
  QRCodeHostedPage,
  WebsiteAppQrItem,
  SocialQrItem,
  EventQrItem,
  UserSubscription,
  AppLockConfig,
  CloudflareConfig,
  ThermalPrinterDevice,
  WorkOSUser,
  PublicCatalogSettings,
  PublicCatalogProduct,
  PublicCatalogPayload,
} from '../types';
import { PushNotificationService } from './pushNotificationService';
import { CloudflareService } from './cloudflareService';
import { QRHostingService } from './qrHostingService';

const STORAGE_KEYS = {
  PROFILE: 'quickreceipt_business_profile_v1',
  SETTINGS: 'quickreceipt_app_settings_v1',
  RECEIPTS: 'quickreceipt_receipts_list_v1',
  DRAFT: 'quickreceipt_current_draft_v1',
  INVENTORY_PRODUCTS: 'quickreceipt_inventory_products_v1',
  INVENTORY_SALES: 'quickreceipt_inventory_sales_v1',
  INVENTORY_EXPENSES: 'quickreceipt_inventory_expenses_v1',
  INVENTORY_DEBTS: 'quickreceipt_inventory_debts_v1',
  SHOPPING_LIST: 'quickreceipt_shopping_list_v1',
  SHOPPING_CATEGORIES: 'quickreceipt_shopping_categories_v1',
  PRODUCT_CATEGORIES: 'quickreceipt_product_categories_v1',
  CUSTOMERS: 'quickreceipt_customers_v1',
  AGENTS: 'quickreceipt_agents_v1',
  AGENT_LEDGER: 'quickreceipt_agent_ledger_v1',
  WORKERS: 'quickreceipt_workers_v1',
  STAFF_ATTENDANCE: 'quickreceipt_staff_attendance_v1',
  STAFF_LOSSES: 'quickreceipt_staff_losses_v1',
  STAFF_SALES: 'quickreceipt_staff_sales_v1',
  STAFF_INCIDENTS: 'quickreceipt_staff_incidents_v1',
  QR_HOSTED_PAGES: 'quickreceipt_qr_hosted_pages_v1',
  WEBSITES_QR: 'quickreceipt_websites_apps_qr_v1',
  SOCIALS_QR: 'quickreceipt_socials_qr_v1',
  EVENTS_QR: 'quickreceipt_events_qr_v1',
  SUBSCRIPTION: 'quickreceipt_subscription_v1',
  APP_LOCK: 'quickreceipt_app_lock_config_v1',
  APP_LOCKED_STATE: 'quickreceipt_app_locked_state_v1',
  CLOUDFLARE: 'quickreceipt_cloudflare_config_v1',
  DELETED_RECEIPTS: 'quickreceipt_deleted_receipt_ids_v1',
  INITIAL_PROFILE_SETUP_DONE: 'quickreceipt_initial_profile_setup_done_v1',
  INSTALL_DATE: 'quickreceipt_install_date_v1',
  BRIVU_USER_ID: 'quickreceipt_brivu_user_id_v1',
  WORKOS_USER: 'quickreceipt_workos_user_v1',
  ACTIVE_WORKSPACE_USER: 'quickreceipt_active_workspace_user_v1',
  STOCK_VIEW_MODE: 'quickreceipt_stock_view_mode_v1',
  PUBLIC_CATALOG_SETTINGS: 'quickreceipt_public_catalog_settings_v1',
};

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: '',
  description: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  taxNumber: '',
  website: '',
  currency: 'UGX',
  customFooter: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  bankBranchSwift: '',
  mobileMoneyMerchant: '',
  mobileMoneyName: '',
  defaultPaymentInstructions: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'UGX',
  receiptPrefix: 'REC-',
  nextReceiptNumber: 1,
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1,
  numberPadding: 2,
  defaultPaymentMethod: 'Cash',
  defaultTemplate: 'modern',
  defaultDueDateDays: 14,
  defaultPaymentTerms: 'Net 14',
  defaultTaxRate: 0,
  customFooter: '',
  darkMode: false,
  hapticsEnabled: true,
};

// No sample receipts by default
export const INITIAL_SAMPLE_RECEIPTS: Receipt[] = [];

// Helper to safely read from localStorage
function readFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (err) {
    console.warn(`Failed reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

// Helper to test if an error was caused by localStorage quota limit
function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.code === 22 ||
      err.code === 1014 ||
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  const str = String(err).toLowerCase();
  return str.includes('quota') || str.includes('exceeded');
}

// Clean oversized base64 images from hosted pages to prevent quota overflow
function sanitizeHostedPagesImages(pages: QRCodeHostedPage[], stripAllBase64 = false): QRCodeHostedPage[] {
  return pages.map((page) => ({
    ...page,
    coverImage: stripAllBase64 || (page.coverImage && page.coverImage.startsWith('data:') && page.coverImage.length > 400000)
      ? (stripAllBase64 && page.coverImage?.startsWith('data:') ? undefined : (page.coverImage?.startsWith('data:') ? undefined : page.coverImage))
      : page.coverImage,
    logo: stripAllBase64 || (page.logo && page.logo.startsWith('data:') && page.logo.length > 400000)
      ? (stripAllBase64 && page.logo?.startsWith('data:') ? undefined : (page.logo?.startsWith('data:') ? undefined : page.logo))
      : page.logo,
    photos: (page.photos || [])
      .slice(0, stripAllBase64 ? 6 : 30)
      .map((photo) => ({
        ...photo,
        url: (stripAllBase64 && photo.url.startsWith('data:')) || (photo.url && photo.url.startsWith('data:') && photo.url.length > 400000)
          ? ''
          : photo.url,
      }))
      .filter((photo) => Boolean(photo.url)),
    menuItems: (page.menuItems || []).map((item) => ({
      ...item,
      photoUrl: (stripAllBase64 && item.photoUrl?.startsWith('data:')) || (item.photoUrl && item.photoUrl.startsWith('data:') && item.photoUrl.length > 400000)
        ? undefined
        : item.photoUrl,
    })),
  }));
}

// Helper to safely write to localStorage with automatic quota recovery
function writeToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn(`LocalStorage quota reached for key "${key}". Running storage recovery...`);

      // 1. Clear non-essential cached drafts
      try {
        localStorage.removeItem(STORAGE_KEYS.DRAFT);
      } catch {}

      // 2. Global cleanup: trim heavy snapshots from older receipts
      try {
        const rawReceipts = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
        if (rawReceipts && rawReceipts.length > 300000) {
          const parsed = JSON.parse(rawReceipts) as Receipt[];
          const trimmed = parsed.map((r, idx) => {
            if (idx > 3 && r.businessSnapshot) {
              return {
                ...r,
                businessSnapshot: {
                  ...r.businessSnapshot,
                  logo: undefined,
                  signature: undefined,
                },
              };
            }
            return r;
          });
          localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(trimmed));
        }
      } catch {}


      // 4. Global cleanup: if target is NOT QR_HOSTED_PAGES, sanitize stored QR pages to free up quota
      if (key !== STORAGE_KEYS.QR_HOSTED_PAGES) {
        try {
          const rawQRPages = localStorage.getItem(STORAGE_KEYS.QR_HOSTED_PAGES);
          if (rawQRPages && rawQRPages.length > 1500000) {
            const parsed = JSON.parse(rawQRPages) as QRCodeHostedPage[];
            const cleaned = sanitizeHostedPagesImages(parsed, true);
            localStorage.setItem(STORAGE_KEYS.QR_HOSTED_PAGES, JSON.stringify(cleaned));
          }
        } catch {}
      }

      // Try writing original value again after global cleanup
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {}

      // 5. Targeted recovery: QR_HOSTED_PAGES
      if (key === STORAGE_KEYS.QR_HOSTED_PAGES && Array.isArray(value)) {
        try {
          // Attempt 1: sanitize oversized (>400KB) base64 images
          const sanitized = sanitizeHostedPagesImages(value as QRCodeHostedPage[], false);
          localStorage.setItem(key, JSON.stringify(sanitized));
          console.info('Successfully saved QR hosted pages after sanitizing oversized images.');
          return true;
        } catch {
          // Attempt 2: strip all base64 data URLs to guarantee all text, menu dishes, prices, and venue info are preserved
          try {
            const noDataUrls = sanitizeHostedPagesImages(value as QRCodeHostedPage[], true);
            localStorage.setItem(key, JSON.stringify(noDataUrls));
            console.warn('Saved QR hosted pages with base64 images stripped to satisfy storage quota.');
            return true;
          } catch (lastErr) {
            console.warn('Could not persist QR hosted pages to localStorage due to strict quota limits:', lastErr);
            return false;
          }
        }
      }

      // 6. Targeted recovery: INVENTORY_PRODUCTS
      if (key === STORAGE_KEYS.INVENTORY_PRODUCTS && Array.isArray(value)) {
        try {
          const strippedTransient = (value as any[]).map((p) => {
            if (!p || typeof p !== 'object') return p;
            const { imageBackupData, ...rest } = p;
            return rest;
          });
          localStorage.setItem(key, JSON.stringify(strippedTransient));
          return true;
        } catch {
          try {
            // Trim only oversized data URIs (> 250KB) first while preserving normal thumbnails
            const trimmedLarge = (value as any[]).map((p) => {
              if (!p || typeof p !== 'object') return p;
              const { imageBackupData, ...rest } = p;
              if (typeof rest.image === 'string' && rest.image.startsWith('data:') && rest.image.length > 250000) {
                return { ...rest, image: undefined };
              }
              return rest;
            });
            localStorage.setItem(key, JSON.stringify(trimmedLarge));
            return true;
          } catch {
            try {
              // Last resort: keep all product text records by stripping remaining inline data URIs
              const noInlineImages = (value as any[]).map((p) => {
                if (!p || typeof p !== 'object') return p;
                const { imageBackupData, ...rest } = p;
                if (typeof rest.image === 'string' && rest.image.startsWith('data:')) {
                  return { ...rest, image: undefined };
                }
                return rest;
              });
              localStorage.setItem(key, JSON.stringify(noInlineImages));
              return true;
            } catch (lastErr) {
              console.warn('Could not persist inventory products to localStorage:', lastErr);
            }
          }
        }
      }

      // 7. Targeted recovery: RECEIPTS
      if (key === STORAGE_KEYS.RECEIPTS && Array.isArray(value)) {
        try {
          const trimmed = (value as Receipt[]).map((r, idx) => {
            if (idx > 5 && r.businessSnapshot) {
              return {
                ...r,
                businessSnapshot: {
                  ...r.businessSnapshot,
                  logo: undefined,
                  signature: undefined,
                },
              };
            }
            return r;
          });
          localStorage.setItem(key, JSON.stringify(trimmed));
          return true;
        } catch {}
      }
    }

    console.warn(`Failed writing ${key} to localStorage (quota or storage restriction). Continuing with in-memory state:`, err);
    return false;
  }
}

let systemActionExpiresAt = 0;

export const StorageService = {
  // Temporary marker for system intents (e.g. system file picker, native share sheet, camera)
  // so that briefly opening an Android system dialog doesn't trigger app lock on return
  markSystemActionActive(durationMs: number = 60000): void {
    systemActionExpiresAt = Date.now() + durationMs;
  },

  consumeSystemActionActive(): boolean {
    if (systemActionExpiresAt > 0 && Date.now() < systemActionExpiresAt) {
      systemActionExpiresAt = 0;
      return true;
    }
    systemActionExpiresAt = 0;
    return false;
  },

  isSystemActionActive(): boolean {
    return systemActionExpiresAt > 0 && Date.now() < systemActionExpiresAt;
  },

  hasConfiguredPreferences(): boolean {
    const isDone = readFromStorage<boolean>('quickreceipt_initial_prefs_done_v1', false);
    if (isDone) return true;
    return readFromStorage<boolean>(STORAGE_KEYS.INITIAL_PROFILE_SETUP_DONE, false);
  },

  setInitialPreferencesDone(done: boolean = true): void {
    writeToStorage('quickreceipt_initial_prefs_done_v1', done);
  },

  getDefaultDialCode(): string {
    const custom = readFromStorage<string>('quickreceipt_default_dial_code_v1', '');
    if (custom && custom.startsWith('+')) return custom;
    const profile = this.getProfile();
    if (profile?.dialCode) return profile.dialCode;
    return '+256';
  },

  setDefaultDialCode(dialCode: string): void {
    if (dialCode && dialCode.startsWith('+')) {
      writeToStorage('quickreceipt_default_dial_code_v1', dialCode);
    }
  },

  hasCompletedProfileOnboarding(): boolean {
    return readFromStorage<boolean>(STORAGE_KEYS.INITIAL_PROFILE_SETUP_DONE, false);
  },

  hasFilledBusinessDetails(): boolean {
    return this.hasCompletedProfileOnboarding();
  },

  hasCompletedInitialProfileSetup(): boolean {
    return this.hasCompletedProfileOnboarding();
  },

  setInitialProfileSetupDone(done: boolean = true): void {
    writeToStorage(STORAGE_KEYS.INITIAL_PROFILE_SETUP_DONE, done);
  },

  getProfile(): BusinessProfile {
    const profile = readFromStorage<BusinessProfile>(
      STORAGE_KEYS.PROFILE,
      DEFAULT_BUSINESS_PROFILE
    );
    if (profile && profile.customFooter && profile.customFooter.includes('Please keep this receipt for warranty and returns')) {
      profile.customFooter = '';
    }
    return profile;
  },

  saveProfile(profile: BusinessProfile): boolean {
    const success = writeToStorage(STORAGE_KEYS.PROFILE, profile);
    if (success) {
      const current = this.getProfile();
      let hasUpdates = false;

      // Auto-upload compressed logo to Cloudflare R2 (overwritten in place as logo.webp)
      if (profile.logo && profile.logo.startsWith('data:image/')) {
        import('../utils/imageCompressor')
          .then(({ compressLogo }) => compressLogo(profile.logo!))
          .then((compressed) => {
            return CloudflareService.uploadFile({
              data: compressed.dataUri,
              filename: 'logo.webp',
              mimeType: compressed.mimeType,
              folder: 'photos',
            });
          })
          .then((res) => {
            if (res.success && res.url) {
              const p = this.getProfile();
              p.logo = res.url;
              writeToStorage(STORAGE_KEYS.PROFILE, p);
              CloudflareService.syncAllToCloudflare().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn('Logo compression/upload note:', err);
          });
      }

      // Auto-upload compressed signature to Cloudflare R2 (overwritten in place as signature.webp)
      if (profile.signature && profile.signature.startsWith('data:image/')) {
        import('../utils/imageCompressor')
          .then(({ compressSignature }) => compressSignature(profile.signature!))
          .then((compressed) => {
            return CloudflareService.uploadFile({
              data: compressed.dataUri,
              filename: 'signature.webp',
              mimeType: compressed.mimeType,
              folder: 'signatures',
            });
          })
          .then((res) => {
            if (res.success && res.url) {
              const p = this.getProfile();
              p.signature = res.url;
              writeToStorage(STORAGE_KEYS.PROFILE, p);
              CloudflareService.syncAllToCloudflare().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn('Signature compression/upload note:', err);
          });
      }

      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  getSettings(): AppSettings {
    const current = readFromStorage<AppSettings>(
      STORAGE_KEYS.SETTINGS,
      DEFAULT_SETTINGS
    );
    const settings = { ...DEFAULT_SETTINGS, ...current };
    if (settings.customFooter === 'Thank you for your business!') {
      settings.customFooter = '';
    }
    // Default to 1 leading zero (2 digits, e.g. 01 instead of legacy 000001)
    if (!settings.numberPadding || settings.numberPadding === 6) {
      settings.numberPadding = 2;
    }
    return settings;
  },

  saveSettings(settings: AppSettings): boolean {
    const success = writeToStorage(STORAGE_KEYS.SETTINGS, settings);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  getSavedThermalPrinter(): ThermalPrinterDevice | undefined {
    const settings = this.getSettings();
    return settings.defaultPrinter;
  },

  saveThermalPrinter(printer: ThermalPrinterDevice | undefined): boolean {
    const settings = this.getSettings();
    settings.defaultPrinter = printer;
    return this.saveSettings(settings);
  },

  getCustomTemplate(templateId: string) {
    const settings = this.getSettings();
    return settings.templateCustomizations?.[templateId];
  },

  saveCustomTemplate(templateId: string, customization: any): boolean {
    const settings = this.getSettings();
    const map = settings.templateCustomizations || {};
    settings.templateCustomizations = {
      ...map,
      [templateId]: customization,
    };
    return this.saveSettings(settings);
  },

  resetCustomTemplate(templateId: string): boolean {
    const settings = this.getSettings();
    if (!settings.templateCustomizations) return true;
    const map = { ...settings.templateCustomizations };
    delete map[templateId];
    settings.templateCustomizations = map;
    return this.saveSettings(settings);
  },

  getDeletedReceiptIds(): string[] {
    return readFromStorage<string[]>(STORAGE_KEYS.DELETED_RECEIPTS, []);
  },

  recordDeletedReceipt(id: string, receiptNumber?: string, customerName?: string): void {
    const list = this.getDeletedReceiptIds();
    const set = new Set(list.map((s) => String(s).trim()));
    if (id) {
      set.add(String(id).trim());
      set.add(String(id).trim().toLowerCase());
    }
    if (receiptNumber) {
      set.add(String(receiptNumber).trim());
      set.add(String(receiptNumber).trim().toLowerCase());
    }
    if (customerName && customerName.trim().length > 1) {
      set.add(`cust:${customerName.trim().toLowerCase()}`);
    }
    writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, Array.from(set));
  },

  unmarkDeletedReceipt(id: string, receiptNumber?: string): void {
    const list = this.getDeletedReceiptIds();
    const idLower = String(id).trim().toLowerCase();
    const numLower = receiptNumber ? String(receiptNumber).trim().toLowerCase() : '';
    const filtered = list.filter((item) => {
      const itemLower = String(item).trim().toLowerCase();
      return itemLower !== idLower && (!numLower || itemLower !== numLower);
    });
    writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, filtered);
  },

  getReceipts(): Receipt[] {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const deletedList = this.getDeletedReceiptIds();
    const deletedSet = new Set(deletedList.map((s) => String(s).trim().toLowerCase()));

    if (!data) {
      // First time initialization
      writeToStorage(STORAGE_KEYS.RECEIPTS, INITIAL_SAMPLE_RECEIPTS);
      return INITIAL_SAMPLE_RECEIPTS;
    }
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((r) => r && typeof r === 'object' && (!r.id || !String(r.id).startsWith('sample-')))
        .filter((r) => {
          const rId = String(r.id || '').trim().toLowerCase();
          const rNum = String(r.receiptNumber || '').trim().toLowerCase();
          const rCust = r.customerName ? `cust:${String(r.customerName).trim().toLowerCase()}` : '';
          if (deletedSet.has(rId) || (rNum && deletedSet.has(rNum))) {
            return false;
          }
          if (rCust && deletedSet.has(rCust)) {
            return false;
          }
          return true;
        })
        .map((r: any): Receipt => ({
          ...r,
          id: String(r.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
          receiptNumber: String(r.receiptNumber || 'REC-01'),
          items: Array.isArray(r.items) ? r.items : [],
          subtotal: typeof r.subtotal === 'number' ? r.subtotal : (parseFloat(r.subtotal) || 0),
          total: typeof r.total === 'number' ? r.total : (parseFloat(r.total) || 0),
          amountPaid: typeof r.amountPaid === 'number' ? r.amountPaid : (parseFloat(r.amountPaid) || 0),
          balance: typeof r.balance === 'number' ? r.balance : 0,
          paymentStatus: r.paymentStatus || 'paid',
          documentType: r.documentType === 'invoice' ? 'invoice' : 'receipt',
          createdAt: r.createdAt || new Date().toISOString(),
          businessSnapshot: r.businessSnapshot || {
            name: '',
            phone: '',
            email: '',
            address: '',
            currency: 'UGX',
          },
        }));
    } catch {
      return [];
    }
  },

  getReceiptById(id: string): Receipt | undefined {
    const receipts = this.getReceipts();
    return receipts.find((r) => r.id === id);
  },

  saveReceipt(receipt: Receipt): boolean {
    // Unmark from deleted list if user explicitly created/saved this receipt
    this.unmarkDeletedReceipt(receipt.id, receipt.receiptNumber);

    const receipts = this.getReceipts();
    const existingIndex = receipts.findIndex((r) => r.id === receipt.id);
    let updated: Receipt[];
    const isNew = existingIndex < 0;

    if (existingIndex >= 0) {
      updated = [...receipts];
      updated[existingIndex] = receipt;
    } else {
      updated = [receipt, ...receipts];
    }
    const success = writeToStorage(STORAGE_KEYS.RECEIPTS, updated);

    if (success) {
      // Background sync receipt/invoice JSON information to Cloudflare D1
      this.syncReceiptToCloudflare(receipt);
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }

    if (success && isNew) {
      const currencySymbol = receipt.businessSnapshot.currency || 'UGX';
      const isInvoiceDoc = receipt.documentType === 'invoice';

      // Trigger new sale / receipt notification
      PushNotificationService.triggerBusinessAlert({
        title: isInvoiceDoc ? `🧾 New Invoice: ${receipt.receiptNumber}` : `🧾 New Receipt: ${receipt.receiptNumber}`,
        body: `Issued ${receipt.items.length} item(s) for ${currencySymbol} ${receipt.total.toLocaleString()} to ${receipt.customerName || 'Customer'}`,
        type: 'sale',
      }).catch(() => {});

      // If it's an unpaid invoice, trigger debt reminder
      if (isInvoiceDoc && receipt.paymentStatus !== 'paid') {
        PushNotificationService.triggerBusinessAlert({
          title: `⏳ Invoice Due Reminder: ${receipt.receiptNumber}`,
          body: `Due on ${receipt.dueDate || 'due date'}. Total: ${currencySymbol} ${receipt.total.toLocaleString()} for ${receipt.customerName || 'Customer'}`,
          type: 'debt_reminder',
        }).catch(() => {});
      }
    }

    return success;
  },

  /**
   * Cloud-First Receipt Save: Awaits saving to Cloudflare D1 first before persisting locally.
   */
  async saveReceiptAsync(receipt: Receipt): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
    let cloudSynced = false;
    try {
      const config = this.getCloudflareConfig();
      if (config.workerUrl && config.autoSyncData !== false) {
        const res = await CloudflareService.saveReceipt(receipt);
        if (res.success) {
          cloudSynced = true;
        }
      }
    } catch (cfErr) {
      console.warn('Cloud-first receipt save note:', cfErr);
    }

    const localSuccess = this.saveReceipt(receipt);

    // Also trigger full cloud backup sync so D1 backups table is immediately updated with this receipt
    try {
      const config = this.getCloudflareConfig();
      if (config.workerUrl && config.autoSyncData !== false) {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    } catch (_) {}

    return {
      success: localSuccess,
      cloudSynced,
      message: `Receipt saved to device successfully!`,
    };
  },

  /**
   * Cloud-First Business Profile Save: Awaits saving to Cloudflare D1 first.
   */
  async saveProfileAsync(profile: BusinessProfile): Promise<{ success: boolean; cloudSynced: boolean }> {
    let cloudSynced = false;
    try {
      const config = this.getCloudflareConfig();
      if (config.workerUrl && config.autoSyncData !== false) {
        const res = await CloudflareService.syncAllToCloudflare();
        if (res.success) {
          cloudSynced = true;
        }
      }
    } catch (cfErr) {
      console.warn('Cloud-first profile save note:', cfErr);
    }

    const localSuccess = this.saveProfile(profile);
    return { success: localSuccess, cloudSynced };
  },

  deleteReceipt(id: string): boolean {
    const receipts = this.getReceipts();
    const target = receipts.find((r) => r.id === id);
    const receiptNumber = target?.receiptNumber;
    const customerName = target?.customerName;

    // Record persistent deletion tombstone
    this.recordDeletedReceipt(id, receiptNumber, customerName);

    const filtered = receipts.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.RECEIPTS, filtered);

    if (success) {
      // Instantly synchronize the updated receipts list to Cloudflare D1 so pull cannot restore it
      CloudflareService.deleteReceipt(id).catch(() => {});
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }

    return success;
  },

  /**
   * Permanent Async Receipt & Cloud Deletion
   */
  async deleteReceiptAsync(id: string): Promise<{ success: boolean; cloudSynced: boolean }> {
    const receipts = this.getReceipts();
    const target = receipts.find((r) => r.id === id);
    const receiptNumber = target?.receiptNumber;
    const customerName = target?.customerName;

    this.recordDeletedReceipt(id, receiptNumber, customerName);

    const filtered = receipts.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.RECEIPTS, filtered);

    let cloudSynced = false;
    try {
      await CloudflareService.deleteReceipt(id);
      await CloudflareService.syncAllToCloudflare();
      cloudSynced = true;
    } catch (cfErr) {
      console.warn('Async cloud receipt deletion note:', cfErr);
    }

    return { success, cloudSynced };
  },

  /**
   * Generates a new unique receipt number based on current settings
   * Ensures no duplicates even if manual numbering was modified
   */
  generateReceiptNumber(): string {
    const settings = this.getSettings();
    const receipts = this.getReceipts();
    const existingNumbers = new Set(receipts.map((r) => r.receiptNumber.trim()));

    let currentNum = settings.nextReceiptNumber;
    const padding = settings.numberPadding === 6 ? 2 : (settings.numberPadding || 2);
    let candidate = `${settings.receiptPrefix}${String(currentNum).padStart(padding, '0')}`;

    while (existingNumbers.has(candidate)) {
      currentNum++;
      candidate = `${settings.receiptPrefix}${String(currentNum).padStart(padding, '0')}`;
    }

    return candidate;
  },

  /**
   * Advances the receipt sequence counter
   */
  advanceReceiptSequence(): void {
    const settings = this.getSettings();
    settings.nextReceiptNumber += 1;
    this.saveSettings(settings);
  },

  /**
   * Generates a new unique invoice number based on current settings
   * Ensures no duplicates even if manual numbering was modified
   */
  generateInvoiceNumber(): string {
    const settings = this.getSettings();
    const receipts = this.getReceipts();
    const existingNumbers = new Set(receipts.map((r) => r.receiptNumber.trim()));

    let currentNum = settings.nextInvoiceNumber || 1;
    const prefix = settings.invoicePrefix || 'INV-';
    const padding = settings.numberPadding === 6 ? 2 : (settings.numberPadding || 2);
    let candidate = `${prefix}${String(currentNum).padStart(padding, '0')}`;

    while (existingNumbers.has(candidate)) {
      currentNum++;
      candidate = `${prefix}${String(currentNum).padStart(padding, '0')}`;
    }

    return candidate;
  },

  /**
   * Advances the invoice sequence counter
   */
  advanceInvoiceSequence(): void {
    const settings = this.getSettings();
    settings.nextInvoiceNumber = (settings.nextInvoiceNumber || 1) + 1;
    this.saveSettings(settings);
  },

  /**
   * Converts an invoice into a paid receipt
   */
  convertInvoiceToReceipt(invoice: Receipt): Receipt {
    const newReceiptNumber = this.generateReceiptNumber();
    this.advanceReceiptSequence();

    const newReceipt: Receipt = {
      ...invoice,
      id: `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      documentType: 'receipt',
      receiptNumber: newReceiptNumber,
      createdAt: new Date().toISOString(),
      paymentStatus: 'paid',
      amountPaid: invoice.total,
      balance: 0,
      notes: invoice.notes ? `${invoice.notes} (Converted from ${invoice.receiptNumber})` : `Converted from ${invoice.receiptNumber}`,
    };

    this.saveReceipt(newReceipt);
    return newReceipt;
  },

  /**
   * Converts a receipt into an invoice
   */
  convertReceiptToInvoice(receipt: Receipt): Receipt {
    const newInvoiceNumber = this.generateInvoiceNumber();
    this.advanceInvoiceSequence();

    const dueDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const newInvoice: Receipt = {
      ...receipt,
      id: `invoice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      documentType: 'invoice',
      receiptNumber: newInvoiceNumber,
      createdAt: new Date().toISOString(),
      dueDate,
      paymentTerms: 'Net 14',
      paymentStatus: 'unpaid',
      amountPaid: 0,
      balance: -receipt.total,
      notes: receipt.notes ? `${receipt.notes} (Created from ${receipt.receiptNumber})` : `Created from ${receipt.receiptNumber}`,
    };

    this.saveReceipt(newInvoice);
    return newInvoice;
  },

  getStats(): {
    totalReceipts: number;
    totalInvoices: number;
    todayReceipts: number;
    todaySales: number;
    pendingInvoices: number;
    totalOutstanding: number;
    recentReceipts: Receipt[];
  } {
    const receipts = this.getReceipts();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayReceipts = 0;
    let todaySales = 0;
    let totalReceiptsCount = 0;
    let totalInvoicesCount = 0;
    let pendingInvoicesCount = 0;
    let totalOutstanding = 0;

    for (const r of receipts) {
      const isInvoice = r.documentType === 'invoice';
      if (isInvoice) {
        totalInvoicesCount++;
        if (r.paymentStatus !== 'paid') {
          pendingInvoicesCount++;
          const owed = r.balance < 0 ? Math.abs(r.balance) : (r.total - (r.amountPaid || 0));
          totalOutstanding += Math.max(0, owed);
        }
      } else {
        totalReceiptsCount++;
      }

      try {
        const rDate = new Date(r.createdAt);
        if (rDate >= today) {
          todayReceipts++;
          todaySales += r.amountPaid || r.total;
        }
      } catch {
        // Skip invalid dates
      }
    }

    return {
      totalReceipts: totalReceiptsCount,
      totalInvoices: totalInvoicesCount,
      todayReceipts,
      todaySales,
      pendingInvoices: pendingInvoicesCount,
      totalOutstanding,
      recentReceipts: receipts.slice(0, 8),
    };
  },

  exportBackup(): AppBackupData & { brivuUserId?: string } {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      brivuUserId: this.getBrivuUserId(),
      profile: this.getProfile(),
      settings: this.getSettings(),
      receipts: this.getReceipts(),
      deletedReceiptIds: this.getDeletedReceiptIds(),
      inventoryProducts: this.getInventoryProducts(),
      inventorySales: this.getInventorySales(),
      inventoryExpenses: this.getInventoryExpenses(),
      inventoryDebts: this.getInventoryDebts(),
      shoppingListItems: this.getShoppingListItems(),
      shoppingCategories: this.getShoppingCategories(),
      productCategories: this.getProductCategories(),
      customers: this.getCustomers(),
      agents: this.getAgents(),
      workers: this.getWorkers(),
      staffAttendance: this.getStaffAttendance(),
      staffLosses: this.getStaffLosses(),
      staffSales: this.getStaffSales(),
      staffIncidents: this.getStaffIncidents(),
      qrHostedPages: this.getAllHostedPagesForSync(),
      websitesQrItems: this.getWebsitesQrItems(),
      socialsQrItems: this.getSocialsQrItems(),
      eventsQrItems: this.getEventsQrItems(),
      publicCatalogSettings: this.getPublicCatalogSettings(),
    };
  },

  importBackup(backupData: AppBackupData, replaceExisting = false): { success: boolean; message: string } {
    if (!backupData || typeof backupData !== 'object') {
      return { success: false, message: 'Invalid backup file format' };
    }
    const incomingProducts = Array.isArray(backupData.inventoryProducts)
      ? backupData.inventoryProducts
      : (Array.isArray((backupData as any).products) ? (backupData as any).products : null);

    const hasAnyContent =
      (Array.isArray(backupData.receipts) && backupData.receipts.length > 0) ||
      (Array.isArray(incomingProducts) && incomingProducts.length > 0) ||
      (Array.isArray(backupData.inventorySales) && backupData.inventorySales.length > 0) ||
      (Array.isArray(backupData.inventoryExpenses) && backupData.inventoryExpenses.length > 0) ||
      (Array.isArray(backupData.inventoryDebts) && backupData.inventoryDebts.length > 0) ||
      (Array.isArray(backupData.qrHostedPages) && backupData.qrHostedPages.length > 0) ||
      (Array.isArray(backupData.customers) && backupData.customers.length > 0) ||
      (Array.isArray(backupData.agents) && backupData.agents.length > 0) ||
      (Array.isArray(backupData.workers) && backupData.workers.length > 0) ||
      (Array.isArray(backupData.shoppingListItems) && backupData.shoppingListItems.length > 0) ||
      (Array.isArray(backupData.websitesQrItems) && backupData.websitesQrItems.length > 0) ||
      (Array.isArray(backupData.socialsQrItems) && backupData.socialsQrItems.length > 0) ||
      (Array.isArray(backupData.eventsQrItems) && backupData.eventsQrItems.length > 0) ||
      (Array.isArray((backupData as any).files) && (backupData as any).files.length > 0) ||
      Boolean(backupData.profile);
    if (!hasAnyContent) {
      return { success: false, message: 'Backup file is empty or missing data' };
    }

    try {
      if (backupData.profile) {
        const {
          logoBackupData,
          signatureBackupData,
          ...rawIncomingProfile
        } = backupData.profile as any;
        const incomingLogo = rawIncomingProfile.logo || logoBackupData;
        const incomingSig = rawIncomingProfile.signature || signatureBackupData;
        if (replaceExisting) {
          this.saveProfile({
            ...rawIncomingProfile,
            logo: incomingLogo,
            signature: incomingSig,
          });
        } else {
          const currentProfile = this.getProfile();
          this.saveProfile({
            ...rawIncomingProfile,
            ...currentProfile,
            name: currentProfile.name || rawIncomingProfile.name || '',
            phone: currentProfile.phone || rawIncomingProfile.phone || '',
            email: currentProfile.email || rawIncomingProfile.email || '',
            currency: currentProfile.currency || rawIncomingProfile.currency || 'UGX',
            logo: currentProfile.logo || incomingLogo,
            signature: currentProfile.signature || incomingSig,
          });
        }
      }
      if (backupData.settings) {
        if (replaceExisting) {
          this.saveSettings(backupData.settings);
        }
      }
      // Import and merge deleted receipt ids so tombstones survive across devices/APK installs
      if (Array.isArray(backupData.deletedReceiptIds)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, backupData.deletedReceiptIds);
        } else if (backupData.deletedReceiptIds.length > 0) {
          const currentDeleted = this.getDeletedReceiptIds();
          const mergedSet = new Set([
            ...currentDeleted.map((s) => String(s).trim().toLowerCase()),
            ...backupData.deletedReceiptIds.map((s) => String(s).trim().toLowerCase()),
          ]);
          writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, Array.from(mergedSet));
        }
      }

      // 3. Receipts & Invoices
      if (Array.isArray(backupData.receipts)) {
        if (replaceExisting) {
          // Fresh restore: clear all deleted tombstones so all restored items appear immediately
          writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, []);
          writeToStorage(STORAGE_KEYS.RECEIPTS, backupData.receipts);
        } else {
          // Merge Mode: Unmark all incoming backup receipts from deleted list (ID, number, and customer tombstone)
          const currentDeleted = this.getDeletedReceiptIds();
          const incomingTombstonesToRemove = new Set<string>();
          backupData.receipts.forEach((r) => {
            if (r.id) incomingTombstonesToRemove.add(String(r.id).trim().toLowerCase());
            if (r.receiptNumber) incomingTombstonesToRemove.add(String(r.receiptNumber).trim().toLowerCase());
            if (r.customerName) incomingTombstonesToRemove.add(`cust:${String(r.customerName).trim().toLowerCase()}`);
          });

          const cleanDeleted = currentDeleted.filter((item) => {
            const itemLower = String(item).trim().toLowerCase();
            return !incomingTombstonesToRemove.has(itemLower);
          });
          writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, cleanDeleted);

          // Read raw storage so no items are filtered out by stale memory caches
          const existing = readFromStorage<Receipt[]>(STORAGE_KEYS.RECEIPTS, []);
          const receiptMap = new Map<string, any>();
          existing.forEach((r) => {
            if (r && r.id && !String(r.id).startsWith('sample-')) {
              receiptMap.set(r.id, r);
            }
          });
          backupData.receipts.forEach((r) => {
            if (r && r.id && !String(r.id).startsWith('sample-')) {
              receiptMap.set(r.id, r);
            }
          });

          writeToStorage(STORAGE_KEYS.RECEIPTS, Array.from(receiptMap.values()));
        }

        // Background sync state to Cloudflare D1
        setTimeout(() => {
          CloudflareService.syncAllToCloudflare().catch(() => {});
        }, 100);
      }

      // 4. Inventory Products (normalize image/photo aliases & never overwrite existing photos with empty values)
      if (Array.isArray(incomingProducts)) {
        const normalizeProduct = (raw: any, existing?: any): InventoryProduct => {
          const {
            imageBackupData,
            photoUrl,
            imageUrl,
            photo,
            ...rest
          } = raw || {};
          const resolvedImage =
            rest.image ||
            photoUrl ||
            imageUrl ||
            photo ||
            imageBackupData ||
            existing?.image ||
            undefined;
          return {
            ...existing,
            ...rest,
            id: String(rest.id),
            itemId: String(rest.itemId ?? rest.barcode ?? existing?.itemId ?? ''),
            name: String(rest.name || existing?.name || 'Unnamed Product'),
            quantity: Number(rest.quantity ?? rest.stockQuantity ?? rest.stock ?? existing?.quantity ?? 0),
            costPrice: Number(rest.costPrice ?? existing?.costPrice ?? 0),
            sellingPrice: Number(rest.sellingPrice ?? rest.price ?? existing?.sellingPrice ?? 0),
            unit: rest.unit || existing?.unit || 'Pcs',
            image: resolvedImage,
          };
        };

        if (replaceExisting) {
          const normalized = incomingProducts
            .filter((p: any) => p && p.id)
            .map((p: any) => normalizeProduct(p));
          writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, normalized);
        } else {
          const existing = this.getInventoryProducts();
          const productMap = new Map<string, any>();
          existing.forEach((p) => { if (p && p.id) productMap.set(p.id, p); });
          incomingProducts.forEach((p: any) => {
            if (p && p.id) {
              const prev = productMap.get(p.id);
              productMap.set(p.id, normalizeProduct(p, prev));
            }
          });
          writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, Array.from(productMap.values()));
        }
      }

      // 5. Inventory Sales
      if (Array.isArray(backupData.inventorySales)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.INVENTORY_SALES, backupData.inventorySales);
        } else {
          const existing = this.getInventorySales();
          const salesMap = new Map<string, any>();
          existing.forEach((s) => { if (s && s.id) salesMap.set(s.id, s); });
          backupData.inventorySales.forEach((s) => { if (s && s.id) salesMap.set(s.id, s); });
          writeToStorage(STORAGE_KEYS.INVENTORY_SALES, Array.from(salesMap.values()));
        }
      }

      // 6. Inventory Expenses
      if (Array.isArray(backupData.inventoryExpenses)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, backupData.inventoryExpenses);
        } else {
          const existing = this.getInventoryExpenses();
          const expenseMap = new Map<string, any>();
          existing.forEach((e) => { if (e && e.id) expenseMap.set(e.id, e); });
          backupData.inventoryExpenses.forEach((e) => { if (e && e.id) expenseMap.set(e.id, e); });
          writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, Array.from(expenseMap.values()));
        }
      }

      // 7. Inventory Debts
      if (Array.isArray(backupData.inventoryDebts)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, backupData.inventoryDebts);
        } else {
          const existing = this.getInventoryDebts();
          const debtMap = new Map<string, any>();
          existing.forEach((d) => { if (d && d.id) debtMap.set(d.id, d); });
          backupData.inventoryDebts.forEach((d) => { if (d && d.id) debtMap.set(d.id, d); });
          writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, Array.from(debtMap.values()));
        }
      }

      // 8. Shopping List Items
      if (Array.isArray(backupData.shoppingListItems)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.SHOPPING_LIST, backupData.shoppingListItems);
        } else {
          const existing = this.getShoppingListItems();
          const shopMap = new Map<string, any>();
          existing.forEach((s) => { if (s && s.id) shopMap.set(s.id, s); });
          backupData.shoppingListItems.forEach((s) => { if (s && s.id) shopMap.set(s.id, s); });
          writeToStorage(STORAGE_KEYS.SHOPPING_LIST, Array.from(shopMap.values()));
        }
      }

      // 9. Categories
      if (Array.isArray(backupData.shoppingCategories)) {
        writeToStorage(STORAGE_KEYS.SHOPPING_CATEGORIES, backupData.shoppingCategories);
      }
      if (Array.isArray(backupData.productCategories)) {
        writeToStorage(STORAGE_KEYS.PRODUCT_CATEGORIES, backupData.productCategories);
      }

      // 10. Customers / Clients
      if (Array.isArray(backupData.customers)) {
        const normalizeCustomer = (raw: any, existing?: any) => {
          const { profilePicBackupData, photoUrl, ...rest } = raw || {};
          return {
            ...existing,
            ...rest,
            profilePic: rest.profilePic || photoUrl || profilePicBackupData || existing?.profilePic || undefined,
          };
        };
        if (replaceExisting) {
          writeToStorage(
            STORAGE_KEYS.CUSTOMERS,
            backupData.customers.filter((c: any) => c && c.id).map((c: any) => normalizeCustomer(c))
          );
        } else {
          const existing = this.getCustomers();
          const customerMap = new Map<string, any>();
          existing.forEach((c) => { if (c && c.id) customerMap.set(c.id, c); });
          backupData.customers.forEach((c: any) => {
            if (c && c.id) customerMap.set(c.id, normalizeCustomer(c, customerMap.get(c.id)));
          });
          writeToStorage(STORAGE_KEYS.CUSTOMERS, Array.from(customerMap.values()));
        }
      }

      // 11. Agents
      if (Array.isArray(backupData.agents)) {
        const normalizeAgent = (raw: any, existing?: any) => {
          const { profilePicBackupData, photoUrl, ...rest } = raw || {};
          return {
            ...existing,
            ...rest,
            profilePic: rest.profilePic || photoUrl || profilePicBackupData || existing?.profilePic || undefined,
          };
        };
        if (replaceExisting) {
          writeToStorage(
            STORAGE_KEYS.AGENTS,
            backupData.agents.filter((a: any) => a && a.id).map((a: any) => normalizeAgent(a))
          );
        } else {
          const existing = this.getAgents();
          const agentMap = new Map<string, any>();
          existing.forEach((a) => { if (a && a.id) agentMap.set(a.id, a); });
          backupData.agents.forEach((a: any) => {
            if (a && a.id) agentMap.set(a.id, normalizeAgent(a, agentMap.get(a.id)));
          });
          writeToStorage(STORAGE_KEYS.AGENTS, Array.from(agentMap.values()));
        }
      }

      // 12. Workers / Staff
      if (Array.isArray(backupData.workers)) {
        const normalizeWorker = (raw: any, existing?: any) => {
          const { profilePicBackupData, photoUrl, ...rest } = raw || {};
          return {
            ...existing,
            ...rest,
            profilePic: rest.profilePic || photoUrl || profilePicBackupData || existing?.profilePic || undefined,
          };
        };
        if (replaceExisting) {
          writeToStorage(
            STORAGE_KEYS.WORKERS,
            backupData.workers.filter((w: any) => w && w.id).map((w: any) => normalizeWorker(w))
          );
        } else {
          const existing = this.getWorkers();
          const workerMap = new Map<string, any>();
          existing.forEach((w) => { if (w && w.id) workerMap.set(w.id, w); });
          backupData.workers.forEach((w: any) => {
            if (w && w.id) workerMap.set(w.id, normalizeWorker(w, workerMap.get(w.id)));
          });
          writeToStorage(STORAGE_KEYS.WORKERS, Array.from(workerMap.values()));
        }
      }

      // 13. Staff Records
      if (Array.isArray(backupData.staffAttendance)) {
        writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, backupData.staffAttendance);
      }
      if (Array.isArray(backupData.staffLosses)) {
        writeToStorage(STORAGE_KEYS.STAFF_LOSSES, backupData.staffLosses);
      }
      if (Array.isArray(backupData.staffSales)) {
        writeToStorage(STORAGE_KEYS.STAFF_SALES, backupData.staffSales);
      }
      if (Array.isArray(backupData.staffIncidents)) {
        writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, backupData.staffIncidents);
      }

      // 14. QR Hosted Pages & Items (preserve non-empty photos, coverImage, logo, menuItems during merge)
      if (Array.isArray(backupData.qrHostedPages)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, backupData.qrHostedPages);
        } else {
          const existing = this.getHostedQRPages();
          const qrMap = new Map<string, any>();
          existing.forEach((p) => { if (p && p.id) qrMap.set(p.id, p); });
          backupData.qrHostedPages.forEach((incomingPage) => {
            if (!incomingPage || !incomingPage.id) return;
            const current = qrMap.get(incomingPage.id);
            if (current) {
              const mergedPhotos =
                Array.isArray(incomingPage.photos) && incomingPage.photos.length > 0
                  ? incomingPage.photos
                  : Array.isArray(current.photos)
                  ? current.photos
                  : [];
              const mergedMenuItems =
                Array.isArray(incomingPage.menuItems) && incomingPage.menuItems.length > 0
                  ? incomingPage.menuItems
                  : Array.isArray(current.menuItems)
                  ? current.menuItems
                  : [];
              qrMap.set(incomingPage.id, {
                ...current,
                ...incomingPage,
                photos: mergedPhotos,
                menuItems: mergedMenuItems,
                coverImage: incomingPage.coverImage || current.coverImage,
                logo: incomingPage.logo || current.logo,
              });
            } else {
              // If incoming is canonical `user_<email>_business`, merge its photos/details into primary business page if one exists
              const isCanonicalBiz = String(incomingPage.id).startsWith('user_') && String(incomingPage.id).endsWith('_business');
              if (isCanonicalBiz && existing.length > 0) {
                const primary = qrMap.get(existing[0].id) || existing[0];
                const mergedPhotos =
                  Array.isArray(primary.photos) && primary.photos.length > 0
                    ? primary.photos
                    : Array.isArray(incomingPage.photos)
                    ? incomingPage.photos
                    : [];
                const mergedMenuItems =
                  Array.isArray(primary.menuItems) && primary.menuItems.length > 0
                    ? primary.menuItems
                    : Array.isArray(incomingPage.menuItems)
                    ? incomingPage.menuItems
                    : [];
                qrMap.set(primary.id, {
                  ...incomingPage,
                  ...primary,
                  id: primary.id,
                  photos: mergedPhotos,
                  menuItems: mergedMenuItems,
                  coverImage: primary.coverImage || incomingPage.coverImage,
                  logo: primary.logo || incomingPage.logo,
                });
              } else {
                qrMap.set(incomingPage.id, incomingPage);
              }
            }
          });
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, Array.from(qrMap.values()));
        }
      }
      if (Array.isArray(backupData.websitesQrItems)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.WEBSITES_QR, backupData.websitesQrItems);
        } else {
          const existing = this.getWebsitesQrItems();
          const webMap = new Map<string, any>();
          existing.forEach((w) => { if (w && w.id) webMap.set(w.id, w); });
          backupData.websitesQrItems.forEach((w) => { if (w && w.id) webMap.set(w.id, w); });
          writeToStorage(STORAGE_KEYS.WEBSITES_QR, Array.from(webMap.values()));
        }
      }
      if (Array.isArray(backupData.socialsQrItems)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.SOCIALS_QR, backupData.socialsQrItems);
        } else {
          const existing = this.getSocialsQrItems();
          const socialMap = new Map<string, any>();
          existing.forEach((s) => { if (s && s.id) socialMap.set(s.id, s); });
          backupData.socialsQrItems.forEach((s) => { if (s && s.id) socialMap.set(s.id, s); });
          writeToStorage(STORAGE_KEYS.SOCIALS_QR, Array.from(socialMap.values()));
        }
      }
      if (Array.isArray(backupData.eventsQrItems)) {
        if (replaceExisting) {
          writeToStorage(STORAGE_KEYS.EVENTS_QR, backupData.eventsQrItems);
        } else {
          const existing = this.getEventsQrItems();
          const evtMap = new Map<string, any>();
          existing.forEach((e) => { if (e && e.id) evtMap.set(e.id, e); });
          backupData.eventsQrItems.forEach((e) => { if (e && e.id) evtMap.set(e.id, e); });
          writeToStorage(STORAGE_KEYS.EVENTS_QR, Array.from(evtMap.values()));
        }
      }
      if (backupData.publicCatalogSettings && typeof backupData.publicCatalogSettings === 'object') {
        const currentCatalogSettings = readFromStorage<Partial<PublicCatalogSettings>>(STORAGE_KEYS.PUBLIC_CATALOG_SETTINGS, {});
        writeToStorage(STORAGE_KEYS.PUBLIC_CATALOG_SETTINGS, {
          ...currentCatalogSettings,
          ...backupData.publicCatalogSettings,
        });
      }
      const recCount = Array.isArray(backupData.receipts) ? backupData.receipts.length : 0;
      return {
        success: true,
        message: `Successfully restored ${recCount} receipts and settings!`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to import backup data',
      };
    }
  },

  // --- INVENTORY & STOCK MANAGEMENT ---
  getInventoryProducts(): InventoryProduct[] {
    const products = readFromStorage<InventoryProduct[]>(STORAGE_KEYS.INVENTORY_PRODUCTS, []);
    return products;
  },

  isItemIdTaken(itemId: string, excludeProductId?: string): boolean {
    if (!itemId || !itemId.trim()) return false;
    const cleanId = itemId.trim().toLowerCase();
    const products = this.getInventoryProducts();
    return products.some(
      (p) => p.id !== excludeProductId && p.itemId.trim().toLowerCase() === cleanId
    );
  },

  saveInventoryProduct(product: InventoryProduct): boolean {
    const products = this.getInventoryProducts();

    // Prevent saving duplicate Item ID
    const duplicate = products.find(
      (p) => p.id !== product.id && p.itemId.trim().toLowerCase() === product.itemId.trim().toLowerCase()
    );
    if (duplicate) {
      console.warn(`Product with ID "${product.itemId}" already exists ("${duplicate.name}")`);
      return false;
    }

    const existingIndex = products.findIndex((p) => p.id === product.id);
    if (existingIndex >= 0) {
      products[existingIndex] = { ...product, updatedAt: new Date().toISOString() };
    } else {
      products.unshift({ ...product, updatedAt: new Date().toISOString() });
    }
    const success = writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);

    // Check if low stock
    const threshold = 5;
    if (success && product.quantity <= threshold) {
      PushNotificationService.triggerBusinessAlert({
        title: `⚠️ Low Stock Warning: ${product.name}`,
        body: `Only ${product.quantity} items left in stock!`,
        type: 'low_stock',
      }).catch(() => {});
    }

    if (success) {
      // Auto-upload product photo to Cloudflare R2 if it is a base64 image string
      if (product.image && product.image.startsWith('data:image/')) {
        const prodId = product.id;
        const mimeType = product.image.slice(5, product.image.indexOf(';')) || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpeg';
        CloudflareService.uploadFile({
          data: product.image,
          filename: `product_${prodId}_${Date.now()}.${ext}`,
          mimeType,
          folder: 'photos',
        }).then((res) => {
          if (res.success && res.url) {
            const latestProds = this.getInventoryProducts();
            const pIdx = latestProds.findIndex((p) => p.id === prodId);
            if (pIdx >= 0) {
              latestProds[pIdx].image = res.url;
              writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, latestProds);
              CloudflareService.syncAllToCloudflare().catch(() => {});
              this.publishPublicCatalog().catch(() => {});
            }
          }
        }).catch(() => {});
      } else {
        CloudflareService.syncAllToCloudflare().catch(() => {});
        this.publishPublicCatalog().catch(() => {});
      }
    }

    return success;
  },

  deleteInventoryProduct(id: string): void {
    const products = this.getInventoryProducts();
    const remaining = products.filter((p) => p.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, remaining);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    this.publishPublicCatalog().catch(() => {});
  },

  getNextInventoryItemId(): string {
    const products = this.getInventoryProducts();
    let maxId = 0;
    for (const p of products) {
      const parsed = parseInt(p.itemId, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }
    return String(maxId + 1);
  },

  updateInventoryProductStock(productId: string, newQuantity: number): void {
    const products = this.getInventoryProducts();
    const product = products.find((p) => p.id === productId);
    if (product) {
      product.quantity = Math.max(0, newQuantity);
      product.updatedAt = new Date().toISOString();
      writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
      CloudflareService.syncAllToCloudflare().catch(() => {});
      this.publishPublicCatalog().catch(() => {});

      const threshold = 5;
      if (product.quantity <= threshold) {
        PushNotificationService.triggerBusinessAlert({
          title: `⚠️ Low Stock Warning: ${product.name}`,
          body: `Only ${product.quantity} items left in stock!`,
          type: 'low_stock',
        }).catch(() => {});
      }
    }
  },

  adjustInventoryProductStock(productId: string, delta: number): void {
    const products = this.getInventoryProducts();
    const product = products.find((p) => p.id === productId);
    if (product) {
      product.quantity = Math.max(0, product.quantity + delta);
      product.updatedAt = new Date().toISOString();
      writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
      CloudflareService.syncAllToCloudflare().catch(() => {});
      this.publishPublicCatalog().catch(() => {});

      const threshold = 5;
      if (product.quantity <= threshold) {
        PushNotificationService.triggerBusinessAlert({
          title: `⚠️ Low Stock Warning: ${product.name}`,
          body: `Only ${product.quantity} items left in stock!`,
          type: 'low_stock',
        }).catch(() => {});
      }
    }
  },

  // --- STOCK VIEW PREFERENCE (Grid vs List) ---
  getStockViewMode(): 'grid' | 'list' {
    return readFromStorage<'grid' | 'list'>(STORAGE_KEYS.STOCK_VIEW_MODE, 'grid');
  },

  setStockViewMode(mode: 'grid' | 'list'): void {
    writeToStorage(STORAGE_KEYS.STOCK_VIEW_MODE, mode);
  },

  // --- PUBLIC LIVE STOCK CATALOG ---
  resolveStoreOwnerEmail(emailOverride?: string): string {
    const candidates = [
      this.getWorkOSUser()?.email,
      this.getAuthenticatedEmail(),
      emailOverride,
      this.getProfile()?.email,
      this.getBrivuUserId(),
    ];
    for (const c of candidates) {
      const clean = String(c || '').toLowerCase().trim();
      if (clean && clean.includes('@') && !clean.startsWith('brivu-usr-') && !clean.includes('default_user')) {
        return clean;
      }
    }
    return '';
  },

  generateStoreSlug(businessName: string): string {
    if (!businessName || !businessName.trim()) return 'store';
    return businessName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'store';
  },

  getPublicCatalogSettings(): PublicCatalogSettings {
    const profile = this.getProfile();
    const ownerEmail = this.resolveStoreOwnerEmail();
    const defaultSlug = this.generateStoreSlug(profile.name || 'store');
    const saved = readFromStorage<Partial<PublicCatalogSettings>>(STORAGE_KEYS.PUBLIC_CATALOG_SETTINGS, {});
    const savedSlug = (saved.slug || '').trim();
    const resolvedSlug =
      savedSlug && savedSlug !== 'store'
        ? savedSlug
        : defaultSlug !== 'store'
        ? defaultSlug
        : savedSlug || defaultSlug;
    return {
      enabled: saved.enabled !== false, // default true
      slug: resolvedSlug,
      businessName: saved.businessName || profile.name || '',
      tagline: saved.tagline || profile.description || '',
      phone: saved.phone || profile.phone || '',
      whatsapp: saved.whatsapp || profile.whatsapp || profile.phone || '',
      email: ownerEmail || saved.email || profile.email || '',
      address: saved.address || profile.address || '',
      currency: saved.currency || profile.currency || 'UGX',
      showExactQuantity: saved.showExactQuantity !== false, // default true
      hideOutOfStock: saved.hideOutOfStock === true, // default false (show Out of Stock badge)
      allowWhatsAppOrders: saved.allowWhatsAppOrders !== false, // default true
      updatedAt: saved.updatedAt || new Date().toISOString(),
    };
  },

  getPublicCatalogUrl(overrideSlug?: string, emailOverride?: string): string {
    let workerUrl = (this.getCloudflareConfig().workerUrl || '').trim();
    if (!workerUrl || workerUrl.includes('localhost') || workerUrl.includes('127.0.0.1')) {
      workerUrl = 'https://brivu.shapesmm7.workers.dev';
    }
    const base = workerUrl.replace(/\/+$/, '');
    const settings = this.getPublicCatalogSettings();
    const cleanSlug = encodeURIComponent((overrideSlug || settings.slug || 'store').trim() || 'store');
    const ownerEmail = this.resolveStoreOwnerEmail(emailOverride || settings.email);
    const emailQuery = ownerEmail ? `?email=${encodeURIComponent(ownerEmail)}` : '';
    return `${base}/store/${cleanSlug}${emailQuery}`;
  },

  savePublicCatalogSettings(settings: Partial<PublicCatalogSettings>): PublicCatalogSettings {
    const current = this.getPublicCatalogSettings();
    const updated: PublicCatalogSettings = {
      ...current,
      ...settings,
      slug: settings.slug ? this.generateStoreSlug(settings.slug) : current.slug,
      updatedAt: new Date().toISOString(),
    };
    writeToStorage(STORAGE_KEYS.PUBLIC_CATALOG_SETTINGS, updated);
    this.publishPublicCatalog().catch(() => {});
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return updated;
  },

  toggleProductPublicCatalog(productId: string): boolean {
    const products = this.getInventoryProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return false;
    const currentStatus = product.isPublicInCatalog !== false;
    product.isPublicInCatalog = !currentStatus;
    product.updatedAt = new Date().toISOString();
    writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    this.publishPublicCatalog().catch(() => {});
    return product.isPublicInCatalog;
  },

  setAllProductsPublicCatalog(makePublic: boolean): void {
    const products = this.getInventoryProducts().map((p) => ({
      ...p,
      isPublicInCatalog: makePublic,
      updatedAt: new Date().toISOString(),
    }));
    writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    this.publishPublicCatalog().catch(() => {});
  },

  getPublicCatalogPayload(overrideSlug?: string): PublicCatalogPayload {
    const settings = this.getPublicCatalogSettings();
    const profile = this.getProfile();
    const ownerEmail = this.resolveStoreOwnerEmail(settings.email);
    const categories = this.getProductCategories();
    const rawProducts = this.getInventoryProducts();

    // Security: Filter to only products marked as public
    const publicProducts = rawProducts.filter((p) => p.isPublicInCatalog !== false);

    // Filter out of stock if business owner enabled hideOutOfStock
    const visibleProducts = settings.hideOutOfStock
      ? publicProducts.filter((p) => p.quantity > 0)
      : publicProducts;

    const categoryMap = new Map<string, ProductCategory>(categories.map((c: ProductCategory) => [c.id, c]));

    const catalogProducts: PublicCatalogProduct[] = visibleProducts.map((p) => {
      const cat = p.categoryId ? categoryMap.get(p.categoryId) : undefined;
      const isAvailable = p.quantity > 0;
      let status: 'in-stock' | 'low-stock' | 'out-of-stock' = 'in-stock';
      if (p.quantity === 0) {
        status = 'out-of-stock';
      } else if (p.quantity < 5) {
        status = 'low-stock';
      }

      // STRICT PRIVACY: NEVER expose costPrice, profit, tax details, or private notes!
      return {
        id: p.id,
        itemId: p.itemId,
        name: p.name,
        description: p.description,
        image: p.image,
        sizes: p.sizes,
        color: p.color,
        quantity: p.quantity,
        unit: p.unit,
        sellingPrice: p.sellingPrice,
        categoryId: p.categoryId,
        categoryName: cat?.name || p.category,
        categoryColor: cat?.color,
        isAvailable,
        status,
      };
    });

    const categoryCounts = categories.map((cat) => {
      const count = catalogProducts.filter((cp) => cp.categoryId === cat.id).length;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        count,
      };
    });

    return {
      settings: {
        ...settings,
        email: ownerEmail || settings.email || profile.email || '',
        slug: overrideSlug || settings.slug,
      },
      business: {
        name: profile.name || settings.businessName || 'Brivu Store',
        description: profile.description || settings.tagline || '',
        logo: profile.logo,
        phone: profile.phone || settings.phone || '',
        whatsapp: profile.whatsapp || profile.phone || settings.whatsapp || '',
        email: ownerEmail || profile.email || settings.email || '',
        address: profile.address || settings.address || '',
        currency: profile.currency || settings.currency || 'UGX',
      },
      categories: categoryCounts,
      products: catalogProducts,
      lastUpdated: new Date().toISOString(),
    };
  },

  async publishPublicCatalog(): Promise<{ success: boolean; url: string; error?: string }> {
    const settings = this.getPublicCatalogSettings();
    const ownerEmail = this.resolveStoreOwnerEmail(settings.email);
    const payload = this.getPublicCatalogPayload();
    const storeUrl = this.getPublicCatalogUrl(settings.slug, ownerEmail);

    try {
      const res = await CloudflareService.publishStoreCatalog(settings.slug, payload, ownerEmail);
      return {
        success: res.success,
        url: storeUrl,
        error: res.error,
      };
    } catch (err: any) {
      return {
        success: false,
        url: storeUrl,
        error: err?.message || 'Failed to sync catalog with cloud',
      };
    }
  },

  getInventorySales(): InventorySale[] {
    return readFromStorage<InventorySale[]>(STORAGE_KEYS.INVENTORY_SALES, []);
  },

  recordInventorySale(saleData: Omit<InventorySale, 'id' | 'createdAt'>): InventorySale {
    const sales = this.getInventorySales();
    const newSale: InventorySale = {
      ...saleData,
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    sales.unshift(newSale);
    writeToStorage(STORAGE_KEYS.INVENTORY_SALES, sales);

    // If sale is tied to an inventory product, deduct stock
    if (newSale.productId) {
      this.adjustInventoryProductStock(newSale.productId, -newSale.quantity);
    }
    CloudflareService.syncAllToCloudflare().catch(() => {});

    return newSale;
  },

  deleteInventorySale(id: string, restoreStock: boolean = true): void {
    const sales = this.getInventorySales();
    const saleToDelete = sales.find((s) => s.id === id);
    if (saleToDelete && restoreStock && saleToDelete.productId) {
      this.adjustInventoryProductStock(saleToDelete.productId, saleToDelete.quantity);
    }
    const filtered = sales.filter((s) => s.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_SALES, filtered);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  updateInventorySale(id: string, updates: Partial<InventorySale>): boolean {
    const sales = this.getInventorySales();
    const index = sales.findIndex((s) => s.id === id);
    if (index === -1) return false;
    const oldSale = sales[index];
    const newQty = updates.quantity !== undefined ? updates.quantity : oldSale.quantity;
    const newPrice = updates.sellingPrice !== undefined ? updates.sellingPrice : oldSale.sellingPrice;
    const updated: InventorySale = {
      ...oldSale,
      ...updates,
      totalPrice: newQty * newPrice,
      profit: (newPrice - oldSale.costPrice) * newQty,
    };

    if (updates.quantity !== undefined && updates.quantity !== oldSale.quantity && oldSale.productId) {
      const diff = updates.quantity - oldSale.quantity;
      this.adjustInventoryProductStock(oldSale.productId, -diff);
    }

    sales[index] = updated;
    writeToStorage(STORAGE_KEYS.INVENTORY_SALES, sales);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return true;
  },

  getInventoryExpenses(): InventoryExpense[] {
    return readFromStorage<InventoryExpense[]>(STORAGE_KEYS.INVENTORY_EXPENSES, []);
  },

  recordInventoryExpense(expenseData: Omit<InventoryExpense, 'id' | 'createdAt'>): InventoryExpense {
    const expenses = this.getInventoryExpenses();
    const newExpense: InventoryExpense = {
      ...expenseData,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    expenses.unshift(newExpense);
    writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, expenses);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newExpense;
  },

  deleteInventoryExpense(id: string): void {
    const expenses = this.getInventoryExpenses().filter((e) => e.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, expenses);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  updateInventoryExpense(updated: InventoryExpense): boolean {
    const expenses = this.getInventoryExpenses();
    const idx = expenses.findIndex((e) => e.id === updated.id);
    if (idx !== -1) {
      expenses[idx] = updated;
      writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, expenses);
      CloudflareService.syncAllToCloudflare().catch(() => {});
      return true;
    }
    return false;
  },

  getInventoryDebts(): InventoryDebt[] {
    return readFromStorage<InventoryDebt[]>(STORAGE_KEYS.INVENTORY_DEBTS, []);
  },

  recordInventoryDebt(
    debtData: Omit<InventoryDebt, 'id' | 'createdAt' | 'status'> & {
      status?: 'unpaid' | 'paid' | 'partial';
      paidAmount?: number;
    }
  ): InventoryDebt {
    const debts = this.getInventoryDebts();
    const newDebt: InventoryDebt = {
      ...debtData,
      id: `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: debtData.status || 'unpaid',
      paidAmount: debtData.paidAmount || 0,
      createdAt: new Date().toISOString(),
    };
    debts.unshift(newDebt);
    writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, debts);
    CloudflareService.syncAllToCloudflare().catch(() => {});

    // Trigger Debt Reminder Notification
    if (newDebt.amount > (newDebt.paidAmount || 0)) {
      PushNotificationService.triggerBusinessAlert({
        title: `💳 Customer Debt Recorded: ${newDebt.customerName}`,
        body: `Amount: ${newDebt.amount.toLocaleString()} due on ${newDebt.dueDate || 'due date'}. Status: ${newDebt.status.toUpperCase()}`,
        type: 'debt_reminder',
      }).catch(() => {});
    }

    return newDebt;
  },

  updateInventoryDebt(id: string, updates: Partial<InventoryDebt>): boolean {
    const debts = this.getInventoryDebts();
    const idx = debts.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    debts[idx] = { ...debts[idx], ...updates };
    const success = writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, debts);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteInventoryDebt(id: string): void {
    const debts = this.getInventoryDebts().filter((d) => d.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, debts);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  markInventoryDebtPaid(id: string, paidAmount?: number): void {
    const debts = this.getInventoryDebts();
    const debt = debts.find((d) => d.id === id);
    if (debt) {
      if (paidAmount !== undefined && paidAmount < debt.amount) {
        debt.status = 'partial';
        debt.paidAmount = paidAmount;
      } else {
        debt.status = 'paid';
        debt.paidAmount = debt.amount;
        debt.settledAt = new Date().toISOString();
      }
      writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, debts);
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
  },

  getInventoryStats() {
    const products = this.getInventoryProducts();
    const sales = this.getInventorySales();
    const expenses = this.getInventoryExpenses();

    let totalUnits = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      totalUnits += p.quantity;
      totalStockValue += p.quantity * p.sellingPrice;
      if (p.quantity === 0) {
        outOfStockCount++;
      } else if (p.quantity < 5) {
        lowStockCount++;
      }
    }

    let totalSalesAmount = 0;
    let totalNetProfit = 0;
    for (const s of sales) {
      totalSalesAmount += s.totalPrice;
      totalNetProfit += s.profit;
    }

    let totalExpensesAmount = 0;
    for (const e of expenses) {
      totalExpensesAmount += e.amount;
    }
    totalNetProfit -= totalExpensesAmount;

    // Today's sales
    const todayStr = new Date().toISOString().split('T')[0];
    let todaySalesAmount = 0;
    let todaySalesCount = 0;
    for (const s of sales) {
      if (s.date === todayStr || s.createdAt.startsWith(todayStr)) {
        todaySalesAmount += s.totalPrice;
        todaySalesCount++;
      }
    }

    return {
      totalProducts: products.length,
      totalUnits,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
      totalSalesAmount,
      totalExpensesAmount,
      totalNetProfit,
      todaySalesAmount,
      todaySalesCount,
    };
  },

  getShoppingListItems(): ShoppingListItem[] {
    return readFromStorage<ShoppingListItem[]>(STORAGE_KEYS.SHOPPING_LIST, []);
  },

  getShoppingList(): ShoppingListItem[] {
    return this.getShoppingListItems();
  },

  addShoppingListItem(itemData: Omit<ShoppingListItem, 'id' | 'createdAt' | 'checked'> & { checked?: boolean }): ShoppingListItem {
    const items = this.getShoppingListItems();
    const newItem: ShoppingListItem = {
      ...itemData,
      id: `shop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      checked: itemData.checked || false,
      createdAt: new Date().toISOString(),
    };
    items.push(newItem); // Keep normal order (append to end of list)
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newItem;
  },

  updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): boolean {
    const items = this.getShoppingListItems();
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    items[idx] = { ...items[idx], ...updates };
    const success = writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteShoppingListItem(id: string): void {
    const items = this.getShoppingListItems().filter((item) => item.id !== id);
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  clearCheckedShoppingListItems(): void {
    const items = this.getShoppingListItems().filter((item) => !item.checked);
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  clearAllShoppingListItems(): void {
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, []);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  getShoppingCategories(): ShoppingCategory[] {
    return readFromStorage<ShoppingCategory[]>(STORAGE_KEYS.SHOPPING_CATEGORIES, []);
  },

  addShoppingCategory(name: string, color?: string): ShoppingCategory {
    const cats = this.getShoppingCategories();
    const newCat: ShoppingCategory = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      color: color || '#64748b',
      createdAt: new Date().toISOString(),
    };
    cats.push(newCat);
    writeToStorage(STORAGE_KEYS.SHOPPING_CATEGORIES, cats);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newCat;
  },

  deleteShoppingCategory(id: string): void {
    const cats = this.getShoppingCategories().filter((cat) => cat.id !== id);
    writeToStorage(STORAGE_KEYS.SHOPPING_CATEGORIES, cats);

    // Re-assign items in deleted category to undefined or empty string
    const items = this.getShoppingListItems().map((item) => {
      if (item.categoryId === id) {
        const { categoryId, ...rest } = item;
        return rest as any;
      }
      return item;
    });
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  getProductCategories(): ProductCategory[] {
    return readFromStorage<ProductCategory[]>(STORAGE_KEYS.PRODUCT_CATEGORIES, []);
  },

  addProductCategory(name: string, color?: string): ProductCategory {
    const cats = this.getProductCategories();
    const newCat: ProductCategory = {
      id: `pcat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      color: color || '#64748b',
      createdAt: new Date().toISOString(),
    };
    cats.push(newCat);
    writeToStorage(STORAGE_KEYS.PRODUCT_CATEGORIES, cats);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newCat;
  },

  deleteProductCategory(id: string): void {
    const cats = this.getProductCategories().filter((cat) => cat.id !== id);
    writeToStorage(STORAGE_KEYS.PRODUCT_CATEGORIES, cats);

    // Re-assign products in deleted category to uncategorized
    const products = this.getInventoryProducts().map((prod) => {
      if (prod.categoryId === id) {
        const { categoryId, ...rest } = prod;
        return rest as any;
      }
      return prod;
    });
    writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
    CloudflareService.syncAllToCloudflare().catch(() => {});
  },

  // Save in-progress draft to recover if user accidentally closes app
  saveDraft(draft: Partial<Receipt>): void {
    writeToStorage(STORAGE_KEYS.DRAFT, draft);
  },

  getDraft(): Partial<Receipt> | null {
    return readFromStorage<Partial<Receipt> | null>(STORAGE_KEYS.DRAFT, null);
  },

  clearDraft(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.DRAFT);
    } catch {
      // ignore
    }
  },

  // --- CUSTOMER MANAGEMENT ---
  getCustomers(): Customer[] {
    return readFromStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  },

  saveCustomers(customers: Customer[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.CUSTOMERS, customers);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customers = this.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    customers.unshift(newCustomer);
    writeToStorage(STORAGE_KEYS.CUSTOMERS, customers);

    // Auto-upload customer photo to Cloudflare R2 if it is base64
    if (newCustomer.profilePic && newCustomer.profilePic.startsWith('data:image/')) {
      const custId = newCustomer.id;
      const mimeType = newCustomer.profilePic.slice(5, newCustomer.profilePic.indexOf(';')) || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpeg';
      CloudflareService.uploadFile({
        data: newCustomer.profilePic,
        filename: `customer_${custId}_${Date.now()}.${ext}`,
        mimeType,
        folder: 'photos',
      }).then((res) => {
        if (res.success && res.url) {
          const latest = this.getCustomers();
          const idx = latest.findIndex((c) => c.id === custId);
          if (idx >= 0) {
            latest[idx].profilePic = res.url;
            writeToStorage(STORAGE_KEYS.CUSTOMERS, latest);
            CloudflareService.syncAllToCloudflare().catch(() => {});
          }
        }
      }).catch(() => {});
    } else {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }

    return newCustomer;
  },

  updateCustomer(id: string, updates: Partial<Customer>): boolean {
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) return false;
    customers[index] = { ...customers[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.CUSTOMERS, customers);

    if (success) {
      if (updates.profilePic && updates.profilePic.startsWith('data:image/')) {
        const mimeType = updates.profilePic.slice(5, updates.profilePic.indexOf(';')) || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpeg';
        CloudflareService.uploadFile({
          data: updates.profilePic,
          filename: `customer_${id}_${Date.now()}.${ext}`,
          mimeType,
          folder: 'photos',
        }).then((res) => {
          if (res.success && res.url) {
            const latest = this.getCustomers();
            const idx = latest.findIndex((c) => c.id === id);
            if (idx >= 0) {
              latest[idx].profilePic = res.url;
              writeToStorage(STORAGE_KEYS.CUSTOMERS, latest);
              CloudflareService.syncAllToCloudflare().catch(() => {});
            }
          }
        }).catch(() => {});
      } else {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    }
    return success;
  },

  deleteCustomer(id: string): boolean {
    const customers = this.getCustomers();
    const filtered = customers.filter((c) => c.id !== id);
    const success = writeToStorage(STORAGE_KEYS.CUSTOMERS, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- AGENT MANAGEMENT ---
  getAgents(): BusinessAgent[] {
    return readFromStorage<BusinessAgent[]>(STORAGE_KEYS.AGENTS, []);
  },

  saveAgents(agents: BusinessAgent[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.AGENTS, agents);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addAgent(agent: Omit<BusinessAgent, 'id' | 'createdAt'>): BusinessAgent {
    const agents = this.getAgents();
    const newAgent: BusinessAgent = {
      ...agent,
      id: `agent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    agents.unshift(newAgent);
    writeToStorage(STORAGE_KEYS.AGENTS, agents);

    // Auto-upload agent photo to Cloudflare R2 if base64
    if (newAgent.profilePic && newAgent.profilePic.startsWith('data:image/')) {
      const agentId = newAgent.id;
      const mimeType = newAgent.profilePic.slice(5, newAgent.profilePic.indexOf(';')) || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpeg';
      CloudflareService.uploadFile({
        data: newAgent.profilePic,
        filename: `agent_${agentId}_${Date.now()}.${ext}`,
        mimeType,
        folder: 'photos',
      }).then((res) => {
        if (res.success && res.url) {
          const latest = this.getAgents();
          const idx = latest.findIndex((a) => a.id === agentId);
          if (idx >= 0) {
            latest[idx].profilePic = res.url;
            writeToStorage(STORAGE_KEYS.AGENTS, latest);
            CloudflareService.syncAllToCloudflare().catch(() => {});
          }
        }
      }).catch(() => {});
    } else {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }

    return newAgent;
  },

  updateAgent(id: string, updates: Partial<BusinessAgent>): boolean {
    const agents = this.getAgents();
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) return false;
    agents[index] = { ...agents[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.AGENTS, agents);

    if (success) {
      if (updates.profilePic && updates.profilePic.startsWith('data:image/')) {
        const mimeType = updates.profilePic.slice(5, updates.profilePic.indexOf(';')) || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpeg';
        CloudflareService.uploadFile({
          data: updates.profilePic,
          filename: `agent_${id}_${Date.now()}.${ext}`,
          mimeType,
          folder: 'photos',
        }).then((res) => {
          if (res.success && res.url) {
            const latest = this.getAgents();
            const idx = latest.findIndex((a) => a.id === id);
            if (idx >= 0) {
              latest[idx].profilePic = res.url;
              writeToStorage(STORAGE_KEYS.AGENTS, latest);
              CloudflareService.syncAllToCloudflare().catch(() => {});
            }
          }
        }).catch(() => {});
      } else {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    }
    return success;
  },

  deleteAgent(id: string): boolean {
    const agents = this.getAgents();
    const filtered = agents.filter((a) => a.id !== id);
    const success = writeToStorage(STORAGE_KEYS.AGENTS, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- AGENT LEDGER / STOCK & PAYMENT RECORDS ---
  getAgentLedger(agentId?: string): AgentLedgerRecord[] {
    const records = readFromStorage<AgentLedgerRecord[]>(STORAGE_KEYS.AGENT_LEDGER, []);
    if (!agentId) return records;
    return records.filter((r) => r.agentId === agentId);
  },

  addAgentLedgerRecord(record: Omit<AgentLedgerRecord, 'id' | 'createdAt'>): AgentLedgerRecord {
    const records = this.getAgentLedger();
    const newRecord: AgentLedgerRecord = {
      ...record,
      id: `agledger-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newRecord);
    writeToStorage(STORAGE_KEYS.AGENT_LEDGER, records);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newRecord;
  },

  updateAgentLedgerRecord(id: string, updates: Partial<AgentLedgerRecord>): boolean {
    const records = this.getAgentLedger();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.AGENT_LEDGER, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteAgentLedgerRecord(id: string): boolean {
    const records = this.getAgentLedger();
    const filtered = records.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.AGENT_LEDGER, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- WORKER / STAFF MANAGEMENT ---
  getWorkers(): BusinessWorker[] {
    return readFromStorage<BusinessWorker[]>(STORAGE_KEYS.WORKERS, []);
  },

  saveWorkers(workers: BusinessWorker[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.WORKERS, workers);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addWorker(worker: Omit<BusinessWorker, 'id' | 'createdAt'>): BusinessWorker {
    const workers = this.getWorkers();
    const newWorker: BusinessWorker = {
      ...worker,
      id: `worker-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    workers.unshift(newWorker);
    writeToStorage(STORAGE_KEYS.WORKERS, workers);

    // Auto-upload worker photo to Cloudflare R2 if base64
    if (newWorker.profilePic && newWorker.profilePic.startsWith('data:image/')) {
      const workerId = newWorker.id;
      const mimeType = newWorker.profilePic.slice(5, newWorker.profilePic.indexOf(';')) || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpeg';
      CloudflareService.uploadFile({
        data: newWorker.profilePic,
        filename: `staff_${workerId}_${Date.now()}.${ext}`,
        mimeType,
        folder: 'photos',
      }).then((res) => {
        if (res.success && res.url) {
          const latest = this.getWorkers();
          const idx = latest.findIndex((w) => w.id === workerId);
          if (idx >= 0) {
            latest[idx].profilePic = res.url;
            writeToStorage(STORAGE_KEYS.WORKERS, latest);
            CloudflareService.syncAllToCloudflare().catch(() => {});
          }
        }
      }).catch(() => {});
    } else {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }

    return newWorker;
  },

  updateWorker(id: string, updates: Partial<BusinessWorker>): boolean {
    const workers = this.getWorkers();
    const index = workers.findIndex((w) => w.id === id);
    if (index === -1) return false;
    workers[index] = { ...workers[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.WORKERS, workers);

    if (success) {
      if (updates.profilePic && updates.profilePic.startsWith('data:image/')) {
        const mimeType = updates.profilePic.slice(5, updates.profilePic.indexOf(';')) || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpeg';
        CloudflareService.uploadFile({
          data: updates.profilePic,
          filename: `staff_${id}_${Date.now()}.${ext}`,
          mimeType,
          folder: 'photos',
        }).then((res) => {
          if (res.success && res.url) {
            const latest = this.getWorkers();
            const idx = latest.findIndex((w) => w.id === id);
            if (idx >= 0) {
              latest[idx].profilePic = res.url;
              writeToStorage(STORAGE_KEYS.WORKERS, latest);
              CloudflareService.syncAllToCloudflare().catch(() => {});
            }
          }
        }).catch(() => {});
      } else {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    }
    return success;
  },

  deleteWorker(id: string): boolean {
    const workers = this.getWorkers();
    const filtered = workers.filter((w) => w.id !== id);
    const success = writeToStorage(STORAGE_KEYS.WORKERS, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- STAFF ATTENDANCE MANAGEMENT ---
  getStaffAttendance(workerId?: string): StaffAttendanceRecord[] {
    const records = readFromStorage<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    if (workerId) {
      return records.filter((r) => r.workerId === workerId);
    }
    return records;
  },

  saveStaffAttendance(records: StaffAttendanceRecord[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addStaffAttendance(record: Omit<StaffAttendanceRecord, 'id' | 'createdAt'>): StaffAttendanceRecord {
    const records = this.getStaffAttendance();
    const newRecord: StaffAttendanceRecord = {
      ...record,
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newRecord);
    writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, records);
    CloudflareService.syncAllToCloudflare().catch(() => {});

    // Trigger notification
    const workerName = this.getWorkers().find((w) => w.id === record.workerId)?.name || 'Staff Member';
    PushNotificationService.triggerBusinessAlert({
      title: `👤 Staff Check-in: ${workerName}`,
      body: `Status: ${record.status.toUpperCase()} (${record.date})`,
      type: 'staff',
    }).catch(() => {});

    return newRecord;
  },

  updateStaffAttendance(id: string, updates: Partial<StaffAttendanceRecord>): boolean {
    const records = this.getStaffAttendance();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteStaffAttendance(id: string): boolean {
    const records = this.getStaffAttendance();
    const filtered = records.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- STAFF LOSSES MANAGEMENT ---
  getStaffLosses(workerId?: string): StaffLossRecord[] {
    const records = readFromStorage<StaffLossRecord[]>(STORAGE_KEYS.STAFF_LOSSES, []);
    if (workerId) {
      return records.filter((r) => r.workerId === workerId);
    }
    return records;
  },

  saveStaffLosses(records: StaffLossRecord[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.STAFF_LOSSES, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addStaffLoss(record: Omit<StaffLossRecord, 'id' | 'createdAt'>): StaffLossRecord {
    const records = this.getStaffLosses();
    const newRecord: StaffLossRecord = {
      ...record,
      id: `loss-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newRecord);
    writeToStorage(STORAGE_KEYS.STAFF_LOSSES, records);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newRecord;
  },

  updateStaffLoss(id: string, updates: Partial<StaffLossRecord>): boolean {
    const records = this.getStaffLosses();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.STAFF_LOSSES, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteStaffLoss(id: string): boolean {
    const records = this.getStaffLosses();
    const filtered = records.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.STAFF_LOSSES, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- STAFF SALES MANAGEMENT ---
  getStaffSales(workerId?: string): StaffSaleRecord[] {
    const records = readFromStorage<StaffSaleRecord[]>(STORAGE_KEYS.STAFF_SALES, []);
    if (workerId) {
      return records.filter((r) => r.workerId === workerId);
    }
    return records;
  },

  saveStaffSales(records: StaffSaleRecord[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.STAFF_SALES, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addStaffSale(record: Omit<StaffSaleRecord, 'id' | 'createdAt'>): StaffSaleRecord {
    const records = this.getStaffSales();
    const newRecord: StaffSaleRecord = {
      ...record,
      id: `ssale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newRecord);
    writeToStorage(STORAGE_KEYS.STAFF_SALES, records);
    CloudflareService.syncAllToCloudflare().catch(() => {});
    return newRecord;
  },

  updateStaffSale(id: string, updates: Partial<StaffSaleRecord>): boolean {
    const records = this.getStaffSales();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.STAFF_SALES, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteStaffSale(id: string): boolean {
    const records = this.getStaffSales();
    const filtered = records.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.STAFF_SALES, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- STAFF INCIDENTS & MISTAKES MANAGEMENT ---
  getStaffIncidents(workerId?: string): StaffIncidentRecord[] {
    const records = readFromStorage<StaffIncidentRecord[]>(STORAGE_KEYS.STAFF_INCIDENTS, []);
    if (workerId) {
      return records.filter((r) => r.workerId === workerId);
    }
    return records;
  },

  saveStaffIncidents(records: StaffIncidentRecord[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  addStaffIncident(record: Omit<StaffIncidentRecord, 'id' | 'createdAt'>): StaffIncidentRecord {
    const records = this.getStaffIncidents();
    const newRecord: StaffIncidentRecord = {
      ...record,
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    records.unshift(newRecord);
    writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, records);
    CloudflareService.syncAllToCloudflare().catch(() => {});

    // Trigger Staff Incident Notification
    const workerName = this.getWorkers().find((w) => w.id === record.workerId)?.name || 'Staff Member';
    PushNotificationService.triggerBusinessAlert({
      title: `🚨 Staff Incident: ${record.title || record.type}`,
      body: `Staff: ${workerName} | Type: ${record.type} | ${record.notes || 'Logged in manager system.'}`,
      type: 'staff',
    }).catch(() => {});

    return newRecord;
  },

  updateStaffIncident(id: string, updates: Partial<StaffIncidentRecord>): boolean {
    const records = this.getStaffIncidents();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    const success = writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, records);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  deleteStaffIncident(id: string): boolean {
    const records = this.getStaffIncidents();
    const filtered = records.filter((r) => r.id !== id);
    const success = writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, filtered);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // ==================== QR CODE HOSTED PAGES (DIGITAL MENUS & BUSINESS SHOWCASES) ====================

  getHostedQRPages(): QRCodeHostedPage[] {
    const profile = this.getProfile();
    const createDefault = (): QRCodeHostedPage => ({
      id: `qr-${Date.now().toString(36)}`,
      title: profile.name || '',
      tagline: profile.description || '',
      description: '',
      pageType: 'menu',
      accentColor: '#059669',
      theme: 'emerald',
      phone: profile.phone || '',
      whatsapp: profile.whatsapp || profile.phone || '',
      email: profile.email || '',
      address: profile.address || '',
      googleMapsUrl: '',
      wifiName: '',
      wifiPassword: '',
      openingHours: '',
      currency: profile.currency || 'UGX',
      announcement: '',
      allowWhatsAppOrdering: true,
      socialLinks: {
        instagram: '',
        facebook: '',
        website: profile.website || '',
      },
      photos: [],
      menuCategories: ['All'],
      menuItems: [],
      qrDarkColor: '#000000',
      qrEyeColor: '#000000',
      qrLightColor: '#ffffff',
      qrBoxBgColor: '#ffffff',
      qrBoxBorderColor: '#e2e8f0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      const data = localStorage.getItem(STORAGE_KEYS.QR_HOSTED_PAGES);
      if (!data) {
        const initial = createDefault();
        try {
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, [initial]);
        } catch {}
        return [initial];
      }

      let parsed: QRCodeHostedPage[] = [];
      try {
        parsed = JSON.parse(data) as QRCodeHostedPage[];
      } catch {
        parsed = [];
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = createDefault();
        try {
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, [initial]);
        } catch {}
        return [initial];
      }

      // Business QR Pages only: strictly filter out any event, website, social or hub pages
      const businessPages = parsed.filter(
        (p) =>
          p &&
          typeof p === 'object' &&
          !p.id.startsWith('event-') &&
          !p.id.startsWith('events-hub-') &&
          !p.id.startsWith('test-event-') &&
          !p.id.startsWith('web-') &&
          !p.id.startsWith('social-')
      );

      if (businessPages.length === 0) {
        const initial = createDefault();
        try {
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, [initial]);
        } catch {}
        return [initial];
      }

      if (businessPages.length !== parsed.length) {
        try {
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, businessPages);
        } catch {}
      }
      return businessPages;
    } catch {
      const initial = createDefault();
      return [initial];
    }
  },

  getHostedQRPage(id: string): QRCodeHostedPage | undefined {
    const pages = this.getHostedQRPages();
    const cleanId = (id || '').trim();
    const found = pages.find(
      (p) =>
        p.id === cleanId ||
        `business-${p.id}` === cleanId ||
        p.id.replace(/^qr-/, 'business-') === cleanId
    );
    if (found) return found;

    if (
      cleanId.startsWith('business-hub-') ||
      cleanId === 'business-latest' ||
      cleanId === 'default' ||
      cleanId === 'latest'
    ) {
      if (pages.length > 0) return pages[0];
    }

    try {
      const business = this.getProfile();
      // 1. Websites & Apps Hub or Single Website Link
      if (
        id.startsWith('websites-hub') ||
        id.startsWith('web-hub') ||
        id.startsWith('website') ||
        id.startsWith('web-') ||
        id === 'websites' ||
        id === 'websites-hub-all' ||
        id.includes('websites-hub') ||
        id.includes('web-hub')
      ) {
        const websites = this.getWebsitesQrItems();
        return QRHostingService.convertWebsitesHubToHostedPage(websites, business);
      }

      // 2. Socials Hub or Single Social Link
      if (
        id.startsWith('socials-hub') ||
        id.startsWith('social-hub') ||
        id.startsWith('social') ||
        id.startsWith('social-') ||
        id === 'socials' ||
        id === 'socials-hub-all' ||
        id.includes('socials-hub') ||
        id.includes('social-hub')
      ) {
        const socials = this.getSocialsQrItems();
        return QRHostingService.convertSocialsHubToHostedPage(socials, business);
      }

      // 3. Events Hub or Single Event
      const events = this.getEventsQrItems();
      if (
        id.startsWith('events-hub') ||
        id.startsWith('event-hub') ||
        id === 'events' ||
        id === 'events-hub-all' ||
        id.includes('events-hub')
      ) {
        return QRHostingService.convertEventsHubToHostedPage(events, business);
      }
      const foundEvt = events.find((e) => e.id === id);
      if (foundEvt) {
        return QRHostingService.convertEventToHostedPage(foundEvt, business);
      }
      if (id.startsWith('event-')) {
        return QRHostingService.convertEventsHubToHostedPage(events, business);
      }
    } catch {}
    return undefined;
  },

  getAllHostedPagesForSync(): QRCodeHostedPage[] {
    const businessPages = this.getHostedQRPages();
    try {
      const events = this.getEventsQrItems();
      const websites = this.getWebsitesQrItems();
      const socials = this.getSocialsQrItems();
      const business = this.getProfile();
      const eventPages = events.map((e) => QRHostingService.convertEventToHostedPage(e, business));
      const hubPage = QRHostingService.convertEventsHubToHostedPage(events, business);
      const websitesHubPage = QRHostingService.convertWebsitesHubToHostedPage(websites, business);
      const socialsHubPage = QRHostingService.convertSocialsHubToHostedPage(socials, business);
      return [...businessPages, ...eventPages, hubPage, websitesHubPage, socialsHubPage];
    } catch {
      return businessPages;
    }
  },

  saveHostedQRPagesLocalOnly(pages: QRCodeHostedPage[]): boolean {
    const businessPages = pages.filter(
      (p) =>
        !p.id.startsWith('event-') &&
        !p.id.startsWith('events-hub-') &&
        !p.id.startsWith('websites-hub-') &&
        !p.id.startsWith('socials-hub-') &&
        !p.id.startsWith('test-event-') &&
        !p.id.startsWith('web-') &&
        !p.id.startsWith('social-')
    );
    return writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, businessPages);
  },

  saveHostedQRPages(pages: QRCodeHostedPage[]): boolean {
    const businessPages = pages.filter(
      (p) =>
        !p.id.startsWith('event-') &&
        !p.id.startsWith('events-hub-') &&
        !p.id.startsWith('websites-hub-') &&
        !p.id.startsWith('socials-hub-') &&
        !p.id.startsWith('test-event-') &&
        !p.id.startsWith('web-') &&
        !p.id.startsWith('social-')
    );
    const success = writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, businessPages);
    if (success) {
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  saveHostedQRPage(page: QRCodeHostedPage, options?: { immediate?: boolean }): boolean {
    if (
      page.id.startsWith('event-') ||
      page.id.startsWith('events-hub-') ||
      page.id.startsWith('websites-hub-') ||
      page.id.startsWith('socials-hub-') ||
      page.id.startsWith('test-event-') ||
      page.id.startsWith('web-') ||
      page.id.startsWith('social-')
    ) {
      // Special QR page - sync directly to Cloudflare
      CloudflareService.saveSingleQrPage(page, undefined, options).catch(() => {});
      return true;
    }
    const pages = this.getHostedQRPages();
    const index = pages.findIndex((p) => p.id === page.id);
    let updatedPage = { ...page, updatedAt: new Date().toISOString() };
    if (index >= 0) {
      pages[index] = updatedPage;
    } else {
      updatedPage.createdAt = updatedPage.createdAt || new Date().toISOString();
      pages.push(updatedPage);
    }
    const success = writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, pages);

    // Asynchronously upload any base64 images (cover image, logo, gallery photos, menu item photos) to Cloudflare R2
    if (success) {
      const pageId = updatedPage.id;
      const uploadPromises: Promise<any>[] = [];

      // 1. Cover Image
      if (updatedPage.coverImage && updatedPage.coverImage.startsWith('data:image/')) {
        const mime = updatedPage.coverImage.slice(5, updatedPage.coverImage.indexOf(';')) || 'image/jpeg';
        const ext = mime.split('/')[1] || 'jpeg';
        uploadPromises.push(
          CloudflareService.uploadFile({
            data: updatedPage.coverImage,
            filename: `qr_cover_${pageId}_${Date.now()}.${ext}`,
            mimeType: mime,
            folder: 'photos',
          }).then((res) => {
            if (res.success && res.url) {
              const currentPages = this.getHostedQRPages();
              const pIdx = currentPages.findIndex((p) => p.id === pageId);
              if (pIdx >= 0) {
                currentPages[pIdx].coverImage = res.url;
                writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, currentPages);
              }
            }
          }).catch(() => {})
        );
      }

      // 2. Business Logo
      if (updatedPage.logo && updatedPage.logo.startsWith('data:image/')) {
        const mime = updatedPage.logo.slice(5, updatedPage.logo.indexOf(';')) || 'image/png';
        const ext = mime.split('/')[1] || 'png';
        uploadPromises.push(
          CloudflareService.uploadFile({
            data: updatedPage.logo,
            filename: `qr_logo_${pageId}_${Date.now()}.${ext}`,
            mimeType: mime,
            folder: 'photos',
          }).then((res) => {
            if (res.success && res.url) {
              const currentPages = this.getHostedQRPages();
              const pIdx = currentPages.findIndex((p) => p.id === pageId);
              if (pIdx >= 0) {
                currentPages[pIdx].logo = res.url;
                writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, currentPages);
              }
            }
          }).catch(() => {})
        );
      }

      // 3. Gallery Photos
      if (Array.isArray(updatedPage.photos)) {
        updatedPage.photos.forEach((photo, photoIndex) => {
          if (photo.url && photo.url.startsWith('data:image/')) {
            const mime = photo.url.slice(5, photo.url.indexOf(';')) || 'image/jpeg';
            const ext = mime.split('/')[1] || 'jpeg';
            uploadPromises.push(
              CloudflareService.uploadFile({
                data: photo.url,
                filename: `qr_photo_${pageId}_${photo.id || photoIndex}_${Date.now()}.${ext}`,
                mimeType: mime,
                folder: 'photos',
              }).then((res) => {
                if (res.success && res.url) {
                  const currentPages = this.getHostedQRPages();
                  const pIdx = currentPages.findIndex((p) => p.id === pageId);
                  if (pIdx >= 0 && currentPages[pIdx].photos?.[photoIndex]) {
                    currentPages[pIdx].photos[photoIndex].url = res.url;
                    writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, currentPages);
                  }
                }
              }).catch(() => {})
            );
          }
        });
      }

      // 4. Menu / Catalog Item Photos
      if (Array.isArray(updatedPage.menuItems)) {
        updatedPage.menuItems.forEach((item, itemIndex) => {
          if (item.photoUrl && item.photoUrl.startsWith('data:image/')) {
            const mime = item.photoUrl.slice(5, item.photoUrl.indexOf(';')) || 'image/jpeg';
            const ext = mime.split('/')[1] || 'jpeg';
            uploadPromises.push(
              CloudflareService.uploadFile({
                data: item.photoUrl,
                filename: `qr_item_${pageId}_${item.id || itemIndex}_${Date.now()}.${ext}`,
                mimeType: mime,
                folder: 'photos',
              }).then((res) => {
                if (res.success && res.url) {
                  const currentPages = this.getHostedQRPages();
                  const pIdx = currentPages.findIndex((p) => p.id === pageId);
                  if (pIdx >= 0 && currentPages[pIdx].menuItems?.[itemIndex]) {
                    currentPages[pIdx].menuItems[itemIndex].photoUrl = res.url;
                    writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, currentPages);
                  }
                }
              }).catch(() => {})
            );
          }
        });
      }

      if (uploadPromises.length > 0) {
        Promise.all(uploadPromises).then(() => {
          const fresh = this.getHostedQRPage(pageId) || updatedPage;
          CloudflareService.saveSingleQrPage(fresh, undefined, { immediate: true }).catch(() => {});
          CloudflareService.syncAllToCloudflare(undefined, { immediate: true }).catch(() => {});
        }).catch(() => {});
      } else {
        CloudflareService.saveSingleQrPage(updatedPage, undefined, options).catch(() => {});
        CloudflareService.syncAllToCloudflare(undefined, options).catch(() => {});
      }
    }

    return success;
  },

  deleteHostedQRPage(id: string): boolean {
    const pages = this.getHostedQRPages();
    const filtered = pages.filter((p) => p.id !== id);
    const success = writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, filtered);
    if (success) {
      CloudflareService.deleteHostedQrPage(id).catch(() => {});
      CloudflareService.syncAllToCloudflare().catch(() => {});
    }
    return success;
  },

  // --- WEBSITES / APPS QR ITEMS ---
  getWebsitesQrItems(): WebsiteAppQrItem[] {
    const raw = readFromStorage<WebsiteAppQrItem[]>(STORAGE_KEYS.WEBSITES_QR, []);
    return (raw || []).filter(
      (item) =>
        item &&
        item.id !== 'web-default-1' &&
        !item.id.includes('default') &&
        !item.id.includes('sample') &&
        !item.title?.toLowerCase().includes('sample')
    );
  },

  saveWebsitesQrItems(items: WebsiteAppQrItem[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.WEBSITES_QR, items);
    if (success) {
      try {
        const business = this.getProfile();
        QRHostingService.syncAllWebsitesPages(items, business).catch(() => {});
      } catch {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    }
    return success;
  },

  // --- SOCIALS QR ITEMS ---
  getSocialsQrItems(): SocialQrItem[] {
    const raw = readFromStorage<SocialQrItem[]>(STORAGE_KEYS.SOCIALS_QR, []);
    return (raw || []).filter(
      (item) =>
        item &&
        item.id !== 'social-wa-1' &&
        item.id !== 'social-ig-1' &&
        !item.id.includes('default') &&
        !item.id.includes('sample') &&
        !item.title?.toLowerCase().includes('sample')
    );
  },

  saveSocialsQrItems(items: SocialQrItem[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.SOCIALS_QR, items);
    if (success) {
      try {
        const business = this.getProfile();
        QRHostingService.syncAllSocialsPages(items, business).catch(() => {});
      } catch {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    }
    return success;
  },

  // --- EVENTS QR ITEMS ---
  getEventsQrItems(): EventQrItem[] {
    const raw = readFromStorage<EventQrItem[]>(STORAGE_KEYS.EVENTS_QR, []);
    return (raw || []).filter(
      (item) =>
        item &&
        item.id !== 'event-default-1' &&
        !item.id.includes('default') &&
        !item.id.includes('sample') &&
        !item.title?.toLowerCase().includes('sample')
    );
  },

  saveEventsQrItems(items: EventQrItem[]): boolean {
    const success = writeToStorage(STORAGE_KEYS.EVENTS_QR, items);
    if (success) {
      try {
        const business = this.getProfile();
        QRHostingService.syncAllEventsPages(items, business).catch(() => {});
      } catch {
        CloudflareService.syncAllToCloudflare().catch(() => {});
      }
    }
    return success;
  },

  getSubscription(): UserSubscription | null {
    const sub = readFromStorage<UserSubscription | null>(STORAGE_KEYS.SUBSCRIPTION, null);
    if (!sub) return null;
    // Check if expired
    if (sub.status === 'active' && sub.expiresAt) {
      if (new Date(sub.expiresAt).getTime() < Date.now()) {
        const expiredSub: UserSubscription = { ...sub, status: 'expired' };
        writeToStorage(STORAGE_KEYS.SUBSCRIPTION, expiredSub);
        return expiredSub;
      }
    }
    return sub;
  },

  saveSubscription(subscription: UserSubscription): boolean {
    return writeToStorage(STORAGE_KEYS.SUBSCRIPTION, subscription);
  },

  clearSubscription(): boolean {
    return writeToStorage(STORAGE_KEYS.SUBSCRIPTION, null);
  },

  // --- APP LOCK & INTRUDER SECURITY ---
  getAppLockConfig(): AppLockConfig | null {
    return readFromStorage<AppLockConfig | null>(STORAGE_KEYS.APP_LOCK, null);
  },

  saveAppLockConfig(config: AppLockConfig | null): boolean {
    return writeToStorage(STORAGE_KEYS.APP_LOCK, config);
  },

  isAppLocked(): boolean {
    const config = this.getAppLockConfig();
    if (!config || !config.isEnabled || !config.pin) {
      return false;
    }
    // If auto-lock on app open/reload is enabled (autoLockOnExit !== false, default is true):
    // ALWAYS require the passcode whenever the app is opened, launched, or reloaded
    if (config.autoLockOnExit !== false) {
      return true;
    }
    // If auto-lock on open was explicitly turned off by the user, only lock if explicitly locked
    const lockedState = readFromStorage<boolean | null>(STORAGE_KEYS.APP_LOCKED_STATE, null);
    return lockedState === true;
  },

  setAppLocked(locked: boolean): boolean {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('brivu_session_unlocked');
      } catch {
        // Safe fallback
      }
    }
    return writeToStorage(STORAGE_KEYS.APP_LOCKED_STATE, locked);
  },

  getAuthenticatedEmail(): string {
    const user = this.getWorkOSUser();
    if (user && user.email && user.email.includes('@')) {
      return user.email.toLowerCase().trim();
    }
    const profile = this.getProfile();
    if (profile && profile.email && profile.email.includes('@')) {
      return profile.email.toLowerCase().trim();
    }
    return '';
  },

  getBrivuUserId(): string {
    return this.getAuthenticatedEmail();
  },

  getCloudflareConfig(): CloudflareConfig {
    const defaultVal: CloudflareConfig = {
      workerUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDFLARE_WORKER_URL) || 'https://brivu.shapesmm7.workers.dev',
      apiKey: '',
      autoSaveFiles: true,
      autoSyncData: true,
      lastStatus: 'untested',
      filesFolder: 'receipts',
    };
    const loaded = readFromStorage<CloudflareConfig>(STORAGE_KEYS.CLOUDFLARE, defaultVal);
    if (!loaded.workerUrl || loaded.workerUrl.trim() === '' || loaded.workerUrl.includes('localhost') || loaded.workerUrl.includes('127.0.0.1')) {
      loaded.workerUrl = defaultVal.workerUrl;
      writeToStorage(STORAGE_KEYS.CLOUDFLARE, loaded);
    }
    const authEmail = this.getAuthenticatedEmail();
    if (authEmail && (!loaded.apiKey || loaded.apiKey.trim() === '')) {
      loaded.apiKey = authEmail;
      writeToStorage(STORAGE_KEYS.CLOUDFLARE, loaded);
    }
    return loaded;
  },

  saveCloudflareConfig(config: CloudflareConfig): CloudflareConfig {
    writeToStorage(STORAGE_KEYS.CLOUDFLARE, config);
    return config;
  },

  syncReceiptToCloudflare(receipt: Receipt): void {
    try {
      const user = this.getWorkOSUser();
      const status = this.getTrialStatus();
      if (!user?.email && status.isExpired && !this.isSubscribed()) {
        console.info('Skip background Cloudflare receipt sync: Trial expired without subscription.');
        return;
      }

      const config = this.getCloudflareConfig();
      if (!config.workerUrl || config.autoSyncData === false) return;
      const url = config.workerUrl.replace(/\/$/, '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiKey && config.apiKey.trim() !== '') {
        headers['X-Sync-Key'] = config.apiKey.trim();
        headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
      }
      if (user && user.email) {
        headers['X-User-Email'] = user.email.toLowerCase().trim();
        headers['X-User-Id'] = user.email.toLowerCase().trim();
      }
      fetch(`${url}/api/receipts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(receipt),
      }).catch((err) => {
        console.warn('Background Cloudflare receipt sync note:', err);
      });
    } catch {
      // Non-blocking
    }
  },

  // --- FREE TRIAL, GRACE PERIOD, AND PURGE LIFE CYCLE ---
  getInstallDate(): string {
    let date = localStorage.getItem(STORAGE_KEYS.INSTALL_DATE);
    if (!date) {
      date = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.INSTALL_DATE, date);
    }
    return date;
  },

  getDaysSinceInstall(): number {
    const installDate = this.getInstallDate();
    const diffTime = Date.now() - new Date(installDate).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  },

  isSubscribed(): boolean {
    const sub = this.getSubscription();
    return Boolean(sub && sub.status === 'active');
  },

  getTrialStatus() {
    const daysSinceInstall = this.getDaysSinceInstall();
    const subscribed = this.isSubscribed();

    // Free trial lasts for exactly 7 days
    const isFreeTrial = daysSinceInstall <= 7;
    // Grace period lasts for exactly 7 days after free trial (day 8 to 14)
    const isGracePeriod = !isFreeTrial && daysSinceInstall <= 14 && !subscribed;
    // Expired without subscription (above 7 days since install and not subscribed)
    const isExpired = daysSinceInstall > 7 && !subscribed;
    // Grace period expired without subscription (above 14 days)
    const isGracePeriodExpired = daysSinceInstall > 14 && !subscribed;

    const remainingTrialDays = Math.max(0, 7 - daysSinceInstall);
    const remainingGraceDays = Math.max(0, 14 - daysSinceInstall);

    return {
      daysSinceInstall,
      isFreeTrial,
      isGracePeriod,
      isExpired,
      isGracePeriodExpired,
      remainingTrialDays,
      remainingGraceDays,
      subscribed,
    };
  },

  async purgeAllCloudData(): Promise<{ success: boolean; message: string }> {
    try {
      const config = this.getCloudflareConfig();
      if (!config.workerUrl) {
        return { success: false, message: 'Cloudflare Worker is not configured' };
      }
      
      const cleanUrl = config.workerUrl.replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (config.apiKey && config.apiKey.trim() !== '') {
        headers['X-Sync-Key'] = config.apiKey.trim();
        headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
      }

      // 1. Wipe bulk D1 backup by pushing an empty backup
      const emptyBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: { name: '', currency: 'UGX' },
        settings: { currency: 'UGX' },
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
        qrHostedPages: [],
      };
      
      await fetch(`${cleanUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupData: emptyBackup }),
      }).catch(() => {});

      // 2. Clear hosted QR pages individually from D1
      const localPages = this.getHostedQRPages();
      for (const p of localPages) {
        await fetch(`${cleanUrl}/api/qr/${encodeURIComponent(p.id)}`, {
          method: 'DELETE',
          headers,
        }).catch(() => {});
      }

      // Mark that cloud has been wiped/purged
      localStorage.setItem('quickreceipt_cloud_wiped_v1', 'true');
      return { success: true, message: 'All cloud files and backups permanently purged from Cloudflare' };
    } catch (err: any) {
      console.warn('Wipe all cloud data error:', err);
      return { success: false, message: err.message || 'Purge failed' };
    }
  },

  getWorkOSUser(): WorkOSUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKOS_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveWorkOSUser(user: WorkOSUser | null): void {
    try {
      if (!user) {
        localStorage.removeItem(STORAGE_KEYS.WORKOS_USER);
      } else {
        const cleanEmail = (user.email || '').toLowerCase().trim();
        const updatedUser: WorkOSUser = {
          ...user,
          id: cleanEmail || user.id,
          email: cleanEmail,
        };
        localStorage.setItem(STORAGE_KEYS.WORKOS_USER, JSON.stringify(updatedUser));
        if (cleanEmail) {
          writeToStorage(STORAGE_KEYS.BRIVU_USER_ID, cleanEmail);
        }
      }
    } catch (err) {
      console.warn('Failed to save WorkOS user to localStorage:', err);
    }
  },

  /**
   * Resets all business and operational records from the active workspace.
   * Ensures that when a user logs out or switches accounts, no private receipts or customer data remain.
   */
  clearActiveUserData(): void {
    writeToStorage(STORAGE_KEYS.RECEIPTS, []);
    try {
      localStorage.removeItem(STORAGE_KEYS.DRAFT);
    } catch {}
    writeToStorage(STORAGE_KEYS.PROFILE, { ...DEFAULT_BUSINESS_PROFILE });
    writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, []);
    writeToStorage(STORAGE_KEYS.INVENTORY_SALES, []);
    writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, []);
    writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, []);
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, []);
    writeToStorage(STORAGE_KEYS.SHOPPING_CATEGORIES, []);
    writeToStorage(STORAGE_KEYS.PRODUCT_CATEGORIES, []);
    writeToStorage(STORAGE_KEYS.CUSTOMERS, []);
    writeToStorage(STORAGE_KEYS.AGENTS, []);
    writeToStorage(STORAGE_KEYS.AGENT_LEDGER, []);
    writeToStorage(STORAGE_KEYS.WORKERS, []);
    writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    writeToStorage(STORAGE_KEYS.STAFF_LOSSES, []);
    writeToStorage(STORAGE_KEYS.STAFF_SALES, []);
    writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, []);
    writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, []);
    writeToStorage(STORAGE_KEYS.WEBSITES_QR, []);
    writeToStorage(STORAGE_KEYS.SOCIALS_QR, []);
    writeToStorage(STORAGE_KEYS.EVENTS_QR, []);
    writeToStorage(STORAGE_KEYS.DELETED_RECEIPTS, []);
  },

  /**
   * Switches user session cleanly:
   * 1. Caches previous user's workspace locally so nothing is lost if they return.
   * 2. Clears the active workspace so previous user's data never leaks to new account.
   * 3. If newUserEmail is provided, restores cached data for newUserEmail if available,
   *    or starts with a clean empty slate.
   */
  switchUserSession(newUserEmail: string | null): void {
    const activeWorkspaceUser = (localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_USER) || '').toLowerCase().trim();
    const prevUser = this.getWorkOSUser();
    const prevEmail = (prevUser?.email || activeWorkspaceUser || '').toLowerCase().trim();
    const cleanNewEmail = (newUserEmail || '').toLowerCase().trim();

    // 1. If previous user had data in active workspace, securely cache it into their private local vault
    if (prevEmail) {
      try {
        const backup = this.exportBackup();
        localStorage.setItem(`brivu_vault_${prevEmail}`, JSON.stringify(backup));
      } catch (err) {
        console.warn('Failed to cache user vault:', err);
      }
    }

    if (!cleanNewEmail) {
      // User signed out:
      try {
        localStorage.removeItem(STORAGE_KEYS.WORKOS_USER);
        localStorage.removeItem(STORAGE_KEYS.BRIVU_USER_ID);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKSPACE_USER);
        const cf = readFromStorage<CloudflareConfig>(STORAGE_KEYS.CLOUDFLARE, null as any);
        if (cf) {
          cf.apiKey = '';
          writeToStorage(STORAGE_KEYS.CLOUDFLARE, cf);
        }
        // Securely clear the active workspace so previous user's data never leaks to unauthorized viewers
        this.clearActiveUserData();
      } catch {}
      return;
    }

    // User signed in:
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_USER, cleanNewEmail);
    writeToStorage(STORAGE_KEYS.BRIVU_USER_ID, cleanNewEmail);

    const cf = this.getCloudflareConfig();
    cf.apiKey = cleanNewEmail;
    this.saveCloudflareConfig(cf);

    // If switching between two registered user accounts (User A -> User B):
    if (prevEmail && prevEmail !== cleanNewEmail) {
      // Clear active workspace completely to guarantee ZERO data leakage across users
      this.clearActiveUserData();

      const vaultJson = localStorage.getItem(`brivu_vault_${cleanNewEmail}`);
      if (vaultJson) {
        try {
          const vaultData = JSON.parse(vaultJson);
          this.importBackup(vaultData, true);
        } catch (_) {}
      } else {
        // Fresh account on this device: set up fresh slate for cleanNewEmail
        const cleanName = cleanNewEmail.split('@')[0] || 'My Business';
        const formattedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        const freshProfile = {
          ...DEFAULT_BUSINESS_PROFILE,
          name: formattedTitle,
          email: cleanNewEmail,
          currency: 'UGX',
        };
        this.saveProfile(freshProfile);

        const initialQr: QRCodeHostedPage = {
          id: `qr-${Date.now().toString(36)}`,
          title: formattedTitle,
          tagline: '',
          description: '',
          pageType: 'menu',
          accentColor: '#059669',
          theme: 'emerald',
          email: cleanNewEmail,
          userEmail: cleanNewEmail,
          currency: 'UGX',
          allowWhatsAppOrdering: true,
          photos: [],
          menuCategories: ['All'],
          menuItems: [],
          qrDarkColor: '#000000',
          qrEyeColor: '#000000',
          qrLightColor: '#ffffff',
          qrBoxBgColor: '#ffffff',
          qrBoxBorderColor: '#e2e8f0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, [initialQr]);
      }
    } else if (!prevEmail) {
      // User created data locally/offline before logging in:
      // PRESERVE all existing local receipts, products, shopping lists, and debts!
      const vaultJson = localStorage.getItem(`brivu_vault_${cleanNewEmail}`);
      if (vaultJson) {
        try {
          const vaultData = JSON.parse(vaultJson);
          // Restore user's cached local vault records immediately into active workspace
          this.importBackup(vaultData, true);
        } catch (_) {}
      }
      const prof = this.getProfile();
      if (!prof.email) {
        this.saveProfile({
          ...prof,
          email: cleanNewEmail,
        });
      }
    } else {
      const prof = this.getProfile();
      this.saveProfile({
        ...prof,
        email: cleanNewEmail,
      });
    }
  },

  clearWorkOSUser(): void {
    this.switchUserSession(null);
  },

  /**
   * Exports full app backup with remote R2/HTTP product, client, agent, staff, and profile photos
   * embedded as compact WebP data URLs (`imageBackupData`, `profilePicBackupData`, etc.) so backups
   * remain 100% self-contained even if products or R2 files are deleted before restoring.
   */
  async exportBackupWithEmbeddedPhotos(): Promise<AppBackupData & { brivuUserId?: string }> {
    const backup = this.exportBackup();
    const workerBase = (this.getCloudflareConfig().workerUrl || 'https://brivu.shapesmm7.workers.dev').replace(/\/+$/, '');
    const resolveImageUrl = (raw?: string): string => {
      if (!raw) return '';
      const trimmed = raw.trim();
      if (trimmed.startsWith('/api/files/')) return `${workerBase}${trimmed}`;
      return trimmed;
    };

    const { compressImageToWebP } = await import('../utils/imageCompressor');

    const embedPhotoDataUri = async (rawSrc?: string, maxDim = 360, quality = 0.72): Promise<string | undefined> => {
      if (!rawSrc) return undefined;
      const src = resolveImageUrl(rawSrc);
      if (src.startsWith('data:image/')) {
        if (src.length <= 140000) return src;
        try {
          const compressed = await compressImageToWebP(src, {
            maxWidth: maxDim,
            maxHeight: maxDim,
            quality,
            mimeType: 'image/webp',
          });
          return compressed.dataUri;
        } catch {
          return src;
        }
      }
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        return undefined;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const res = await fetch(src, { signal: controller.signal });
        if (!res.ok) return undefined;
        const cType = (res.headers.get('content-type') || '').toLowerCase();
        const blob = await res.blob();
        const blobType = (blob.type || cType || '').toLowerCase();
        if (!blob || blob.size === 0) return undefined;
        if (blobType.includes('text/html') || blobType.includes('application/json')) return undefined;
        if (!blobType.startsWith('image/') && !cType.startsWith('image/')) return undefined;

        try {
          const compressed = await compressImageToWebP(blob, {
            maxWidth: maxDim,
            maxHeight: maxDim,
            quality,
            mimeType: 'image/webp',
          });
          return compressed.dataUri;
        } catch {
          return await new Promise<string | undefined>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === 'string' && reader.result.startsWith('data:image/') ? reader.result : undefined);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        return undefined;
      } finally {
        clearTimeout(timer);
      }
    };

    const mapConcurrent = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
      const results: R[] = new Array(items.length);
      let nextIdx = 0;
      const runWorker = async () => {
        while (nextIdx < items.length) {
          const idx = nextIdx++;
          results[idx] = await fn(items[idx]);
        }
      };
      const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => runWorker());
      await Promise.all(workers);
      return results;
    };

    if (Array.isArray(backup.inventoryProducts) && backup.inventoryProducts.length > 0) {
      backup.inventoryProducts = await mapConcurrent(backup.inventoryProducts, 4, async (prod: any) => {
        const existingEmbedded = typeof prod?.imageBackupData === 'string' && prod.imageBackupData.startsWith('data:image/')
          ? prod.imageBackupData
          : undefined;
        const embedded = existingEmbedded || (await embedPhotoDataUri(prod?.image, 360, 0.72));
        return embedded ? { ...prod, imageBackupData: embedded } : prod;
      });
    }

    if (Array.isArray(backup.customers) && backup.customers.length > 0) {
      backup.customers = await mapConcurrent(backup.customers, 4, async (cust: any) => {
        const embedded = await embedPhotoDataUri(cust?.profilePic, 300, 0.72);
        return embedded ? { ...cust, profilePicBackupData: embedded } : cust;
      });
    }

    if (Array.isArray(backup.agents) && backup.agents.length > 0) {
      backup.agents = await mapConcurrent(backup.agents, 4, async (agent: any) => {
        const embedded = await embedPhotoDataUri(agent?.profilePic, 300, 0.72);
        return embedded ? { ...agent, profilePicBackupData: embedded } : agent;
      });
    }

    if (Array.isArray(backup.workers) && backup.workers.length > 0) {
      backup.workers = await mapConcurrent(backup.workers, 4, async (worker: any) => {
        const embedded = await embedPhotoDataUri(worker?.profilePic, 300, 0.72);
        return embedded ? { ...worker, profilePicBackupData: embedded } : worker;
      });
    }

    if (backup.profile) {
      const logoEmbedded = await embedPhotoDataUri(backup.profile.logo, 400, 0.78);
      const sigEmbedded = await embedPhotoDataUri(backup.profile.signature, 500, 0.78);
      (backup.profile as any) = {
        ...backup.profile,
        ...(logoEmbedded ? { logoBackupData: logoEmbedded } : {}),
        ...(sigEmbedded ? { signatureBackupData: sigEmbedded } : {}),
      };
    }

    return backup;
  },

  /**
   * Verifies restored product, customer, agent, staff, and profile photos.
   * If a restored remote image URL returns 404 or non-image content (e.g., deleted from R2),
   * immediately restores its embedded `*BackupData` data URL locally and re-uploads to R2.
   * Also re-uploads any restored `data:image/` photos to R2 in the background.
   */
  async recoverRestoredProductPhotos(backupData?: any): Promise<void> {
    if (typeof window === 'undefined') return;
    const workerBase = (this.getCloudflareConfig().workerUrl || 'https://brivu.shapesmm7.workers.dev').replace(/\/+$/, '');
    const normalizeImgUrl = (raw?: string): string => {
      if (!raw) return '';
      const trimmed = raw.trim();
      if (trimmed.startsWith('/api/files/')) return `${workerBase}${trimmed}`;
      return trimmed;
    };

    const verifyRemoteImage = async (rawUrl?: string): Promise<boolean> => {
      const target = normalizeImgUrl(rawUrl);
      if (!target || (!target.startsWith('http://') && !target.startsWith('https://'))) {
        return false;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(target, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) return false;
        const cType = (res.headers.get('content-type') || '').toLowerCase();
        if (cType.includes('text/html') || cType.includes('application/json')) return false;
        return cType.startsWith('image/');
      } catch {
        // Offline or transient network error: do not mark as permanently dead unless HTTP responded non-image
        return true;
      } finally {
        clearTimeout(timer);
      }
    };

    const emitRefresh = () => {
      window.dispatchEvent(new CustomEvent('brivu_data_restored'));
      window.dispatchEvent(new Event('storage_updated'));
      window.dispatchEvent(new Event('storage'));
    };

    const uploadDataUriToR2 = async (dataUri: string, filenamePrefix: string, folder = 'photos'): Promise<string | null> => {
      if (!dataUri.startsWith('data:image/')) return null;
      if (!CloudflareService.isConfigured() || !CloudflareService.getUserEmail()) return null;
      try {
        const mimeMatch = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
        const mimeType = mimeMatch?.[1] || 'image/webp';
        const ext = (mimeType.split('/')[1] || 'webp').replace('jpeg', 'jpg');
        const upRes = await CloudflareService.uploadFile({
          data: dataUri,
          filename: `${filenamePrefix}_${Date.now()}.${ext}`,
          mimeType,
          folder,
        });
        return upRes.success && upRes.url ? upRes.url : null;
      } catch {
        return null;
      }
    };

    const rawIncomingProducts = Array.isArray(backupData?.inventoryProducts)
      ? backupData.inventoryProducts
      : (Array.isArray(backupData?.products) ? backupData.products : []);
    const prodBackupMap = new Map<string, string>();
    for (const rp of rawIncomingProducts) {
      if (!rp?.id) continue;
      const fallback = rp.imageBackupData || (typeof rp.image === 'string' && rp.image.startsWith('data:image/') ? rp.image : '');
      if (fallback && fallback.startsWith('data:image/')) {
        prodBackupMap.set(String(rp.id), fallback);
      }
    }

    let inventoryChanged = false;
    const products = this.getInventoryProducts();
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const backupImg = prodBackupMap.get(prod.id);
      if (!prod.image && backupImg) {
        products[i] = { ...prod, image: backupImg };
        inventoryChanged = true;
      } else if (prod.image && !prod.image.startsWith('data:image/')) {
        const ok = await verifyRemoteImage(prod.image);
        if (!ok && backupImg) {
          products[i] = { ...prod, image: backupImg };
          inventoryChanged = true;
        }
      }
    }

    if (inventoryChanged) {
      writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
      emitRefresh();
    }

    // Re-upload any data:image product photos to R2 so URLs work on web/live catalog too
    let reuploadedAnyProduct = false;
    for (const prod of products) {
      if (prod.image && prod.image.startsWith('data:image/')) {
        const uploadedUrl = await uploadDataUriToR2(prod.image, `product_${prod.id}`, 'photos');
        if (uploadedUrl) {
          const latest = this.getInventoryProducts();
          const idx = latest.findIndex((p) => p.id === prod.id);
          if (idx >= 0 && latest[idx].image?.startsWith('data:image/')) {
            latest[idx] = { ...latest[idx], image: uploadedUrl };
            writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, latest);
            reuploadedAnyProduct = true;
          }
        }
      }
    }
    if (reuploadedAnyProduct || inventoryChanged) {
      emitRefresh();
      this.publishPublicCatalog().catch(() => {});
    }

    const recoverPersonPhotos = async (
      list: any[],
      rawIncoming: any[],
      storageKey: string,
      prefix: string
    ) => {
      const bMap = new Map<string, string>();
      for (const item of rawIncoming) {
        if (!item?.id) continue;
        const fb = item.profilePicBackupData || (typeof item.profilePic === 'string' && item.profilePic.startsWith('data:image/') ? item.profilePic : '');
        if (fb && fb.startsWith('data:image/')) bMap.set(String(item.id), fb);
      }
      let changed = false;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const fb = bMap.get(item.id);
        if (!item.profilePic && fb) {
          list[i] = { ...item, profilePic: fb };
          changed = true;
        } else if (item.profilePic && !item.profilePic.startsWith('data:image/')) {
          const ok = await verifyRemoteImage(item.profilePic);
          if (!ok && fb) {
            list[i] = { ...item, profilePic: fb };
            changed = true;
          }
        }
      }
      if (changed) {
        writeToStorage(storageKey, list);
        emitRefresh();
      }
      for (const item of list) {
        if (item.profilePic && item.profilePic.startsWith('data:image/')) {
          const url = await uploadDataUriToR2(item.profilePic, `${prefix}_${item.id}`, 'photos');
          if (url) {
            const latest = readFromStorage<any[]>(storageKey, []);
            const idx = latest.findIndex((x) => x.id === item.id);
            if (idx >= 0 && latest[idx].profilePic?.startsWith('data:image/')) {
              latest[idx] = { ...latest[idx], profilePic: url };
              writeToStorage(storageKey, latest);
              emitRefresh();
            }
          }
        }
      }
    };

    await recoverPersonPhotos(
      this.getCustomers(),
      Array.isArray(backupData?.customers) ? backupData.customers : [],
      STORAGE_KEYS.CUSTOMERS,
      'customer'
    );
    await recoverPersonPhotos(
      this.getAgents(),
      Array.isArray(backupData?.agents) ? backupData.agents : [],
      STORAGE_KEYS.AGENTS,
      'agent'
    );
    await recoverPersonPhotos(
      this.getWorkers(),
      Array.isArray(backupData?.workers) ? backupData.workers : [],
      STORAGE_KEYS.WORKERS,
      'staff'
    );

    if (backupData?.profile) {
      const prof = this.getProfile();
      let profChanged = false;
      const logoFb = backupData.profile.logoBackupData;
      const sigFb = backupData.profile.signatureBackupData;
      if (logoFb && (!prof.logo || (!prof.logo.startsWith('data:image/') && !(await verifyRemoteImage(prof.logo))))) {
        prof.logo = logoFb;
        profChanged = true;
      }
      if (sigFb && (!prof.signature || (!prof.signature.startsWith('data:image/') && !(await verifyRemoteImage(prof.signature))))) {
        prof.signature = sigFb;
        profChanged = true;
      }
      if (profChanged) {
        this.saveProfile(prof);
        emitRefresh();
      }
    }
  },
};
