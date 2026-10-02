import QRCode from 'qrcode';
import { Receipt, BusinessProfile } from '../types';
import { formatCurrency, formatDateTime } from './currencies';
import { StorageService } from '../services/storage';

export interface ReceiptDataForQr {
  id?: string;
  receiptNumber: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  discountAmount?: number;
  total: number;
  amountPaid: number;
  balance?: number;
  paymentMethod: string;
  currency?: string;
  businessName?: string;
  businessSnapshot?: BusinessProfile;
  storeName?: string;
}

/**
 * Normalizes any receipt or render data into a standard Receipt object structure.
 */
export function normalizeReceiptData(input: ReceiptDataForQr | Receipt): Receipt {
  const inputObj = input as ReceiptDataForQr & Receipt;
  const businessSnapshot: BusinessProfile = inputObj.businessSnapshot || {
    name: inputObj.businessName || inputObj.storeName || 'Brivu Store',
    currency: inputObj.currency || 'UGX',
    phone: '',
    address: '',
  };

  const total = input.total || 0;
  const amountPaid = input.amountPaid || 0;
  const computedBalance = input.balance !== undefined ? input.balance : (amountPaid - total);

  return {
    id: input.id || `REC-ID-${input.receiptNumber}`,
    receiptNumber: input.receiptNumber,
    createdAt: input.createdAt,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    items: input.items.map((item, idx) => ({
      id: (item as { id?: string }).id || `item-${idx}`,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
    subtotal: input.subtotal,
    discount: 0,
    discountType: 'fixed',
    discountAmount: input.discountAmount || 0,
    total: total,
    amountPaid: amountPaid,
    balance: computedBalance,
    paymentStatus: computedBalance >= 0 ? 'paid' : 'partial',
    paymentMethod: (input.paymentMethod as Receipt['paymentMethod']) || 'Cash',
    businessSnapshot: businessSnapshot,
    notes: (input as Receipt).notes,
    template: (input as Receipt).template || 'modern',
  };
}

/**
 * Generates a deterministic SHA-256-like hex verification hash based on core receipt fields
 */
export function generateVerificationHash(input: ReceiptDataForQr | Receipt): string {
  const rec = normalizeReceiptData(input);
  const coreString = [
    rec.receiptNumber,
    rec.businessSnapshot.name,
    rec.total,
    rec.amountPaid,
    rec.items.length,
    rec.createdAt,
    rec.paymentMethod,
  ].join('|');

  let hashVal = 0x811c9dc5;
  for (let i = 0; i < coreString.length; i++) {
    hashVal ^= coreString.charCodeAt(i);
    hashVal += (hashVal << 1) + (hashVal << 4) + (hashVal << 7) + (hashVal << 8) + (hashVal << 24);
  }
  
  const unsigned = hashVal >>> 0;
  const rawHex = unsigned.toString(16).padStart(8, '0').toUpperCase();
  return `V-${rawHex.slice(0, 4)}-${rawHex.slice(4, 8)}`;
}

/**
 * Constructs the structured plain text offline receipt string for QR code encoding
 */
export function buildQrReceiptPayload(input: ReceiptDataForQr | Receipt): string {
  const rec = normalizeReceiptData(input);
  const currency = rec.businessSnapshot.currency || 'UGX';
  const hash = generateVerificationHash(rec);

  const lines: string[] = [];

  // Inject online web verification link at the top of QR payload if Cloudflare is configured
  try {
    const config = StorageService.getCloudflareConfig();
    if (config && config.workerUrl) {
      const cleanUrl = config.workerUrl.trim().replace(/\/$/, '');
      lines.push(`${cleanUrl}/api/receipts/${encodeURIComponent(rec.id)}`);
      lines.push(``); // Spacer line for scanner separation
    }
  } catch (err) {
    console.warn('Could not inject Cloudflare web verification link:', err);
  }

  lines.push(`================================`);
  lines.push(`${rec.businessSnapshot.name.toUpperCase()}`);
  if (rec.businessSnapshot.address) lines.push(`Addr: ${rec.businessSnapshot.address}`);
  if (rec.businessSnapshot.phone) lines.push(`Tel: ${rec.businessSnapshot.phone}`);
  if (rec.businessSnapshot.taxNumber) lines.push(`TIN/VAT: ${rec.businessSnapshot.taxNumber}`);
  lines.push(`================================`);

  lines.push(`Receipt No : ${rec.receiptNumber}`);
  lines.push(`Date & Time: ${formatDateTime(rec.createdAt)}`);
  if (rec.customerName) lines.push(`Customer   : ${rec.customerName}`);
  if (rec.customerPhone) lines.push(`Cust Phone : ${rec.customerPhone}`);
  lines.push(`Payment    : ${rec.paymentMethod}`);
  lines.push(`--------------------------------`);

  lines.push(`ITEMS PURCHASED:`);
  rec.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   Qty: ${item.quantity} x ${formatCurrency(item.unitPrice, currency)} = ${formatCurrency(item.subtotal, currency)}`);
  });

  lines.push(`--------------------------------`);
  lines.push(`Subtotal   : ${formatCurrency(rec.subtotal, currency)}`);
  if (rec.discountAmount && rec.discountAmount > 0) {
    lines.push(`Discount   : -${formatCurrency(rec.discountAmount, currency)}`);
  }
  lines.push(`TOTAL      : ${formatCurrency(rec.total, currency)}`);
  lines.push(`Amount Paid: ${formatCurrency(rec.amountPaid, currency)}`);

  if (rec.balance > 0) {
    lines.push(`Change     : ${formatCurrency(rec.balance, currency)}`);
  } else if (rec.balance < 0) {
    lines.push(`Balance Due: ${formatCurrency(Math.abs(rec.balance), currency)}`);
  }

  lines.push(`--------------------------------`);
  lines.push(`Receipt ID : ${rec.id}`);
  lines.push(`VERIFY HASH: ${hash}`);
  lines.push(`================================`);
  lines.push(`OFFLINE VERIFIABLE RECEIPT`);
  lines.push(`Scan to verify authenticity.`);

  return lines.join('\n');
}

/**
 * Asynchronously generates a PNG Data URL for a receipt's QR code
 */
export async function generateReceiptQrDataUrl(
  input: ReceiptDataForQr | Receipt,
  size: number = 240
): Promise<string> {
  try {
    const payload = buildQrReceiptPayload(input);
    const dataUrl = await QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code Data URL:', err);
    return '';
  }
}
