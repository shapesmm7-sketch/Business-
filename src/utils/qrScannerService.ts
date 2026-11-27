import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import jsQR from 'jsqr';
import { StorageService } from '../services/storage';
import { QRHostingService } from '../services/qrHostingService';
import { CloudflareService } from '../services/cloudflareService';
import { Receipt, InventoryProduct, QRCodeHostedPage } from '../types';

export type ScannedQrType = 'receipt' | 'customer_page' | 'inventory_item' | 'wifi' | 'contact' | 'url' | 'text';

export interface ScannedWifiData {
  ssid: string;
  password?: string;
  security: string;
}

export interface ScannedContactData {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  website?: string;
}

export interface ScannedQrResult {
  type: ScannedQrType;
  rawText: string;
  title: string;
  subtitle?: string;
  receipt?: Receipt;
  product?: InventoryProduct;
  customerPage?: QRCodeHostedPage;
  wifiData?: ScannedWifiData;
  contactData?: ScannedContactData;
  targetTab?: 'menu' | 'photos' | 'about';
  targetItemId?: string;
  targetPhotoId?: string;
  url?: string;
}

/**
 * Decodes a base64 or DataURL image using jsQR
 */
export async function decodeQrFromBase64(base64OrDataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data) {
            resolve(code.data);
          } else {
            // Also try a scaled-down / enhanced pass if high-res image has micro-details
            if (canvas.width > 1200 || canvas.height > 1200) {
              const scaledCanvas = document.createElement('canvas');
              const scale = 800 / Math.max(canvas.width, canvas.height);
              scaledCanvas.width = Math.round(canvas.width * scale);
              scaledCanvas.height = Math.round(canvas.height * scale);
              const scaledCtx = scaledCanvas.getContext('2d');
              if (scaledCtx) {
                scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
                const scaledData = scaledCtx.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
                const scaledCode = jsQR(scaledData.data, scaledData.width, scaledData.height, {
                  inversionAttempts: 'attemptBoth',
                });
                if (scaledCode && scaledCode.data) {
                  resolve(scaledCode.data);
                  return;
                }
              }
            }
            resolve(null);
          }
        } catch (err) {
          console.warn('[QR Service] Canvas decode error:', err);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      
      const src = base64OrDataUrl.startsWith('data:')
        ? base64OrDataUrl
        : `data:image/jpeg;base64,${base64OrDataUrl}`;
      img.src = src;
    } catch (err) {
      console.warn('[QR Service] decodeQrFromBase64 error:', err);
      resolve(null);
    }
  });
}

/**
 * Capture photo with @capacitor/camera and decode QR code
 */
export async function scanQrWithCapacitorCamera(source: CameraSource = CameraSource.Camera): Promise<{
  text: string | null;
  error?: string;
}> {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source,
      quality: 95,
      allowEditing: false,
    });

    if (!photo || !photo.base64String) {
      return { text: null, error: 'No photo captured' };
    }

    const decoded = await decodeQrFromBase64(photo.base64String);
    if (decoded) {
      return { text: decoded };
    }

    return { text: null, error: 'No valid QR code found in the captured image' };
  } catch (err: any) {
    if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
      return { text: null };
    }
    console.warn('[QR Service] Camera capture error:', err);
    return { text: null, error: err?.message || 'Camera error' };
  }
}

/**
 * Resolves scanned text into a structured ScannedQrResult
 */
export async function parseScannedQrText(rawInput: string): Promise<ScannedQrResult> {
  const text = (rawInput || '').trim();

  // 1. Check for JSON payload (Receipt, Item, or Page)
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.receiptNumber || parsed.total !== undefined || parsed.items) {
        // Find existing receipt in storage or create a reconstructed one
        const receipts = StorageService.getReceipts();
        const existing = receipts.find(
          (r) => r.receiptNumber === parsed.receiptNumber || (parsed.id && r.id === parsed.id)
        );
        return {
          type: 'receipt',
          rawText: text,
          title: `Receipt #${parsed.receiptNumber || existing?.receiptNumber || 'Found'}`,
          subtitle: `Total: ${parsed.total || existing?.total || 0} • ${parsed.items?.length || existing?.items?.length || 0} items`,
          receipt: existing || parsed,
        };
      }
      if (parsed.barcode || parsed.itemId || parsed.sellingPrice !== undefined || parsed.unitPrice !== undefined) {
        const products = StorageService.getInventoryProducts();
        const existing = products.find(
          (p) => p.id === parsed.id || (parsed.barcode && p.barcode === parsed.barcode)
        );
        return {
          type: 'inventory_item',
          rawText: text,
          title: parsed.name || existing?.name || 'Inventory Product',
          subtitle: `Stock: ${existing?.quantity ?? parsed.quantity ?? 0} • Price: ${parsed.sellingPrice ?? parsed.unitPrice ?? existing?.sellingPrice ?? 0}`,
          product: existing || parsed,
        };
      }
    } catch {
      // not JSON
    }
  }

  // 2. Check for Receipt URL or Receipt ID (e.g. /api/receipts/..., REC-..., INV-..., QTN-...)
  const isReceiptUrl = text.includes('/api/receipts/') || text.includes('receiptId=');
  const isReceiptNumber = /^(REC|INV|QTN)-/i.test(text);

  if (isReceiptUrl || isReceiptNumber) {
    let receiptIdOrNum = text;
    if (text.includes('/api/receipts/')) {
      const parts = text.split('/api/receipts/')[1]?.split('?')[0]?.split('#')[0];
      if (parts) receiptIdOrNum = decodeURIComponent(parts);
    } else if (text.includes('receiptId=')) {
      try {
        const val = new URL(text).searchParams.get('receiptId');
        if (val) receiptIdOrNum = val;
      } catch {
        const match = text.match(/receiptId=([^&\s#]+)/i);
        if (match?.[1]) receiptIdOrNum = decodeURIComponent(match[1]);
      }
    }

    const receipts = StorageService.getReceipts();
    const matched = receipts.find(
      (r) =>
        r.id === receiptIdOrNum ||
        r.receiptNumber.toLowerCase() === receiptIdOrNum.toLowerCase() ||
        r.id.toLowerCase().includes(receiptIdOrNum.toLowerCase())
    );

    if (matched) {
      return {
        type: 'receipt',
        rawText: text,
        title: `${matched.documentType === 'quotation' ? 'Quotation' : matched.documentType === 'invoice' ? 'Invoice' : 'Receipt'} #${matched.receiptNumber}`,
        subtitle: `${matched.customerName || 'Customer'} • ${matched.items.length} items • ${matched.businessSnapshot?.currency || matched.currency || 'UGX'} ${matched.total.toLocaleString()}`,
        receipt: matched,
      };
    }

    return {
      type: 'receipt',
      rawText: text,
      title: `Receipt #${receiptIdOrNum}`,
      subtitle: 'Receipt code found. Tap to view details or verify.',
      url: text.startsWith('http') ? text : undefined,
    };
  }

  // 3. Check for Web URL or Link (e.g. https://..., http://...)
  if (/^https?:\/\//i.test(text) || text.includes('http://') || text.includes('https://') || text.includes('.menu/') || text.includes('/qr/')) {
    const cleanUrl = text.startsWith('http') ? text : `https://${text.replace(/^\/+/, '')}`;
    return {
      type: 'url',
      rawText: text,
      title: 'Web Link',
      subtitle: cleanUrl,
      url: cleanUrl,
    };
  }

  // 4. Check for Inventory Item (Barcode, Item ID, or Product Match)
  const products = StorageService.getInventoryProducts();
  const matchedProduct = products.find(
    (p) =>
      (p.barcode && p.barcode.toLowerCase() === text.toLowerCase()) ||
      (p.itemId && p.itemId.toLowerCase() === text.toLowerCase()) ||
      p.id === text ||
      p.name.toLowerCase() === text.toLowerCase()
  );

  if (matchedProduct) {
    return {
      type: 'inventory_item',
      rawText: text,
      title: matchedProduct.name,
      subtitle: `Stock: ${matchedProduct.quantity} units • Price: ${matchedProduct.sellingPrice} • Code: ${matchedProduct.barcode || matchedProduct.itemId || 'N/A'}`,
      product: matchedProduct,
    };
  }

  // 5. Wi-Fi QR Code (WIFI:T:WPA;S:Name;P:Pass;;)
  if (/^WIFI:/i.test(text)) {
    const unescapeWifi = (s: string) => s.replace(/\\([\\;,:"])/g, '$1');
    const body = text.slice(5);
    const parts: string[] = [];
    let current = '';
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '\\' && i + 1 < body.length) {
        current += body[i] + body[i + 1];
        i++;
      } else if (body[i] === ';') {
        parts.push(current);
        current = '';
      } else {
        current += body[i];
      }
    }
    if (current) parts.push(current);

    let ssid = '';
    let password = '';
    let security = 'WPA';
    for (const part of parts) {
      if (part.startsWith('S:')) ssid = unescapeWifi(part.slice(2));
      else if (part.startsWith('P:')) password = unescapeWifi(part.slice(2));
      else if (part.startsWith('T:')) security = part.slice(2) || 'WPA';
    }
    return {
      type: 'wifi',
      rawText: text,
      title: ssid || 'Guest Wi-Fi',
      subtitle: password ? `Password: ${password}` : 'Open Network (No Password)',
      wifiData: {
        ssid: ssid || 'Guest Wi-Fi',
        password,
        security,
      },
    };
  }

  // 6. Contact Card QR Code (BEGIN:VCARD...END:VCARD)
  if (/^BEGIN:VCARD/i.test(text)) {
    const unescapeVCard = (s: string) =>
      s.replace(/\\n/gi, '\n').replace(/\\;/g, ';').replace(/\\,/g, ',');
    const lines = text.split(/\r?\n/);
    let name = '';
    let phone = '';
    let whatsapp = '';
    let email = '';
    let address = '';
    let website = '';

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const key = line.slice(0, colonIdx).toUpperCase();
      const val = unescapeVCard(line.slice(colonIdx + 1).trim());
      if (!val) continue;
      if (key === 'FN' || (key === 'ORG' && !name)) {
        name = val;
      } else if (key.startsWith('TEL')) {
        if (key.includes('MSG') || key.includes('WHATSAPP')) {
          whatsapp = val;
        } else if (!phone) {
          phone = val;
        } else if (!whatsapp) {
          whatsapp = val;
        }
      } else if (key.startsWith('EMAIL') && !email) {
        email = val;
      } else if (key.startsWith('ADR') && !address) {
        address = val.split(';').filter(Boolean).join(', ');
      } else if (key.startsWith('URL') && !website) {
        website = val;
      }
    }

    const summaryParts = [email, phone || whatsapp].filter(Boolean);
    return {
      type: 'contact',
      rawText: text,
      title: name || 'Contact Card',
      subtitle: summaryParts.join(' • ') || 'Contact details',
      contactData: {
        name: name || 'Contact',
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        address: address || undefined,
        website: website || undefined,
      },
    };
  }

  // 7. Standard Web URL
  if (/^https?:\/\//i.test(text)) {
    return {
      type: 'url',
      rawText: text,
      title: 'Web Link',
      subtitle: text,
      url: text,
    };
  }

  // 8. Plain Text / Barcode
  return {
    type: 'text',
    rawText: text,
    title: 'Scanned Text / Code',
    subtitle: text,
  };
}
