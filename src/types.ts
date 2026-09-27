/**
 * Core type definitions for Brivu
 */

export type CurrencyCode =
  | 'UGX'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'KES'
  | 'TZS'
  | 'RWF'
  | 'NGN'
  | 'GHS'
  | 'ZAR'
  | 'INR'
  | 'CAD'
  | 'AUD'
  | 'AED';

export interface CurrencyConfig {
  code: CurrencyCode | string;
  name: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  decimalPlaces: number;
  flag?: string;
}

export type PaymentMethod =
  | 'Cash'
  | 'Mobile Money'
  | 'Bank'
  | 'Card'
  | 'Check'
  | 'Other';

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export type ReceiptTemplateId =
  | 'modern'
  | 'classic'
  | 'minimal'
  | 'business'
  | 'compact'
  | 'executive-navy'
  | 'emerald-mint'
  | 'crimson-bold'
  | 'indigo-tech'
  | 'charcoal-amber'
  | 'ocean-breeze'
  | 'monochrome-pro'
  | 'burgundy-prestige'
  | 'slate-borderless'
  | 'retro-kraft';

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type TemplateFontFamily = 'helvetica' | 'times' | 'courier' | 'playfair' | 'geist';

export interface TemplateCustomization {
  headerBgColor?: string;
  headerTextColor?: string;
  headerNameColor?: string;
  headerDescColor?: string;
  headerAddressColor?: string;
  receiptTextColor?: string;
  accentColor?: string;
  totalBgColor?: string;
  totalTextColor?: string;
  paperBgColor?: string;
  fontFamily?: TemplateFontFamily;
  badgeText?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  tableBorderColor?: string;
}

export type CustomTemplateMap = Record<string, TemplateCustomization>;

export interface BusinessProfile {
  name: string;
  description?: string; // e.g., "Dealers in all types of men & women clothes, shoes & accessories"
  logo?: string; // base64 / data URL
  signature?: string; // base64 / data URL
  phone: string;
  whatsapp?: string;
  email?: string;
  address: string;
  taxNumber?: string;
  website?: string;
  currency: string;
  language?: string;
  customFooter?: string;
  accentColor?: string; // Custom primary brand HEX/gradient color for PDFs and receipts
  headerBgColor?: string; // Custom header banner background fill
  headerTextColor?: string; // Custom header text color
  totalBgColor?: string; // Custom total section background fill
  totalTextColor?: string; // Custom total section text color
  paperBgColor?: string; // Custom receipt paper canvas background fill
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankBranchSwift?: string;
  mobileMoneyMerchant?: string;
  mobileMoneyName?: string;
  defaultPaymentInstructions?: string;
}

export type DocumentType = 'receipt' | 'invoice';

export interface Receipt {
  id: string;
  documentType?: DocumentType; // 'receipt' | 'invoice' (default: 'receipt')
  receiptNumber: string; // or invoice number e.g. INV-000001
  createdAt: string; // ISO string
  dueDate?: string; // ISO string or YYYY-MM-DD (for invoices)
  poNumber?: string; // Purchase Order / Ref No
  paymentTerms?: string; // e.g. 'Due on Receipt', 'Net 14', 'Net 30'
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerTaxNumber?: string; // Client TIN / VAT
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  discountType: 'fixed' | 'percentage';
  discountAmount: number;
  taxRate?: number; // VAT or Sales Tax rate % (e.g. 18)
  taxAmount?: number; // Calculated tax amount
  shippingFee?: number; // Delivery / Extra charge
  total: number;
  amountPaid: number;
  balance: number; // positive = change to return, negative = balance due, 0 = paid exactly
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountInWords?: string;
  bankDetails?: string; // Payment instructions / bank details on invoice
  notes?: string;
  nonReturnable?: boolean;
  nonRefundable?: boolean;
  template: ReceiptTemplateId;
  accentColor?: string; // Optional receipt-specific override accent color
  customTheme?: TemplateCustomization; // Optional full template customization override
  businessSnapshot: BusinessProfile;
}

export interface AppSettings {
  currency: string;
  receiptPrefix: string;
  nextReceiptNumber: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  numberPadding: number;
  defaultPaymentMethod: PaymentMethod;
  defaultTemplate: ReceiptTemplateId;
  defaultDueDateDays?: number;
  defaultPaymentTerms?: string;
  defaultTaxRate?: number;
  defaultAccentColor?: string;
  templateCustomizations?: CustomTemplateMap; // Store customizations per template ID
  customFooter: string;
  darkMode: boolean;
  hapticsEnabled: boolean;
}

export interface InventoryProduct {
  id: string;
  itemId: string;
  name: string;
  image?: string;
  sizes?: string[];
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  taxPercent: number;
  categoryId?: string; // product category referencing ProductCategory
  createdAt: string;
  updatedAt: string;
}

export interface InventorySale {
  id: string;
  productId?: string;
  itemId?: string;
  productName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalPrice: number;
  profit: number;
  customerName?: string;
  categoryId?: string; // product category referencing ProductCategory
  date: string; // YYYY-MM-DD
  createdAt: string;
  remainingStock?: number; // Stock balance remaining right after this sale
}

export interface InventoryExpense {
  id: string;
  title: string;
  category?: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface DebtPayment {
  amount: number;
  date: string; // ISO string with date and time
}

export interface InventoryDebt {
  id: string;
  customerName: string; // name of the debtor / person demanded
  productTaken: string; // product/item taken
  phone: string;        // debtor's phone number
  amount: number;       // total amount demanded/owed
  description?: string; // description / additional notes
  categoryId?: string;  // product category referencing ProductCategory
  date: string;         // date recorded (YYYY-MM-DD)
  dueDate?: string;     // optional repayment due date
  status: 'unpaid' | 'paid' | 'partial';
  paidAmount?: number;  // amount paid so far
  payments?: DebtPayment[]; // History of payments made
  createdAt: string;
  settledAt?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  color?: string; // Optional hex
  createdAt: string;
}

export interface ShoppingCategory {
  id: string;
  name: string;
  color?: string; // Optional hex or tailwind class
  createdAt: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string; // e.g., "5", "5kg", "2 boxes"
  estimatedPrice?: number;
  checked: boolean;
  notes?: string;
  categoryId?: string; // category referencing ShoppingCategory
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  location?: string;
  contact: string;
  email?: string;
  profilePic?: string;
  notes?: string;
  createdAt: string;
}

export interface BusinessAgent {
  id: string;
  agentName: string;
  shopName?: string;
  address?: string;
  contact: string;
  email?: string;
  profilePic?: string;
  notes?: string;
  createdAt: string;
}

export interface AgentLedgerRecord {
  id: string;
  agentId: string;
  date: string; // YYYY-MM-DD
  itemsTaken: string; // Name or description of items taken
  quantity?: number;
  unitPrice?: number;
  totalAmount: number; // Total price / value of items taken
  cashPaid: number; // Cash paid by agent
  remainingBalance: number; // totalAmount - cashPaid
  notes?: string;
  createdAt: string;
}

export interface BusinessWorker {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nin?: string; // National ID / NIN Number
  homeAddress?: string;
  profilePic?: string;
  startDate?: string; // YYYY-MM-DD
  salary: number;
  salaryPeriod?: 'monthly' | 'weekly' | 'daily';
  workDays?: string; // e.g. "Mon - Sat"
  workHours?: string; // e.g. "8:00 AM - 5:00 PM"
  role?: string; // e.g. "Cashier", "Store Keeper", "Sales Assistant"
  notes?: string;
  createdAt: string;
}

export type StaffAttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'left_early';

export interface StaffAttendanceRecord {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional end date for multi-day leave ranges)
  status: StaffAttendanceStatus;
  checkInTime?: string; // e.g. "08:15 AM"
  checkOutTime?: string; // e.g. "05:00 PM"
  notes?: string;
  createdAt: string;
}

export type StaffLossStatus = 'pending' | 'deducted' | 'waived' | 'repaid' | 'none';

export interface StaffLossRecord {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  title: string; // Item / description of loss or damage or cash shortage
  amount: number;
  status: StaffLossStatus;
  notes?: string;
  createdAt: string;
}

export interface StaffSaleRecord {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  itemSold: string; // Product / service description
  amount: number;
  commission?: number; // Optional commission/bonus earned
  customerName?: string;
  notes?: string;
  createdAt: string;
}

export type StaffIncidentType = 'mistake' | 'warning' | 'appreciation' | 'note' | 'none';
export type StaffIncidentSeverity = 'minor' | 'moderate' | 'critical' | 'praise';

export interface StaffIncidentRecord {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  type: StaffIncidentType;
  title: string;
  severity?: StaffIncidentSeverity;
  actionTaken?: string;
  notes?: string;
  createdAt: string;
}

export type InventoryTab = 'add' | 'sales' | 'stock' | 'expense' | 'debts' | 'shoppingList' | 'report' | 'customers' | 'agents' | 'workers';

export interface AppBackupData {
  version: number;
  exportedAt: string;
  profile: BusinessProfile;
  settings: AppSettings;
  receipts: Receipt[];
  inventoryProducts?: InventoryProduct[];
  inventorySales?: InventorySale[];
  inventoryExpenses?: InventoryExpense[];
  inventoryDebts?: InventoryDebt[];
  shoppingListItems?: ShoppingListItem[];
  shoppingCategories?: ShoppingCategory[];
  productCategories?: ProductCategory[];
  customers?: Customer[];
  agents?: BusinessAgent[];
  workers?: BusinessWorker[];
  staffAttendance?: StaffAttendanceRecord[];
  staffLosses?: StaffLossRecord[];
  staffSales?: StaffSaleRecord[];
  staffIncidents?: StaffIncidentRecord[];
  qrHostedPages?: QRCodeHostedPage[];
}

export interface QRMenuItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  promoPrice?: number;
  hasPromo?: boolean;
  promoDescription?: string;
  promoStartDate?: string;
  promoEndDate?: string;
  photoUrl?: string;
  isAvailable?: boolean;
  isSpecial?: boolean;
  tags?: string[];
}

export interface QRBusinessPhoto {
  id: string;
  url: string;
  title?: string;
  description?: string;
  category?: string;
  badge?: string;
}

export interface QRCodeHostedPage {
  id: string;
  title: string;
  tagline?: string;
  description?: string;
  pageType: 'menu' | 'business_showcase' | 'hotel_resort' | 'catalog';
  logo?: string;
  coverImage?: string;
  accentColor?: string;
  theme?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate' | 'luxury-gold';
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  googleMapsUrl?: string;
  wifiName?: string;
  wifiPassword?: string;
  openingHours?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    website?: string;
  };
  photos: QRBusinessPhoto[];
  menuCategories: string[];
  menuItems: QRMenuItem[];
  currency: string;
  announcement?: string;
  allowWhatsAppOrdering?: boolean;
  // QR Code and Box Color Customization
  qrDarkColor?: string;
  qrLightColor?: string;
  qrEyeColor?: string; // Color for the 3 corner square boxes (top-left, top-right, bottom-left)
  qrBoxBgColor?: string;
  qrBoxBorderColor?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActiveScreen =
  | 'home'
  | 'receipts-invoices'
  | 'create-receipt'
  | 'create-invoice'
  | 'receipts'
  | 'invoices'
  | 'inventory'
  | 'preview-receipt'
  | 'profile'
  | 'templates'
  | 'settings'
  | 'qr-hosting'
  | 'qr-customer-view'
  | 'upgrade'
  | 'app-lock-setup'
  | 'cloud-backup';

export type SubscriptionPlanId = '1-month' | '6-months' | '1-year';

export interface UserSubscription {
  planId: SubscriptionPlanId;
  planName: string;
  status: 'active' | 'expired' | 'canceled';
  price: number;
  formattedPrice: string;
  startDate: string;
  expiresAt: string;
  paymentMethod?: string;
}

export interface AppLockConfig {
  isEnabled: boolean;
  pin: string; // Digits password (e.g., 4 or 6 digits)
  secretWord: string; // Secret word or number used for password reset/recovery
  hint?: string; // Optional reminder hint
  autoLockOnExit?: boolean; // Automatically lock on fresh tab/app start
  lastLockedAt?: string;
  updatedAt?: string;
}

export interface CloudflareConfig {
  workerUrl: string; // e.g. https://brivu-worker.subdomain.workers.dev
  apiKey?: string; // Optional secret key / token
  autoSaveFiles: boolean; // Auto-save generated receipts/invoices/reports to R2
  autoSyncData: boolean; // Auto-sync receipts & database info to D1 SQL database
  lastSyncAt?: string;
  lastStatus?: 'connected' | 'error' | 'untested';
  lastErrorMessage?: string;
  filesFolder?: string;
}

export interface CloudflareFileRecord {
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  folder?: string;
  uploadedAt: string;
  url: string;
}

export interface CloudflareSyncResponse {
  success: boolean;
  message: string;
  timestamp?: string;
  receiptsSaved?: number;
  d1Bound?: boolean;
  r2Bound?: boolean;
  error?: string;
}

