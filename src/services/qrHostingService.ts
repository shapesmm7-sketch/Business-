import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { QRCodeHostedPage, QRMenuItem, QRBusinessPhoto } from '../types';
import { saveJsPdf, SaveFileResult } from './fileSaver';

export class QRHostingService {
  /**
   * Generates a clean URL for customer scanning with optional specific tab targeting
   */
  static getCustomerPageUrl(pageId: string, targetTab?: string): string {
    if (typeof window === 'undefined') {
      const tabParam = targetTab && targetTab !== 'all' ? `&tab=${encodeURIComponent(targetTab)}` : '';
      return `https://brivu.app/?qr=${pageId}${tabParam}`;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    // Strip trailing slash if present for clean query
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const tabParam = targetTab && targetTab !== 'all' ? `&tab=${encodeURIComponent(targetTab)}` : '';
    return `${cleanBase}?qr=${encodeURIComponent(pageId)}${tabParam}`;
  }

  /**
   * Generates direct URL for a specific Item
   */
  static getCustomerItemUrl(pageId: string, itemId: string): string {
    if (typeof window === 'undefined') {
      return `https://brivu.app/?qr=${pageId}&tab=menu&itemId=${encodeURIComponent(itemId)}`;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${cleanBase}?qr=${encodeURIComponent(pageId)}&tab=menu&itemId=${encodeURIComponent(itemId)}`;
  }

  /**
   * Generates direct URL for a specific Photo
   */
  static getCustomerPhotoUrl(pageId: string, photoId: string): string {
    if (typeof window === 'undefined') {
      return `https://brivu.app/?qr=${pageId}&tab=photos&photoId=${encodeURIComponent(photoId)}`;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${cleanBase}?qr=${encodeURIComponent(pageId)}&tab=photos&photoId=${encodeURIComponent(photoId)}`;
  }

  /**
   * Helper to copy general customer page URL to clipboard
   */
  static async copyCustomerUrl(pageId: string, targetTab?: string): Promise<boolean> {
    try {
      const url = this.getCustomerPageUrl(pageId, targetTab);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generates high-res QR Code Data URL (PNG) with support for custom 3 corner finder eye colors
   */
  static async generateQrCodeDataUrl(
    url: string,
    options?: {
      color?: { dark?: string; light?: string; eyeColor?: string };
      width?: number;
      margin?: number;
    }
  ): Promise<string> {
    try {
      const darkColor = options?.color?.dark || '#000000';
      const lightColor = options?.color?.light || '#ffffff';
      const eyeColor = options?.color?.eyeColor || darkColor;
      const targetWidth = options?.width || 512;
      const margin = options?.margin ?? 2;

      // In browser runtime, render onto canvas to support independent corner finder box colors
      if (typeof document !== 'undefined') {
        const qr = QRCode.create(url, {
          errorCorrectionLevel: 'H',
        });
        const moduleCount = qr.modules.size;
        const totalModules = moduleCount + margin * 2;
        const cellSize = targetWidth / totalModules;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetWidth;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Fill background
          ctx.fillStyle = lightColor;
          ctx.fillRect(0, 0, targetWidth, targetWidth);

          // Draw modules
          for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
              if (qr.modules.get(r, c)) {
                // Check if this module is in the 3 standard corner finder patterns (7x7 squares)
                // 1. Top-Left: row 0..6, col 0..6
                // 2. Top-Right: row 0..6, col (moduleCount-7)..moduleCount-1
                // 3. Bottom-Left: row (moduleCount-7)..moduleCount-1, col 0..6
                const isTopLeftEye = r < 7 && c < 7;
                const isTopRightEye = r < 7 && c >= moduleCount - 7;
                const isBottomLeftEye = r >= moduleCount - 7 && c < 7;
                const isEye = isTopLeftEye || isTopRightEye || isBottomLeftEye;

                ctx.fillStyle = isEye ? eyeColor : darkColor;
                ctx.fillRect(
                  (c + margin) * cellSize,
                  (r + margin) * cellSize,
                  cellSize + 0.15,
                  cellSize + 0.15
                );
              }
            }
          }

          return canvas.toDataURL('image/png');
        }
      }

      return await QRCode.toDataURL(url, {
        width: targetWidth,
        margin: margin,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel: 'H',
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      throw err;
    }
  }

  /**
   * Generates and downloads a printable Table Tent Stand / Wall Poster PDF (A4)
   */
  static async downloadPrintableTableStand(
    page: QRCodeHostedPage,
    options?: {
      tableNumber?: string;
      targetTab?: 'all' | 'menu' | 'about' | 'photos' | string;
      tabLabel?: string;
    }
  ): Promise<SaveFileResult> {
    const tableNumber = typeof options === 'string' ? options : options?.tableNumber;
    const targetTab = typeof options === 'object' ? options?.targetTab : undefined;
    const tabLabel = typeof options === 'object' ? options?.tabLabel : undefined;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background styling
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Outer decorative border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1.5);
    doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 6, 6, 'S');

    // Inner card
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(18, 18, pageWidth - 36, pageHeight - 36, 4, 4, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.roundedRect(18, 18, pageWidth - 36, pageHeight - 36, 4, 4, 'S');

    // Header banner bar (Accent color)
    const accent = page.accentColor || '#059669';
    // Convert hex to rgb
    const r = parseInt(accent.slice(1, 3), 16) || 5;
    const g = parseInt(accent.slice(3, 5), 16) || 150;
    const b = parseInt(accent.slice(5, 7), 16) || 105;

    doc.setFillColor(r, g, b);
    doc.roundedRect(24, 24, pageWidth - 48, 28, 3, 3, 'F');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    const titleText = (page.title || 'Welcome to our Venue').toUpperCase();
    doc.text(titleText, pageWidth / 2, 38, { align: 'center', maxWidth: pageWidth - 60 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(240, 253, 244);
    
    let subText = page.tagline || 'Scan to view our digital items, special offers & business information';
    if (targetTab === 'menu') {
      subText = 'Scan to explore our complete items & digital catalog instantly';
    } else if (targetTab === 'about') {
      subText = 'Scan to view our business location, contact details & operating hours';
    } else if (targetTab === 'photos') {
      subText = 'Scan to view our photo gallery and showcase';
    }
    doc.text(subText, pageWidth / 2, 46, { align: 'center', maxWidth: pageWidth - 60 });

    // Section Pill if specific page
    let currentY = 60;
    if (tabLabel && targetTab && targetTab !== 'all') {
      doc.setFillColor(r, g, b);
      doc.roundedRect(pageWidth / 2 - 35, currentY, 70, 7.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(tabLabel.toUpperCase(), pageWidth / 2, currentY + 5.2, { align: 'center' });
      currentY += 13;
    }

    // Table badge if provided
    if (tableNumber) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(pageWidth / 2 - 25, currentY, 50, 9, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(pageWidth / 2 - 25, currentY, 50, 9, 2, 2, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`TABLE #${tableNumber}`, pageWidth / 2, currentY + 6.2, { align: 'center' });
      currentY += 15;
    } else {
      currentY += 4;
    }

    // "Scan to View" Callout
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    const scanCallout = targetTab === 'menu' 
      ? 'SCAN TO VIEW MENU & ITEMS'
      : targetTab === 'about'
      ? 'SCAN FOR BUSINESS INFO & CONTACTS'
      : targetTab === 'photos'
      ? 'SCAN TO VIEW PHOTO SHOWCASE'
      : 'SCAN WITH YOUR PHONE CAMERA';
    doc.text(scanCallout, pageWidth / 2, currentY, { align: 'center' });

    currentY += 9;

    // QR Code generation for specific target URL with custom colors
    const customerUrl = this.getCustomerPageUrl(page.id, targetTab);
    const darkColor = page.qrDarkColor || '#000000';
    const lightColor = page.qrLightColor || '#ffffff';
    const eyeColor = page.qrEyeColor || darkColor;
    const qrDataUrl = await this.generateQrCodeDataUrl(customerUrl, {
      width: 600,
      margin: 1,
      color: { dark: darkColor, light: lightColor, eyeColor },
    });

    // QR Code Frame
    const qrSize = 80;
    const qrX = (pageWidth - qrSize) / 2;

    // Box background and border color resolution
    const boxBg = page.qrBoxBgColor && page.qrBoxBgColor.startsWith('#') ? page.qrBoxBgColor : '#ffffff';
    const boxBorder = page.qrBoxBorderColor && page.qrBoxBorderColor.startsWith('#') ? page.qrBoxBorderColor : '#e2e8f0';

    const parseHex = (hex: string) => {
      const clean = hex.replace('#', '');
      if (clean.length === 3) {
        return [
          parseInt(clean[0] + clean[0], 16),
          parseInt(clean[1] + clean[1], 16),
          parseInt(clean[2] + clean[2], 16),
        ];
      }
      return [
        parseInt(clean.slice(0, 2), 16) || 255,
        parseInt(clean.slice(2, 4), 16) || 255,
        parseInt(clean.slice(4, 6), 16) || 255,
      ];
    };

    const [bgR, bgG, bgB] = parseHex(boxBg);
    const [brR, brG, brB] = parseHex(boxBorder);

    doc.setFillColor(bgR, bgG, bgB);
    doc.setDrawColor(brR, brG, brB);
    doc.setLineWidth(1.2);
    doc.roundedRect(qrX - 5, currentY - 5, qrSize + 10, qrSize + 10, 4, 4, 'FD');
    doc.addImage(qrDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);

    currentY += qrSize + 12;

    // Instruction pill
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth / 2 - 45, currentY, 90, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('POINT CAMERA AT CODE TO OPEN LINK', pageWidth / 2, currentY + 5.5, { align: 'center' });

    currentY += 15;

    // WiFi info box if available
    if (page.wifiName || page.wifiPassword) {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(30, currentY, pageWidth - 60, 17, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(22, 101, 52);
      doc.text('FREE GUEST WI-FI AVAILABLE', pageWidth / 2, currentY + 5.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const wifiText = `Network: ${page.wifiName || 'Guest WiFi'}   |   Password: ${page.wifiPassword || 'None'}`;
      doc.text(wifiText, pageWidth / 2, currentY + 12, { align: 'center' });

      currentY += 23;
    } else {
      currentY += 6;
    }

    // Contact and Ordering Info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);

    const contactLineParts = [];
    if (page.phone) contactLineParts.push(`Tel: ${page.phone}`);
    if (page.whatsapp) contactLineParts.push(`WhatsApp: ${page.whatsapp}`);
    if (page.openingHours) contactLineParts.push(`Hours: ${page.openingHours}`);

    if (contactLineParts.length > 0) {
      doc.text(contactLineParts.join('   •   '), pageWidth / 2, currentY, {
        align: 'center',
        maxWidth: pageWidth - 60,
      });
      currentY += 5.5;
    }

    if (page.address) {
      doc.text(page.address, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 60 });
    }

    // Footer branding
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Powered by Brivu QR Hosting', pageWidth / 2, pageHeight - 22, { align: 'center' });

    const tabSuffix = targetTab && targetTab !== 'all' ? `_${targetTab}` : '';
    const safeTitle = (page.title || 'Table_Stand').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFilename = `${safeTitle}${tabSuffix}_QR_Table_Stand.pdf`;
    return await saveJsPdf(doc, pdfFilename, 'QR Table Stand');
  }

  /**
   * Helper to copy Item URL to clipboard
   */
  static async copyItemUrl(pageId: string, itemId: string): Promise<boolean> {
    try {
      const url = this.getCustomerItemUrl(pageId, itemId);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Helper to copy Photo URL to clipboard
   */
  static async copyPhotoUrl(pageId: string, photoId: string): Promise<boolean> {
    try {
      const url = this.getCustomerPhotoUrl(pageId, photoId);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generates and downloads a printable Item Table Card / Promo Poster PDF (A4)
   */
  static async downloadPrintableItemStand(
    page: QRCodeHostedPage,
    item: QRMenuItem,
    tableNumber?: string
  ): Promise<SaveFileResult> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Theme color parsing
    const hex = page.accentColor || '#059669';
    let r = 5, g = 150, b = 105;
    if (hex.startsWith('#') && hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }

    // Outer Decorative Border
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(1.2);
    doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 6, 6, 'D');

    // Header Background Banner
    doc.setFillColor(r, g, b);
    doc.roundedRect(15, 15, pageWidth - 30, 36, 4, 4, 'F');

    // Business Title & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(page.title || 'Special Featured Item', pageWidth / 2, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(240, 253, 244);
    doc.text('Scan below to view item details, pricing & place your order', pageWidth / 2, 38, { align: 'center' });

    let currentY = 58;

    // Item Category Pill
    if (item.category) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(pageWidth / 2 - 25, currentY, 50, 7.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(item.category.toUpperCase(), pageWidth / 2, currentY + 5.2, { align: 'center' });
      currentY += 13;
    }

    // Item Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(item.name, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 50 });
    currentY += 8;

    // Price / Promo Tag
    const currency = page.currency || '$';
    const hasActivePromo = item.hasPromo && item.promoPrice && item.promoPrice < item.price;
    
    if (hasActivePromo) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`${currency}${item.promoPrice?.toFixed(2)}`, pageWidth / 2 - 12, currentY, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(148, 163, 184);
      doc.text(`${currency}${item.price.toFixed(2)}`, pageWidth / 2 + 16, currentY, { align: 'center' });

      const promoBadge = item.promoDescription || 'PROMO';
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(pageWidth / 2 + 28, currentY - 5, 26, 6.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(185, 28, 28);
      doc.text(promoBadge.slice(0, 10).toUpperCase(), pageWidth / 2 + 41, currentY - 0.7, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(5, 150, 105);
      doc.text(`${currency}${item.price.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
    }
    currentY += 8;

    // Description
    if (item.description) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(item.description, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 60 });
      currentY += 10;
    }

    // Table badge if provided
    if (tableNumber) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(pageWidth / 2 - 25, currentY, 50, 8.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`TABLE #${tableNumber}`, pageWidth / 2, currentY + 5.8, { align: 'center' });
      currentY += 13;
    } else {
      currentY += 4;
    }

    // QR Code generation for this item
    const itemUrl = this.getCustomerItemUrl(page.id, item.id);
    const qrDataUrl = await this.generateQrCodeDataUrl(itemUrl, {
      width: 600,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    const qrSize = 75;
    const qrX = (pageWidth - qrSize) / 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(qrX - 4, currentY - 4, qrSize + 8, qrSize + 8, 4, 4, 'FD');
    doc.addImage(qrDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);

    currentY += qrSize + 10;

    // Scan Callout Box
    doc.setFillColor(r, g, b);
    doc.roundedRect(pageWidth / 2 - 45, currentY, 90, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('SCAN TO ORDER / VIEW ITEM', pageWidth / 2, currentY + 5.5, { align: 'center' });

    currentY += 14;

    // Wi-Fi or Contact note
    if (page.wifiName || page.phone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const note = page.wifiName ? `Free Wi-Fi: ${page.wifiName} | Pass: ${page.wifiPassword || 'None'}` : `Call: ${page.phone}`;
      doc.text(note, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 60 });
    }

    // Footer branding
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Powered by Brivu QR Hosting', pageWidth / 2, pageHeight - 20, { align: 'center' });

    const safeItemName = item.name.replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFilename = `${safeItemName}_Item_QR_Stand.pdf`;
    return await saveJsPdf(doc, pdfFilename, `${item.name} QR Stand`);
  }

  /**
   * Generates and downloads a printable Photo Spotlight Stand PDF (A4)
   */
  static async downloadPrintablePhotoStand(
    page: QRCodeHostedPage,
    photo: QRBusinessPhoto,
    tableNumber?: string
  ): Promise<SaveFileResult> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Theme color parsing
    const hex = page.accentColor || '#059669';
    let r = 5, g = 150, b = 105;
    if (hex.startsWith('#') && hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }

    // Outer Decorative Border
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(1.2);
    doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 6, 6, 'D');

    // Header Background Banner
    doc.setFillColor(r, g, b);
    doc.roundedRect(15, 15, pageWidth - 30, 36, 4, 4, 'F');

    // Business Title & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(page.title || 'Photo Spotlight', pageWidth / 2, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(240, 253, 244);
    doc.text('Scan below to explore our photo gallery and showcase', pageWidth / 2, 38, { align: 'center' });

    let currentY = 60;

    // Photo Caption / Category
    if (photo.category) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(pageWidth / 2 - 25, currentY, 50, 7.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(photo.category.toUpperCase(), pageWidth / 2, currentY + 5.2, { align: 'center' });
      currentY += 12;
    }

    const photoHeadline = photo.title || photo.description;
    if (photoHeadline) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(photoHeadline, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 50 });
      currentY += 8;
    }

    // Table badge if provided
    if (tableNumber) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(pageWidth / 2 - 25, currentY, 50, 8.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`TABLE #${tableNumber}`, pageWidth / 2, currentY + 5.8, { align: 'center' });
      currentY += 13;
    } else {
      currentY += 4;
    }

    // QR Code generation for this photo
    const photoUrl = this.getCustomerPhotoUrl(page.id, photo.id);
    const qrDataUrl = await this.generateQrCodeDataUrl(photoUrl, {
      width: 600,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    const qrSize = 75;
    const qrX = (pageWidth - qrSize) / 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(qrX - 4, currentY - 4, qrSize + 8, qrSize + 8, 4, 4, 'FD');
    doc.addImage(qrDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);

    currentY += qrSize + 10;

    // Scan Callout Box
    doc.setFillColor(r, g, b);
    doc.roundedRect(pageWidth / 2 - 45, currentY, 90, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('SCAN TO OPEN PHOTO GALLERY', pageWidth / 2, currentY + 5.5, { align: 'center' });

    // Footer branding
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Powered by Brivu QR Hosting', pageWidth / 2, pageHeight - 20, { align: 'center' });

    const safePhotoName = (photo.title || photo.description || 'Photo').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFilename = `${safePhotoName}_Photo_QR_Stand.pdf`;
    return await saveJsPdf(doc, pdfFilename, 'Photo QR Stand');
  }
}
