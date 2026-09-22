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
  UserSubscription,
  AppLockConfig,
} from '../types';
import { PushNotificationService } from './pushNotificationService';

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
  SUBSCRIPTION: 'quickreceipt_subscription_v1',
  APP_LOCK: 'quickreceipt_app_lock_config_v1',
  APP_LOCKED_STATE: 'quickreceipt_app_locked_state_v1',
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
  numberPadding: 6,
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

      // 3. Global cleanup: strip heavy images from stored inventory products
      try {
        const rawInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY_PRODUCTS);
        if (rawInventory && rawInventory.length > 300000) {
          const parsed = JSON.parse(rawInventory) as InventoryProduct[];
          const cleaned = parsed.map((p, idx) => (idx > 2 ? { ...p, image: undefined } : p));
          localStorage.setItem(STORAGE_KEYS.INVENTORY_PRODUCTS, JSON.stringify(cleaned));
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
          const optimized = (value as InventoryProduct[]).map((p, idx) => {
            if (idx > 3 || (p.image && p.image.length > 50000)) {
              return { ...p, image: undefined };
            }
            return p;
          });
          localStorage.setItem(key, JSON.stringify(optimized));
          console.info('Successfully saved inventory products after image compression cleanup.');
          return true;
        } catch {
          try {
            const noImages = (value as InventoryProduct[]).map((p) => ({ ...p, image: undefined }));
            localStorage.setItem(key, JSON.stringify(noImages));
            console.warn('Saved inventory products without images to avoid quota failure.');
            return true;
          } catch (lastErr) {
            console.error('Failed to save inventory products even without images:', lastErr);
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

export const StorageService = {
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
    return writeToStorage(STORAGE_KEYS.PROFILE, profile);
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
    return settings;
  },

  saveSettings(settings: AppSettings): boolean {
    return writeToStorage(STORAGE_KEYS.SETTINGS, settings);
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

  getReceipts(): Receipt[] {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    if (!data) {
      // First time initialization
      writeToStorage(STORAGE_KEYS.RECEIPTS, INITIAL_SAMPLE_RECEIPTS);
      return INITIAL_SAMPLE_RECEIPTS;
    }
    try {
      const parsed = JSON.parse(data) as Receipt[];
      return parsed.filter((r) => !r.id.startsWith('sample-'));
    } catch {
      return [];
    }
  },

  getReceiptById(id: string): Receipt | undefined {
    const receipts = this.getReceipts();
    return receipts.find((r) => r.id === id);
  },

  saveReceipt(receipt: Receipt): boolean {
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

  deleteReceipt(id: string): boolean {
    const receipts = this.getReceipts();
    const filtered = receipts.filter((r) => r.id !== id);
    return writeToStorage(STORAGE_KEYS.RECEIPTS, filtered);
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
    let candidate = `${settings.receiptPrefix}${String(currentNum).padStart(settings.numberPadding, '0')}`;

    while (existingNumbers.has(candidate)) {
      currentNum++;
      candidate = `${settings.receiptPrefix}${String(currentNum).padStart(settings.numberPadding, '0')}`;
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
    let candidate = `${prefix}${String(currentNum).padStart(settings.numberPadding, '0')}`;

    while (existingNumbers.has(candidate)) {
      currentNum++;
      candidate = `${prefix}${String(currentNum).padStart(settings.numberPadding, '0')}`;
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

  exportBackup(): AppBackupData {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      settings: this.getSettings(),
      receipts: this.getReceipts(),
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
      qrHostedPages: this.getHostedQRPages(),
    };
  },

  importBackup(backupData: AppBackupData): { success: boolean; message: string } {
    if (!backupData || typeof backupData !== 'object') {
      return { success: false, message: 'Invalid backup file format' };
    }
    if (!Array.isArray(backupData.receipts)) {
      return { success: false, message: 'Backup file missing receipts data' };
    }

    try {
      if (backupData.profile) {
        this.saveProfile(backupData.profile);
      }
      if (backupData.settings) {
        this.saveSettings(backupData.settings);
      }
      writeToStorage(STORAGE_KEYS.RECEIPTS, backupData.receipts);
      if (Array.isArray(backupData.inventoryProducts)) {
        writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, backupData.inventoryProducts);
      }
      if (Array.isArray(backupData.inventorySales)) {
        writeToStorage(STORAGE_KEYS.INVENTORY_SALES, backupData.inventorySales);
      }
      if (Array.isArray(backupData.inventoryExpenses)) {
        writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, backupData.inventoryExpenses);
      }
      if (Array.isArray(backupData.inventoryDebts)) {
        writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, backupData.inventoryDebts);
      }
      if (Array.isArray(backupData.shoppingListItems)) {
        writeToStorage(STORAGE_KEYS.SHOPPING_LIST, backupData.shoppingListItems);
      }
      if (Array.isArray(backupData.shoppingCategories)) {
        writeToStorage(STORAGE_KEYS.SHOPPING_CATEGORIES, backupData.shoppingCategories);
      }
      if (Array.isArray(backupData.productCategories)) {
        writeToStorage(STORAGE_KEYS.PRODUCT_CATEGORIES, backupData.productCategories);
      }
      if (Array.isArray(backupData.customers)) {
        writeToStorage(STORAGE_KEYS.CUSTOMERS, backupData.customers);
      }
      if (Array.isArray(backupData.agents)) {
        writeToStorage(STORAGE_KEYS.AGENTS, backupData.agents);
      }
      if (Array.isArray(backupData.workers)) {
        writeToStorage(STORAGE_KEYS.WORKERS, backupData.workers);
      }
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
      if (Array.isArray(backupData.qrHostedPages)) {
        writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, backupData.qrHostedPages);
      }
      return {
        success: true,
        message: `Successfully restored ${backupData.receipts.length} receipts and settings!`,
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

    // Check if any product has an enormous uncompressed photo that could cause quota issues
    const hasBloatedImage = products.some((p) => p.image && p.image.length > 50000);
    if (hasBloatedImage) {
      setTimeout(() => {
        try {
          const sanitized = products.map((p) => {
            if (p.image && p.image.length > 50000) {
              return { ...p, image: undefined };
            }
            return p;
          });
          writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, sanitized);
        } catch {}
      }, 50);
    }

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

    return success;
  },

  deleteInventoryProduct(id: string): void {
    const products = this.getInventoryProducts().filter((p) => p.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_PRODUCTS, products);
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
    return newExpense;
  },

  deleteInventoryExpense(id: string): void {
    const expenses = this.getInventoryExpenses().filter((e) => e.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_EXPENSES, expenses);
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
    return writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, debts);
  },

  deleteInventoryDebt(id: string): void {
    const debts = this.getInventoryDebts().filter((d) => d.id !== id);
    writeToStorage(STORAGE_KEYS.INVENTORY_DEBTS, debts);
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
    return newItem;
  },

  updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): boolean {
    const items = this.getShoppingListItems();
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    items[idx] = { ...items[idx], ...updates };
    return writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
  },

  deleteShoppingListItem(id: string): void {
    const items = this.getShoppingListItems().filter((item) => item.id !== id);
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
  },

  clearCheckedShoppingListItems(): void {
    const items = this.getShoppingListItems().filter((item) => !item.checked);
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, items);
  },

  clearAllShoppingListItems(): void {
    writeToStorage(STORAGE_KEYS.SHOPPING_LIST, []);
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
    return writeToStorage(STORAGE_KEYS.CUSTOMERS, customers);
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
    return newCustomer;
  },

  updateCustomer(id: string, updates: Partial<Customer>): boolean {
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) return false;
    customers[index] = { ...customers[index], ...updates };
    return writeToStorage(STORAGE_KEYS.CUSTOMERS, customers);
  },

  deleteCustomer(id: string): boolean {
    const customers = this.getCustomers();
    const filtered = customers.filter((c) => c.id !== id);
    return writeToStorage(STORAGE_KEYS.CUSTOMERS, filtered);
  },

  // --- AGENT MANAGEMENT ---
  getAgents(): BusinessAgent[] {
    return readFromStorage<BusinessAgent[]>(STORAGE_KEYS.AGENTS, []);
  },

  saveAgents(agents: BusinessAgent[]): boolean {
    return writeToStorage(STORAGE_KEYS.AGENTS, agents);
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
    return newAgent;
  },

  updateAgent(id: string, updates: Partial<BusinessAgent>): boolean {
    const agents = this.getAgents();
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) return false;
    agents[index] = { ...agents[index], ...updates };
    return writeToStorage(STORAGE_KEYS.AGENTS, agents);
  },

  deleteAgent(id: string): boolean {
    const agents = this.getAgents();
    const filtered = agents.filter((a) => a.id !== id);
    return writeToStorage(STORAGE_KEYS.AGENTS, filtered);
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
    return newRecord;
  },

  updateAgentLedgerRecord(id: string, updates: Partial<AgentLedgerRecord>): boolean {
    const records = this.getAgentLedger();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    return writeToStorage(STORAGE_KEYS.AGENT_LEDGER, records);
  },

  deleteAgentLedgerRecord(id: string): boolean {
    const records = this.getAgentLedger();
    const filtered = records.filter((r) => r.id !== id);
    return writeToStorage(STORAGE_KEYS.AGENT_LEDGER, filtered);
  },

  // --- WORKER / STAFF MANAGEMENT ---
  getWorkers(): BusinessWorker[] {
    return readFromStorage<BusinessWorker[]>(STORAGE_KEYS.WORKERS, []);
  },

  saveWorkers(workers: BusinessWorker[]): boolean {
    return writeToStorage(STORAGE_KEYS.WORKERS, workers);
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
    return newWorker;
  },

  updateWorker(id: string, updates: Partial<BusinessWorker>): boolean {
    const workers = this.getWorkers();
    const index = workers.findIndex((w) => w.id === id);
    if (index === -1) return false;
    workers[index] = { ...workers[index], ...updates };
    return writeToStorage(STORAGE_KEYS.WORKERS, workers);
  },

  deleteWorker(id: string): boolean {
    const workers = this.getWorkers();
    const filtered = workers.filter((w) => w.id !== id);
    return writeToStorage(STORAGE_KEYS.WORKERS, filtered);
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
    return writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, records);
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
    return writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, records);
  },

  deleteStaffAttendance(id: string): boolean {
    const records = this.getStaffAttendance();
    const filtered = records.filter((r) => r.id !== id);
    return writeToStorage(STORAGE_KEYS.STAFF_ATTENDANCE, filtered);
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
    return writeToStorage(STORAGE_KEYS.STAFF_LOSSES, records);
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
    return newRecord;
  },

  updateStaffLoss(id: string, updates: Partial<StaffLossRecord>): boolean {
    const records = this.getStaffLosses();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    return writeToStorage(STORAGE_KEYS.STAFF_LOSSES, records);
  },

  deleteStaffLoss(id: string): boolean {
    const records = this.getStaffLosses();
    const filtered = records.filter((r) => r.id !== id);
    return writeToStorage(STORAGE_KEYS.STAFF_LOSSES, filtered);
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
    return writeToStorage(STORAGE_KEYS.STAFF_SALES, records);
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
    return newRecord;
  },

  updateStaffSale(id: string, updates: Partial<StaffSaleRecord>): boolean {
    const records = this.getStaffSales();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    records[index] = { ...records[index], ...updates };
    return writeToStorage(STORAGE_KEYS.STAFF_SALES, records);
  },

  deleteStaffSale(id: string): boolean {
    const records = this.getStaffSales();
    const filtered = records.filter((r) => r.id !== id);
    return writeToStorage(STORAGE_KEYS.STAFF_SALES, filtered);
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
    return writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, records);
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
    return writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, records);
  },

  deleteStaffIncident(id: string): boolean {
    const records = this.getStaffIncidents();
    const filtered = records.filter((r) => r.id !== id);
    return writeToStorage(STORAGE_KEYS.STAFF_INCIDENTS, filtered);
  },

  // ==================== QR CODE HOSTED PAGES (DIGITAL MENUS & BUSINESS SHOWCASES) ====================

  getHostedQRPages(): QRCodeHostedPage[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QR_HOSTED_PAGES);
      const profile = this.getProfile();
      if (!data) {
        // Initialize clean default page without mock or sample data
        const initial: QRCodeHostedPage = {
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
        };
        try {
          writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, [initial]);
        } catch {}
        return [initial];
      }

      const parsed = JSON.parse(data) as QRCodeHostedPage[];
      // Filter out legacy sample data without affecting user-created custom items and photos
      const cleaned = parsed.map((page) => {
        const cleanItems = (page.menuItems || []).filter(
          (item) =>
            !item.id.startsWith('sample-item-') &&
            !item.name.includes('Signature Full Breakfast') &&
            !item.name.includes('Fresh Avocado Toast') &&
            !item.name.includes('Char-Grilled Beef') &&
            !item.name.includes('Crispy Pan-Fried Lake') &&
            !item.name.includes('Craft Passion & Mint')
        );
        const cleanPhotos = (page.photos || [])
          .filter((photo) => !photo.id.startsWith('sample-photo-') && !photo.url.includes('unsplash.com'))
          .map((photo) => ({
            ...photo,
            category: photo.category === 'Ambiance' ? '' : (photo.category || ''),
            title: photo.title === 'Business Photo' ? '' : (photo.title || ''),
          }));
        return {
          ...page,
          menuItems: cleanItems,
          photos: cleanPhotos,
          title: page.title === 'The Pearl Bistro & Hotel Lounge' ? (profile.name || '') : page.title,
          tagline: page.tagline === 'Fine Dining, Artisan Coffee & Comfort • Open 7 Days' ? (profile.description || '') : page.tagline,
          description:
            page.description ===
            'Welcome! Explore our chef-curated food menu, beverage selection, and business gallery. You can place an order via WhatsApp or call our team directly.'
              ? ''
              : page.description,
          announcement:
            page.announcement === '✨ Welcome Offer: Ask your server about our daily chef specials & complimentary treats!'
              ? ''
              : page.announcement,
          wifiName: page.wifiName === 'Guest_HighSpeed_WiFi' ? '' : page.wifiName,
          wifiPassword: page.wifiPassword === 'WelcomeGuest2026' ? '' : page.wifiPassword,
          phone: page.phone === '+256 700 123 456' ? (profile.phone || '') : page.phone,
          whatsapp: page.whatsapp === '+256 700 123 456' ? (profile.whatsapp || '') : page.whatsapp,
          email: page.email === 'info@quickmart.ug' ? (profile.email || '') : page.email,
          address: page.address === 'Plot 22 Kampala Road, Kampala, Uganda' ? (profile.address || '') : page.address,
        };
      });

      return cleaned;
    } catch {
      return [];
    }
  },

  getHostedQRPage(id: string): QRCodeHostedPage | undefined {
    const pages = this.getHostedQRPages();
    return pages.find((p) => p.id === id);
  },

  saveHostedQRPages(pages: QRCodeHostedPage[]): boolean {
    return writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, pages);
  },

  saveHostedQRPage(page: QRCodeHostedPage): boolean {
    const pages = this.getHostedQRPages();
    const index = pages.findIndex((p) => p.id === page.id);
    if (index >= 0) {
      pages[index] = { ...page, updatedAt: new Date().toISOString() };
    } else {
      pages.unshift({ ...page, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    return writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, pages);
  },

  deleteHostedQRPage(id: string): boolean {
    const pages = this.getHostedQRPages();
    const filtered = pages.filter((p) => p.id !== id);
    return writeToStorage(STORAGE_KEYS.QR_HOSTED_PAGES, filtered);
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
    // Check if explicitly locked by the user (e.g. tapping "Lock App Immediately")
    const lockedState = readFromStorage<boolean | null>(STORAGE_KEYS.APP_LOCKED_STATE, null);
    if (lockedState === true) {
      return true;
    }
    // If auto-lock on app open/reload is turned off, do not lock on open/reload
    if (config.autoLockOnExit === false) {
      return false;
    }
    // If the user already unlocked during this active browser session, keep unlocked
    if (typeof sessionStorage !== 'undefined') {
      const sessionUnlocked = sessionStorage.getItem('brivu_session_unlocked');
      if (sessionUnlocked === 'true') {
        return false;
      }
    }
    // When autoLockOnExit is enabled and app is opened in a new session, require passcode
    return true;
  },

  setAppLocked(locked: boolean): boolean {
    if (typeof sessionStorage !== 'undefined') {
      if (locked) {
        sessionStorage.removeItem('brivu_session_unlocked');
      } else {
        sessionStorage.setItem('brivu_session_unlocked', 'true');
      }
    }
    return writeToStorage(STORAGE_KEYS.APP_LOCKED_STATE, locked);
  },
};
