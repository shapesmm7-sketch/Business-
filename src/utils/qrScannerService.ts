import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import jsQR from 'jsqr';
import { StorageService } from '../services/storage';
import { QRHostingService } from '../services/qrHostingService';
import { CloudflareService } from '../services/cloudflareService';
import { Receipt, InventoryProduct, QRCodeHostedPage } from '../types';

export type ScannedQrType = 'receipt' | 'customer_page' | 'inventory_item' | 'url' | 'text';

export interface ScannedQrResult {
  type: ScannedQrType;
  rawText: string;
  title: string;
  subtitle?: string;
  receipt?: Receipt;
  product?: InventoryProduct;
  customerPage?: QRCodeHostedPage;
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

  // 2. Check for Receipt URL or Receipt ID (e.g. /api/receipts/..., REC-..., INV-...)
  const isReceiptUrl = text.includes('/api/receipts/') || text.includes('receiptId=');
  const isReceiptNumber = /^(REC|INV)-/i.test(text);

  if (isReceiptUrl || isReceiptNumber) {
    let receiptIdOrNum = text;
    if (text.includes('/api/receipts/')) {
      const parts = text.split('/api/receipts/')[1]?.split('?')[0]?.split('#')[0];
      if (parts) receiptIdOrNum = decodeURIComponent(parts);
    } else if (text.includes('receiptId=')) {
      const val = new URL(text).searchParams.get('receiptId');
      if (val) receiptIdOrNum = val;
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
        title: `${matched.documentType === 'invoice' ? 'Invoice' : 'Receipt'} #${matched.receiptNumber}`,
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

  // 3. Check for Customer Page / Business Hub URL (e.g. /qr/:pageId, ?qr=..., tab=...)
  const isQrCustomerUrl =
    text.includes('/qr/') ||
    text.includes('?qr=') ||
    text.includes('business-hub') ||
    text.includes('socials-hub') ||
    text.includes('websites-hub') ||
    text.includes('events-hub');

  if (isQrCustomerUrl) {
    let pageId = 'default';
    let targetTab: 'menu' | 'photos' | 'about' | undefined;
    let itemId: string | undefined;
    let photoId: string | undefined;

    try {
      const urlObj = new URL(text);
      if (urlObj.pathname.includes('/qr/')) {
        const afterQr = urlObj.pathname.split('/qr/')[1]?.split('/')[0];
        if (afterQr) pageId = decodeURIComponent(afterQr);
      } else if (urlObj.searchParams.get('qr')) {
        pageId = urlObj.searchParams.get('qr') || 'default';
      }

      const tabParam = urlObj.searchParams.get('tab');
      if (tabParam === 'menu' || tabParam === 'photos' || tabParam === 'about') {
        targetTab = tabParam;
      }
      itemId = urlObj.searchParams.get('item') || urlObj.searchParams.get('itemId') || undefined;
      photoId = urlObj.searchParams.get('photo') || urlObj.searchParams.get('photoId') || undefined;
    } catch {
      // not a fully qualified URL
      if (text.includes('/qr/')) {
        pageId = text.split('/qr/')[1]?.split('?')[0]?.split('#')[0] || 'default';
      }
    }

    const pages = StorageService.getHostedQRPages();
    let foundPage = pages.find((p) => p.id === pageId);

    // If it's a hub link
    if (!foundPage && (pageId.includes('social') || text.includes('socials'))) {
      foundPage = QRHostingService.convertSocialsHubToHostedPage(
        StorageService.getSocialsQrItems(),
        StorageService.getProfile()
      );
    } else if (!foundPage && (pageId.includes('website') || text.includes('websites'))) {
      foundPage = QRHostingService.convertWebsitesHubToHostedPage(
        StorageService.getWebsitesQrItems(),
        StorageService.getProfile()
      );
    } else if (!foundPage && (pageId.includes('event') || text.includes('events'))) {
      foundPage = QRHostingService.convertEventsHubToHostedPage(
        StorageService.getEventsQrItems(),
        StorageService.getProfile()
      );
    } else if (!foundPage) {
      foundPage = pages[0];
    }

    return {
      type: 'customer_page',
      rawText: text,
      title: foundPage?.title || 'Customer Showcase Page',
      subtitle: `Target: ${targetTab ? targetTab.toUpperCase() : 'Full Hub'} • ${foundPage?.menuItems?.length || 0} items`,
      customerPage: foundPage,
      targetTab,
      targetItemId: itemId,
      targetPhotoId: photoId,
      url: text.startsWith('http') ? text : undefined,
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

  // 5. Standard Web URL
  if (/^https?:\/\//i.test(text)) {
    return {
      type: 'url',
      rawText: text,
      title: 'Web Link',
      subtitle: text,
      url: text,
    };
  }

  // 6. Plain Text / Barcode
  return {
    type: 'text',
    rawText: text,
    title: 'Scanned Text / Code',
    subtitle: text,
  };
}
