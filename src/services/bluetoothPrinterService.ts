import { Capacitor, registerPlugin } from '@capacitor/core';
import { Receipt, ThermalPrinterDevice, BusinessProfile } from '../types';
import { resolveEffectiveBusinessProfile } from './pdfGenerator';
import { StorageService } from './storage';

export interface AndroidBluetoothPrinter {
  name: string;
  address: string;
  bonded: boolean;
  isLikelyPrinter?: boolean;
}

interface BluetoothPrinterPluginInterface {
  isAvailable(): Promise<{
    supported: boolean;
    enabled: boolean;
    hasPermissions: boolean;
  }>;
  scanPrinters(): Promise<{
    success: boolean;
    devices?: AndroidBluetoothPrinter[];
    message?: string;
    permissionDenied?: boolean;
    bluetoothDisabled?: boolean;
    unsupported?: boolean;
  }>;
  connectPrinter(options: { address: string }): Promise<{
    success: boolean;
    name?: string;
    address?: string;
    transport?: string;
    message?: string;
    permissionDenied?: boolean;
    bluetoothDisabled?: boolean;
  }>;
  printBytes(options: { address: string; base64Data: string }): Promise<{
    success: boolean;
    message?: string;
    permissionDenied?: boolean;
    bluetoothDisabled?: boolean;
  }>;
  disconnectPrinter(): Promise<{ success: boolean }>;
  systemPrint(options: { html: string; jobName: string }): Promise<{
    success: boolean;
    opened?: boolean;
    message?: string;
  }>;
}

const BluetoothPrinterNative = registerPlugin<BluetoothPrinterPluginInterface>('BluetoothPrinter');

// Cached active GATT connection device in runtime memory (for Web Bluetooth)
let cachedBluetoothDevice: any = null;

// Common Bluetooth GATT Service UUIDs used by ESC/POS Thermal Printers
const THERMAL_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS / Thermal
  '00001101-0000-1000-8000-00805f9b34fb', // SPP Serial Port
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // MPT-II / Xprinter
  '495353c0-1e4d-4a90-b38d-05b5fe6d9d00', // GOOJPRT / Zjiang
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
];

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class BluetoothPrinterService {
  /**
   * Check whether we are running inside the native Capacitor Android app
   */
  static isAndroidNative(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
      return Boolean((window as any).Capacitor?.isNativePlatform?.());
    }
  }

  /**
   * Check if Native Android Bluetooth or Web Bluetooth API is supported
   */
  static isSupported(): boolean {
    return this.isAndroidNative() || (typeof navigator !== 'undefined' && 'bluetooth' in navigator);
  }

  /**
   * Native Android: Scan paired & nearby Bluetooth Classic SPP / BLE thermal printers
   */
  static async scanAndroidPrinters(): Promise<{
    success: boolean;
    devices: AndroidBluetoothPrinter[];
    message: string;
  }> {
    try {
      const res = await BluetoothPrinterNative.scanPrinters();
      if (res && res.success) {
        const devices = Array.isArray(res.devices) ? res.devices : [];
        return {
          success: true,
          devices,
          message:
            res.message ||
            (devices.length > 0
              ? `Found ${devices.length} Bluetooth device(s). Select your thermal printer.`
              : 'No Bluetooth printers found. Turn on your physical printer or pair it in Android Bluetooth Settings.'),
        };
      }
      return {
        success: false,
        devices: [],
        message:
          res?.message ||
          'Could not access phone Bluetooth. Please turn on Bluetooth and allow Nearby Devices permission.',
      };
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.toLowerCase().includes('not implemented') || msg.toLowerCase().includes('unimplemented')) {
        return {
          success: false,
          devices: [],
          message:
            'Please install the latest Brivu Android app update so live Bluetooth thermal printer discovery is enabled on this phone.',
        };
      }
      return {
        success: false,
        devices: [],
        message: msg || 'Bluetooth scan failed. Please verify Bluetooth is enabled on your phone.',
      };
    }
  }

  /**
   * Native Android: Connect and verify a selected Bluetooth thermal printer by MAC address
   */
  static async connectAndroidPrinter(
    device: AndroidBluetoothPrinter,
    paperWidth: '58mm' | '80mm' = '58mm'
  ): Promise<{
    success: boolean;
    printer?: ThermalPrinterDevice;
    message: string;
  }> {
    try {
      const res = await BluetoothPrinterNative.connectPrinter({ address: device.address });
      if (res && res.success) {
        const printerConfig: ThermalPrinterDevice = {
          id: res.address || device.address,
          name: res.name || device.name || `Bluetooth Printer (${device.address.slice(-5)})`,
          paperWidth,
          autoPrintOnSave: true,
          connectedAt: new Date().toISOString(),
        };
        return {
          success: true,
          printer: printerConfig,
          message: res.message || `Connected & saved printer "${printerConfig.name}" successfully!`,
        };
      }
      return {
        success: false,
        message:
          res?.message ||
          `Could not connect to "${device.name}". Ensure your physical thermal printer is turned on and paired.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err?.message ||
          `Connection failed for "${device.name}". Make sure the printer is powered on and within Bluetooth range.`,
      };
    }
  }

  /**
   * Trigger Bluetooth printer discovery (Android native SPP/BLE or browser Web Bluetooth)
   */
  static async searchForPrinter(paperWidth: '58mm' | '80mm' = '58mm'): Promise<{
    success: boolean;
    printer?: ThermalPrinterDevice;
    devices?: AndroidBluetoothPrinter[];
    message: string;
  }> {
    // 1. Native Android Capacitor path
    if (this.isAndroidNative()) {
      const scanRes = await this.scanAndroidPrinters();
      if (!scanRes.success) {
        return {
          success: false,
          message: scanRes.message,
        };
      }

      if (scanRes.devices.length === 0) {
        return {
          success: false,
          devices: [],
          message:
            'No Bluetooth printer detected. Please power on your ESC/POS printer, turn on Bluetooth, and pair it in Android Settings -> Bluetooth.',
        };
      }

      // Return discovered/paired devices so the UI lets the user pick, or connect directly if one obvious bonded printer
      const likelyBonded = scanRes.devices.filter((d) => d.bonded && d.isLikelyPrinter);
      if (likelyBonded.length === 1 && scanRes.devices.length === 1) {
        return await this.connectAndroidPrinter(likelyBonded[0], paperWidth);
      }

      return {
        success: true,
        devices: scanRes.devices,
        message: scanRes.message,
      };
    }

    // 2. Web Bluetooth API discovery if running in supported browser (Chrome/Edge desktop or Android Chrome)
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        const available = await (navigator.bluetooth as any).getAvailability().catch(() => true);
        if (!available) {
          return {
            success: false,
            message: 'Bluetooth is turned off or not available on this device. Please turn on Bluetooth in Settings and try again.',
          };
        }

        // @ts-ignore - Web Bluetooth API Navigator extensions
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: THERMAL_PRINTER_SERVICES,
        });

        if (device) {
          try {
            const server = await device.gatt.connect();
            await server.disconnect();

            cachedBluetoothDevice = device;

            const printerConfig: ThermalPrinterDevice = {
              id: device.id,
              name: device.name || `Bluetooth Printer (${device.id.slice(-4)})`,
              paperWidth,
              autoPrintOnSave: true,
              connectedAt: new Date().toISOString(),
            };

            return {
              success: true,
              printer: printerConfig,
              message: `Connected & saved default printer "${printerConfig.name}" successfully!`,
            };
          } catch (connErr: any) {
            return {
              success: false,
              message: `Could not connect to "${device.name || 'selected device'}": ${connErr.message || 'Signal too weak or not a responding printer.'} Please ensure your physical thermal printer is powered on and close to your phone.`,
            };
          }
        } else {
          return {
            success: false,
            message: 'No Bluetooth printer was selected or detected.',
          };
        }
      } catch (err: any) {
        console.warn('Web Bluetooth discovery note:', err);
        if (err.name === 'NotFoundError') {
          return { success: false, message: 'Bluetooth search cancelled. No printer selected.' };
        }
        return {
          success: false,
          message: 'Could not detect printer: Please ensure Bluetooth is enabled and the physical printer is turned on.',
        };
      }
    }

    // 3. Browser without Web Bluetooth support (desktop Safari/Firefox, iOS WebView)
    return {
      success: false,
      message: 'Direct Web Bluetooth is not supported in this browser. Open in Google Chrome or use the Brivu Android app for live Bluetooth printing.',
    };
  }

  /**
   * Print a receipt via Native Android Bluetooth (SPP/BLE), Web Bluetooth GATT, or system spooler
   */
  static async printReceipt(
    printer: ThermalPrinterDevice,
    receipt: Receipt
  ): Promise<{ success: boolean; message: string }> {
    if (!printer || !printer.id || printer.id === 'system-default') {
      return {
        success: false,
        message: 'No Bluetooth thermal printer is connected. Use Android Print or connect a printer in Settings.',
      };
    }

    // Native Android thermal printer (Classic RFCOMM SPP or BLE GATT via BluetoothPrinterPlugin)
    if (this.isAndroidNative()) {
      try {
        const escPosBytes = this.buildEscPosBytes(receipt, printer.paperWidth || '58mm');
        const base64Data = uint8ToBase64(escPosBytes);
        const res = await BluetoothPrinterNative.printBytes({
          address: printer.id,
          base64Data,
        });
        return {
          success: Boolean(res?.success),
          message:
            res?.message ||
            (res?.success
              ? `Printed successfully to ${printer.name}!`
              : `Could not print to "${printer.name}". Please ensure the printer is turned on and paired.`),
        };
      } catch (err: any) {
        console.warn('Native Android Bluetooth print error:', err);
        return {
          success: false,
          message:
            err?.message ||
            `Connection failed to printer "${printer.name}". Please verify your physical printer is powered on.`,
        };
      }
    }

    // Web Bluetooth GATT path for supported browsers
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        let device = cachedBluetoothDevice;
        const navBluetooth = (navigator as any).bluetooth;
        if (!device && navBluetooth && typeof navBluetooth.getDevices === 'function') {
          const devices = await navBluetooth.getDevices().catch(() => []);
          device = (devices || []).find((d: any) => d.id === printer.id);
        }

        if (device) {
          cachedBluetoothDevice = device;
          return await this.sendEscPosViaGatt(device, receipt, printer.paperWidth);
        } else {
          return {
            success: false,
            message: `Could not print: No active Bluetooth connection to printer "${printer.name}". Please search and reconnect your printer in Settings.`,
          };
        }
      } catch (err: any) {
        console.warn('Bluetooth print GATT error:', err);
        return {
          success: false,
          message: `Connection failed to printer "${printer.name}": ${err.message || 'Device is offline or out of range.'} Please verify your printer is powered on.`,
        };
      }
    }

    return {
      success: false,
      message: 'Direct Bluetooth printing is not supported in this browser. Use Google Chrome or the Brivu Android app.',
    };
  }

  /**
   * Print a test page to verify thermal printer setup
   */
  static async printTestPage(printer: ThermalPrinterDevice): Promise<{ success: boolean; message: string }> {
    const dummyReceipt: Receipt = {
      id: 'test-receipt',
      receiptNumber: 'TEST-001',
      createdAt: new Date().toISOString(),
      businessSnapshot: {
        name: 'QuickReceipt POS',
        description: 'Thermal Printer Setup Test',
        address: 'One-Tap Bluetooth Printing',
        phone: '+256 700 000 000',
        currency: 'UGX',
      } as BusinessProfile,
      customerName: 'Default Printer Test',
      items: [
        {
          id: 'item-1',
          name: 'Thermal Receipt Alignment Test',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        },
        {
          id: 'item-2',
          name: 'ESC/POS Character Spacing',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        },
      ],
      subtotal: 0,
      discount: 0,
      discountType: 'fixed',
      discountAmount: 0,
      total: 0,
      amountPaid: 0,
      balance: 0,
      paymentMethod: 'Cash',
      paymentStatus: 'paid',
      notes: `Paper Width: ${printer.paperWidth} | Connected: ${new Date().toLocaleTimeString()}`,
      template: 'thermal',
    };

    return this.printReceipt(printer, dummyReceipt);
  }

  /**
   * Low-level GATT write for Web Bluetooth
   */
  private static async sendEscPosViaGatt(
    device: any,
    receipt: Receipt,
    paperWidth: '58mm' | '80mm'
  ): Promise<{ success: boolean; message: string }> {
    let server = device.gatt;
    if (!server.connected) {
      server = await device.gatt.connect();
    }

    let writeCharacteristic: any = null;

    // Search services for writable GATT characteristic
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        }
      } catch {}
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      throw new Error('No writable GATT characteristic found on printer.');
    }

    const escPosBytes = this.buildEscPosBytes(receipt, paperWidth);

    // Send in chunks of 128 bytes
    const chunkSize = 128;
    for (let i = 0; i < escPosBytes.length; i += chunkSize) {
      const chunk = escPosBytes.slice(i, i + chunkSize);
      if (writeCharacteristic.properties.writeWithoutResponse) {
        await writeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await writeCharacteristic.writeValue(chunk);
      }
      await new Promise((res) => setTimeout(res, 30));
    }

    return {
      success: true,
      message: `Printed successfully to ${device.name || 'Bluetooth Printer'}!`,
    };
  }

  /**
   * Print using Android's native PrintManager dialog (on Android APK) or browser print dialog (on Web)
   */
  static async printWithSystemDialog(
    receipt: Receipt
  ): Promise<{ success: boolean; opened?: boolean; unimplemented?: boolean; message: string }> {
    const docLabel =
      receipt.documentType === 'quotation'
        ? 'Quotation'
        : receipt.documentType === 'invoice'
        ? 'Invoice'
        : 'Receipt';
    const jobName = `${docLabel}_${receipt.receiptNumber || receipt.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Native Android PrintManager via Capacitor plugin
    if (this.isAndroidNative()) {
      try {
        const html = this.buildPrintableHtml(receipt, false);
        const res = await BluetoothPrinterNative.systemPrint({ html, jobName });
        if (res && res.success) {
          return {
            success: true,
            opened: Boolean(res.opened ?? true),
            message: res.message || 'Android Print preview opened.',
          };
        }
        return {
          success: false,
          message: res?.message || 'Unable to open Android Print dialog.',
        };
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        const isUnimplemented =
          msg.toLowerCase().includes('not implemented') ||
          msg.toLowerCase().includes('unimplemented');
        return {
          success: false,
          unimplemented: isUnimplemented,
          message: isUnimplemented
            ? 'No Bluetooth thermal printer connected. Please rebuild/update the Brivu Android app to enable the Android Print dialog, or pair a Bluetooth printer in Settings.'
            : msg || 'Could not open Android Print dialog.',
        };
      }
    }

    // 2. Desktop / Mobile Web Browser print dialog
    if (typeof document !== 'undefined' && typeof window !== 'undefined' && typeof window.print === 'function') {
      return new Promise((resolve) => {
        const bodyFragment = this.buildPrintableHtml(receipt, true);
        const existing = document.getElementById('brivu-system-print-spooler');
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        const printContainer = document.createElement('div');
        printContainer.id = 'brivu-system-print-spooler';
        printContainer.innerHTML = `
          <style>
            #brivu-system-print-spooler { display: none; }
            @media print {
              body > *:not(#brivu-system-print-spooler) { display: none !important; }
              #brivu-system-print-spooler {
                display: block !important;
                width: 100%;
                margin: 0;
                padding: 0;
                background: #fff;
                color: #0f172a;
              }
              @page {
                size: auto;
                margin: 12mm;
              }
            }
          </style>
          ${bodyFragment}
        `;

        document.body.appendChild(printContainer);

        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          window.removeEventListener('afterprint', cleanup);
          if (printContainer.parentNode) {
            printContainer.parentNode.removeChild(printContainer);
          }
          resolve({
            success: true,
            opened: true,
            message: 'Print dialog opened.',
          });
        };

        window.addEventListener('afterprint', cleanup);
        setTimeout(() => {
          try {
            window.print();
          } catch (printErr: any) {
            if (!cleanedUp) {
              cleanedUp = true;
              window.removeEventListener('afterprint', cleanup);
              if (printContainer.parentNode) {
                printContainer.parentNode.removeChild(printContainer);
              }
              resolve({
                success: false,
                message: printErr?.message || 'Unable to open browser print dialog.',
              });
            }
            return;
          }
          setTimeout(cleanup, 1200);
        }, 120);
      });
    }

    return {
      success: false,
      message: 'No thermal printer is connected and system printing is unavailable.',
    };
  }

  /**
   * Build clean vector HTML for Android PrintManager / System Print
   */
  private static buildPrintableHtml(receipt: Receipt, fragmentOnly: boolean): string {
    const biz = resolveEffectiveBusinessProfile(receipt);
    const currency = receipt.currency || biz.currency || 'UGX';
    const docTitle =
      receipt.documentType === 'quotation'
        ? 'QUOTATION'
        : receipt.documentType === 'invoice'
        ? 'INVOICE'
        : 'RECEIPT';

    const created = receipt.createdAt ? new Date(receipt.createdAt) : new Date();
    const dateStr = !isNaN(created.getTime()) ? created.toLocaleDateString() : new Date().toLocaleDateString();
    const timeStr = !isNaN(created.getTime())
      ? created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const savedTemplateAccent = StorageService.getCustomTemplate(receipt.template || 'modern')?.accentColor;
    const accent =
      receipt.accentColor ||
      savedTemplateAccent ||
      (receipt.documentType === 'invoice' || receipt.documentType === 'quotation' ? '#4f46e5' : '#059669');

    const bName = (biz.name || '').trim();
    const validBusinessName =
      bName && bName.toLowerCase() !== 'business name' && bName.toLowerCase() !== 'quickreceipt'
        ? bName
        : '';

    const subtotalVal = Number(receipt.subtotal ?? 0);
    const discountVal = Number(receipt.discountAmount ?? 0);
    const taxVal = Number(receipt.taxAmount ?? 0);
    const shippingVal = Number(receipt.shippingFee ?? 0);
    const totalVal = Number(receipt.total ?? 0);
    const paidVal = Number(receipt.amountPaid ?? 0);
    const balanceDueVal = Math.max(0, totalVal - paidVal);

    const logoHtml =
      biz.logo && (biz.logo.startsWith('data:image/') || biz.logo.startsWith('https://'))
        ? `<img src="${escapeHtml(biz.logo)}" alt="Logo" style="max-height: 54px; max-width: 140px; object-fit: contain; margin-bottom: 8px;" />`
        : '';

    const bodyContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 720px; margin: 0 auto; padding: 16px; line-height: 1.45; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid ${escapeHtml(accent)}; padding-bottom: 14px; margin-bottom: 16px;">
          <div style="flex: 1; min-width: 0;">
            ${logoHtml}
            ${validBusinessName ? `<div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">${escapeHtml(validBusinessName)}</div>` : ''}
            ${biz.description ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${escapeHtml(biz.description)}</div>` : ''}
            <div style="font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.5;">
              ${biz.address ? `<div>${escapeHtml(biz.address)}</div>` : ''}
              ${biz.phone ? `<div>Tel: ${escapeHtml(biz.phone)}</div>` : ''}
              ${biz.email ? `<div>Email: ${escapeHtml(biz.email)}</div>` : ''}
              ${biz.taxNumber ? `<div>TIN / Tax ID: ${escapeHtml(biz.taxNumber)}</div>` : ''}
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="display: inline-block; background: ${escapeHtml(accent)}; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; padding: 5px 12px; border-radius: 6px;">${docTitle}</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 8px;">#${escapeHtml(receipt.receiptNumber || '')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Date: ${escapeHtml(dateStr)}${timeStr ? ` • ${escapeHtml(timeStr)}` : ''}</div>
            ${receipt.dueDate ? `<div style="font-size: 11px; color: #64748b;">Due: ${escapeHtml(receipt.dueDate)}</div>` : ''}
            ${receipt.paymentTerms ? `<div style="font-size: 11px; color: #64748b;">Terms: ${escapeHtml(receipt.paymentTerms)}</div>` : ''}
          </div>
        </div>

        ${(receipt.customerName || receipt.customerPhone || receipt.customerEmail || receipt.customerAddress) ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px;">Billed To</div>
            ${receipt.customerName ? `<div style="font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(receipt.customerName)}</div>` : ''}
            <div style="font-size: 11px; color: #475569;">
              ${receipt.customerPhone ? `<span>Tel: ${escapeHtml(receipt.customerPhone)}</span>` : ''}
              ${receipt.customerEmail ? `<span style="margin-left: 10px;">Email: ${escapeHtml(receipt.customerEmail)}</span>` : ''}
              ${receipt.customerAddress ? `<div>${escapeHtml(receipt.customerAddress)}</div>` : ''}
            </div>
          </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #475569;">Item</th>
              <th style="text-align: center; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #475569;">Qty</th>
              <th style="text-align: right; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #475569;">Unit Price</th>
              <th style="text-align: right; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #475569;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(receipt.items || [])
              .map(
                (item) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(item.name || '')}</td>
                <td style="padding: 8px 6px; text-align: center; color: #334155;">${Number(item.quantity || 0)}</td>
                <td style="padding: 8px 6px; text-align: right; color: #334155;">${escapeHtml(currency)} ${Number(item.unitPrice || 0).toLocaleString()}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a;">${escapeHtml(currency)} ${Number(item.subtotal || 0).toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
          <div style="width: 260px; max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 4px;">
              <span>Subtotal</span>
              <span>${escapeHtml(currency)} ${subtotalVal.toLocaleString()}</span>
            </div>
            ${discountVal > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #059669; margin-bottom: 4px;">
                <span>Discount</span>
                <span>-${escapeHtml(currency)} ${discountVal.toLocaleString()}</span>
              </div>
            ` : ''}
            ${taxVal > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 4px;">
                <span>Tax / VAT${receipt.taxRate ? ` (${receipt.taxRate}%)` : ''}</span>
                <span>+${escapeHtml(currency)} ${taxVal.toLocaleString()}</span>
              </div>
            ` : ''}
            ${shippingVal > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 4px;">
                <span>Shipping</span>
                <span>+${escapeHtml(currency)} ${shippingVal.toLocaleString()}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 6px; margin-top: 6px;">
              <span>TOTAL</span>
              <span style="color: ${escapeHtml(accent)};">${escapeHtml(currency)} ${totalVal.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-top: 6px;">
              <span>Amount Paid</span>
              <span>${escapeHtml(currency)} ${paidVal.toLocaleString()}</span>
            </div>
            ${balanceDueVal > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #dc2626; margin-top: 3px;">
                <span>Balance Due</span>
                <span>${escapeHtml(currency)} ${balanceDueVal.toLocaleString()}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="font-size: 11px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>${receipt.documentType === 'invoice' || receipt.documentType === 'quotation' ? '' : `Payment Method: <strong>${escapeHtml(receipt.paymentMethod || 'Cash')}</strong>`}</span>
            <span>Status: <strong style="text-transform: uppercase;">${escapeHtml(receipt.paymentStatus || 'paid')}</strong></span>
          </div>
          ${receipt.amountInWords ? `<div style="margin-top: 4px;"><strong>Amount in Words:</strong> ${escapeHtml(receipt.amountInWords)}</div>` : ''}
          ${receipt.bankDetails ? `<div style="margin-top: 6px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 6px 8px; color: #312e81;"><strong>Payment / Bank Details:</strong> ${escapeHtml(receipt.bankDetails)}</div>` : ''}
          ${receipt.notes ? `<div style="margin-top: 6px;"><strong>Notes:</strong> ${escapeHtml(receipt.notes)}</div>` : ''}
          ${biz.customFooter ? `<div style="margin-top: 10px; text-align: center; color: #64748b;">${escapeHtml(biz.customFooter)}</div>` : ''}
          <div style="margin-top: 12px; text-align: center; font-weight: 700; color: #0f172a;">Thank you for your business!</div>
        </div>
      </div>
    `;

    if (fragmentOnly) {
      return bodyContent;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(docTitle)} ${escapeHtml(receipt.receiptNumber || '')}</title>
  <style>
    @page { size: auto; margin: 12mm; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  }

  /**
   * Helper: Build raw ESC/POS binary commands
   */
  private static buildEscPosBytes(receipt: Receipt, paperWidth: '58mm' | '80mm'): Uint8Array {
    const encoder = new TextEncoder();
    const bytes: number[] = [];

    const pushBytes = (...b: number[]) => bytes.push(...b);
    const pushString = (str: string) => {
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) {
        bytes.push(encoded[i]);
      }
    };

    const biz = resolveEffectiveBusinessProfile(receipt);
    const cols = paperWidth === '80mm' ? 48 : 32;
    const currency = receipt.currency || biz.currency || 'UGX';

    // ESC @ (Initialize)
    pushBytes(0x1b, 0x40);

    // Center align
    pushBytes(0x1b, 0x61, 0x01);

    // Header Business Name
    const bName = (biz.name || '').trim();
    if (bName && bName.toLowerCase() !== 'business name' && bName.toLowerCase() !== 'quickreceipt') {
      // Double height & width for header
      pushBytes(0x1d, 0x21, 0x11);
      pushString(bName.toUpperCase() + '\n');
    }

    // Normal text size
    pushBytes(0x1d, 0x21, 0x00);
    if (biz.phone) {
      pushString(`Tel: ${biz.phone}\n`);
    }
    if (biz.address) {
      pushString(`${biz.address}\n`);
    }

    pushString('-'.repeat(cols) + '\n');

    // Left align
    pushBytes(0x1b, 0x61, 0x00);
    pushString(`${receipt.documentType === 'quotation' ? 'QUOTATION' : receipt.documentType === 'invoice' ? 'INVOICE' : 'RECEIPT'}: ${receipt.receiptNumber}\n`);
    const dateStr = receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString() : '';
    const timeStr = receipt.createdAt ? new Date(receipt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    pushString(`Date: ${dateStr}${timeStr ? ' ' + timeStr : ''}\n`);
    if (receipt.customerName) {
      pushString(`Customer: ${receipt.customerName}\n`);
    }
    if (receipt.customerPhone) {
      pushString(`Phone: ${receipt.customerPhone}\n`);
    }

    pushString('-'.repeat(cols) + '\n');

    // Items List
    receipt.items.forEach((item) => {
      const qtyName = `${item.quantity}x ${item.name}`;
      const priceStr = `${currency} ${item.subtotal.toLocaleString()}`;

      if (qtyName.length + priceStr.length + 1 <= cols) {
        const spaces = cols - (qtyName.length + priceStr.length);
        pushString(qtyName + ' '.repeat(spaces) + priceStr + '\n');
      } else {
        pushString(qtyName + '\n');
        const spaces = cols - priceStr.length;
        pushString(' '.repeat(Math.max(0, spaces)) + priceStr + '\n');
      }
    });

    pushString('-'.repeat(cols) + '\n');

    // Right align totals
    pushBytes(0x1b, 0x61, 0x02);
    if (receipt.discountAmount && receipt.discountAmount > 0) {
      pushString(`Discount: -${currency} ${receipt.discountAmount.toLocaleString()}\n`);
    }
    pushBytes(0x1b, 0x45, 0x01); // Bold ON
    const totalStr = `TOTAL: ${currency} ${receipt.total.toLocaleString()}`;
    pushString(totalStr + '\n');
    pushBytes(0x1b, 0x45, 0x00); // Bold OFF
    if (receipt.balance && receipt.balance > 0) {
      pushString(`Paid: ${currency} ${(receipt.amountPaid || 0).toLocaleString()}\n`);
      pushString(`Balance: ${currency} ${receipt.balance.toLocaleString()}\n`);
    }

    // Center align footer
    pushBytes(0x1b, 0x61, 0x01);
    if (receipt.documentType === 'invoice' || receipt.documentType === 'quotation') {
      pushString(`Status: ${receipt.paymentStatus.toUpperCase()}\n`);
    } else {
      pushString(`Payment: ${receipt.paymentMethod} (${receipt.paymentStatus.toUpperCase()})\n`);
    }
    if (receipt.notes) {
      pushString(`${receipt.notes}\n`);
    }
    pushString('\nThank you for your business!\n');
    pushString('Powered by Brivu\n');

    // Feed lines & cut
    pushBytes(0x1b, 0x64, 0x04); // Feed 4 lines
    pushBytes(0x1d, 0x56, 0x42, 0x00); // Cut paper

    return new Uint8Array(bytes);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
