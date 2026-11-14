import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Radio,
  Zap,
  Info,
  Bluetooth,
  RefreshCw,
  X,
} from 'lucide-react';
import { ThermalPrinterDevice, AppSettings } from '../types';
import {
  BluetoothPrinterService,
  AndroidBluetoothPrinter,
} from '../services/bluetoothPrinterService';
import { StorageService } from '../services/storage';

interface BluetoothPrinterSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const BluetoothPrinterSettings: React.FC<BluetoothPrinterSettingsProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<AndroidBluetoothPrinter[]>([]);
  const [scanStatusNote, setScanStatusNote] = useState<string>('');
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  const currentPrinter = settings.defaultPrinter;
  const isAndroidNative = BluetoothPrinterService.isAndroidNative();

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Trigger Native Android Bluetooth Scan OR Web Bluetooth requestDevice
  const handleScanForPrinter = async () => {
    setIsScanning(true);
    try {
      if (isAndroidNative) {
        const res = await BluetoothPrinterService.scanAndroidPrinters();
        if (!res.success) {
          showToast(res.message, true);
          return;
        }
        setDiscoveredDevices(res.devices);
        setScanStatusNote(res.message);
        setShowDevicePicker(true);
        return;
      }

      const res = await BluetoothPrinterService.searchForPrinter(
        currentPrinter?.paperWidth || '58mm'
      );
      if (res.success && res.printer) {
        const updated = {
          ...settings,
          defaultPrinter: res.printer,
        };
        StorageService.saveSettings(updated);
        onUpdateSettings(updated);
        showToast(res.message, false);
      } else {
        showToast(res.message, !res.success);
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      showToast(err.message || 'Error searching for Bluetooth printer', true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectAndroidDevice = async (device: AndroidBluetoothPrinter) => {
    setConnectingAddress(device.address);
    try {
      const res = await BluetoothPrinterService.connectAndroidPrinter(
        device,
        currentPrinter?.paperWidth || '58mm'
      );
      if (res.success && res.printer) {
        const updated = {
          ...settings,
          defaultPrinter: res.printer,
        };
        StorageService.saveSettings(updated);
        onUpdateSettings(updated);
        setShowDevicePicker(false);
        showToast(res.message, false);
      } else {
        showToast(res.message, true);
      }
    } catch (err: any) {
      showToast(err?.message || `Failed to connect to ${device.name}`, true);
    } finally {
      setConnectingAddress(null);
    }
  };

  // Change paper roll width (58mm vs 80mm)
  const handlePaperWidthChange = (width: '58mm' | '80mm') => {
    if (!currentPrinter) return;
    const updatedPrinter: ThermalPrinterDevice = {
      ...currentPrinter,
      paperWidth: width,
    };
    const updatedSettings = {
      ...settings,
      defaultPrinter: updatedPrinter,
    };
    StorageService.saveSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
    showToast(`Updated paper width to ${width}`);
  };

  // Toggle Auto-Print on save
  const handleToggleAutoPrint = () => {
    if (!currentPrinter) return;
    const nextVal = !currentPrinter.autoPrintOnSave;
    const updatedPrinter: ThermalPrinterDevice = {
      ...currentPrinter,
      autoPrintOnSave: nextVal,
    };
    const updatedSettings = {
      ...settings,
      defaultPrinter: updatedPrinter,
    };
    StorageService.saveSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
    showToast(nextVal ? 'Auto-print on save enabled!' : 'Auto-print on save disabled');
  };

  // Test Print
  const handlePrintTestPage = async () => {
    if (!currentPrinter) {
      showToast('Please search and select a Bluetooth thermal printer first.', true);
      return;
    }
    setIsPrintingTest(true);
    try {
      const res = await BluetoothPrinterService.printTestPage(currentPrinter);
      showToast(res.message, !res.success);
    } catch (err: any) {
      showToast(`Test print error: ${err.message || 'Check printer connection'}`, true);
    } finally {
      setIsPrintingTest(false);
    }
  };

  // Remove saved printer
  const handleRemovePrinter = () => {
    const updated = {
      ...settings,
      defaultPrinter: undefined,
    };
    StorageService.saveSettings(updated);
    onUpdateSettings(updated);
    showToast('Saved thermal printer removed');
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
      {/* Toast Alert */}
      {toast && (
        <div className="p-3 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg flex items-center gap-2 border border-slate-700 animate-fadeIn">
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>Bluetooth Thermal Printer</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Discover ESC/POS printers for 1-tap receipt printing
            </p>
          </div>
        </div>

        {currentPrinter ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Paired
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            Not Configured
          </span>
        )}
      </div>

      {/* Primary Discovery Button */}
      <button
        id="btn-discover-bluetooth-printer"
        type="button"
        onClick={handleScanForPrinter}
        disabled={isScanning}
        className="w-full p-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98 cursor-pointer disabled:opacity-50"
      >
        {isScanning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Scanning Nearby Bluetooth Printers...</span>
          </>
        ) : (
          <>
            <Radio className="w-4 h-4 text-blue-200 animate-pulse" />
            <span>{currentPrinter ? 'Search & Change Bluetooth Printer' : 'Search & Connect Bluetooth Printer'}</span>
          </>
        )}
      </button>

      {/* Paired Printer Details Card */}
      {currentPrinter && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-slate-900 dark:text-white block">
                {currentPrinter.name}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                ID: {currentPrinter.id}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRemovePrinter}
              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              title="Remove Printer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Paper Width Selection */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Paper Roll Width
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePaperWidthChange('58mm')}
                className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentPrinter.paperWidth === '58mm'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                <span>58mm (2 Inch / 32 Cols)</span>
              </button>

              <button
                type="button"
                onClick={() => handlePaperWidthChange('80mm')}
                className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentPrinter.paperWidth === '80mm'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                <span>80mm (3 Inch / 48 Cols)</span>
              </button>
            </div>
          </div>

          {/* Auto-Print Toggle */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-Print Receipt On Save
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Automatically trigger thermal print whenever a receipt is issued
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleAutoPrint}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer shrink-0 ${
                currentPrinter.autoPrintOnSave
                  ? 'bg-emerald-600 justify-end'
                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Test Print Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handlePrintTestPage}
              disabled={isPrintingTest}
              className="w-full p-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-98 disabled:opacity-50"
            >
              {isPrintingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Printing Test Page...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                  <span>Print Test Receipt Page</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Info / Android Setup Guide Note */}
      <div className="p-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed flex items-start gap-2.5">
        <Info className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <span className="font-extrabold block text-xs">How to Connect Your Bluetooth Thermal Printer:</span>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-950 dark:text-blue-200 font-medium">
            <li>Turn on your Bluetooth printer (e.g. POS-58, POS-80, MPT-II, GOOJPRT, Xprinter, Zjiang).</li>
            <li>Pair it once in your phone's <strong>Android Settings &rarr; Bluetooth</strong> (PIN is usually 0000 or 1234).</li>
            <li>Tap <strong>Search & Connect Bluetooth Printer</strong> above, select your printer, and choose 58mm or 80mm paper width.</li>
            <li>Tap <strong>Print Test Receipt Page</strong> to verify live 1-tap printing!</li>
          </ol>
        </div>
      </div>

      {/* NATIVE ANDROID BLUETOOTH PRINTER PICKER MODAL */}
      {showDevicePicker && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[85dvh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Select Bluetooth Printer</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Paired &amp; nearby thermal printers on your phone
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDevicePicker(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 min-h-0">
              {scanStatusNote && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  {scanStatusNote}
                </p>
              )}

              {discoveredDevices.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Printer className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    No Bluetooth printers detected nearby
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Make sure your thermal printer is powered ON and paired in Android Settings &rarr; Bluetooth, then tap Scan Again.
                  </p>
                </div>
              ) : (
                discoveredDevices.map((dev) => {
                  const isConnecting = connectingAddress === dev.address;
                  const isCurrentlySaved = currentPrinter?.id === dev.address;
                  return (
                    <div
                      key={dev.address}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                        isCurrentlySaved
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {dev.name}
                          </span>
                          {dev.isLikelyPrinter && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-bold uppercase">
                              Printer
                            </span>
                          )}
                          {dev.bonded && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase">
                              Paired
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">
                          {dev.address}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectAndroidDevice(dev)}
                        disabled={connectingAddress !== null}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <span>{isCurrentlySaved ? 'Reconnect' : 'Connect'}</span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleScanForPrinter}
                disabled={isScanning || connectingAddress !== null}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan Again</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowDevicePicker(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
