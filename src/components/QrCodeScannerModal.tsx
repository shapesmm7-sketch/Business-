import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera as CameraIcon,
  Image as ImageIcon,
  QrCode,
  Scan,
  Zap,
  Volume2,
  VolumeX,
  Receipt as ReceiptIcon,
  Boxes,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  RefreshCw,
  Plus,
  Loader2,
  Eye,
} from 'lucide-react';
import { CameraSource } from '@capacitor/camera';
import { Html5Qrcode } from 'html5-qrcode';
import {
  scanQrWithCapacitorCamera,
  parseScannedQrText,
  ScannedQrResult,
} from '../utils/qrScannerService';
import { Receipt, InventoryProduct, QRCodeHostedPage } from '../types';
import { formatCurrency } from '../utils/currencies';

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt?: (receipt: Receipt) => void;
  onOpenCustomerPage?: (
    page: QRCodeHostedPage,
    tab?: 'menu' | 'photos' | 'about',
    itemId?: string,
    photoId?: string
  ) => void;
  onOpenInventoryProduct?: (product: InventoryProduct) => void;
  onCreateReceiptWithItem?: (item: { name: string; unitPrice: number; quantity: number }) => void;
  onCreateInvoiceWithItem?: (item: { name: string; unitPrice: number; quantity: number }) => void;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onOpenReceipt,
  onOpenCustomerPage,
  onOpenInventoryProduct,
  onCreateReceiptWithItem,
  onCreateInvoiceWithItem,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'native'>('live');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScannedQrResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  const html5ScannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const containerId = 'qr-unified-scanner-viewport';

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch {
      // Audio playback failsafe
    }
  };

  const handleDecodedText = async (decodedText: string) => {
    if (!decodedText || isProcessing) return;
    setIsProcessing(true);
    playBeep();
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([40, 40, 40]);
      }
    } catch {}

    try {
      const result = await parseScannedQrText(decodedText);
      if (isMountedRef.current) {
        setScanResult(result);
        stopLiveScanner();
      }
    } catch (err) {
      console.warn('[QR Modal] Parsing error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  const startLiveScanner = async () => {
    setCameraError(null);
    try {
      if (!html5ScannerRef.current) {
        html5ScannerRef.current = new Html5Qrcode(containerId);
      }
      setIsScanning(true);
      await html5ScannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // ignore frame errors
        }
      );

      // Check for torch capability
      try {
        const capabilities = html5ScannerRef.current.getRunningTrackCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        }
      } catch {}
    } catch (err: any) {
      console.warn('[QR Modal] Live camera start note:', err);
      setIsScanning(false);
      setCameraError(err?.message || 'Unable to access live camera feed. Use Camera button below.');
    }
  };

  const stopLiveScanner = async () => {
    if (html5ScannerRef.current && html5ScannerRef.current.isScanning) {
      try {
        await html5ScannerRef.current.stop();
        await html5ScannerRef.current.clear();
      } catch {}
    }
    setIsScanning(false);
  };

  const toggleTorch = async () => {
    if (!html5ScannerRef.current || !hasTorch) return;
    try {
      const next = !isTorchOn;
      await html5ScannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next } as any],
      });
      setIsTorchOn(next);
    } catch {}
  };

  // Capacitor Camera Capture
  const handleScanWithCapacitorCamera = async (source: CameraSource) => {
    await stopLiveScanner();
    setIsProcessing(true);
    setCameraError(null);

    const { text, error } = await scanQrWithCapacitorCamera(source);
    setIsProcessing(false);

    if (text) {
      handleDecodedText(text);
    } else if (error) {
      setCameraError(error);
    }
  };

  const handleResetScan = () => {
    setScanResult(null);
    setCameraError(null);
    startLiveScanner();
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      setScanResult(null);
      setCameraError(null);
      const timer = setTimeout(() => {
        startLiveScanner();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopLiveScanner();
      };
    } else {
      stopLiveScanner();
    }
    return () => {
      isMountedRef.current = false;
      stopLiveScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Scan QR Code
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Receipts, Customer Hubs & Stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={soundEnabled ? 'Mute sound' : 'Enable sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!scanResult ? (
            <>
              {/* LIVE VIEWFINDER CONTAINER */}
              <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-dashed border-teal-500/50 shadow-inner flex items-center justify-center">
                <div id={containerId} className="w-full h-full object-cover" />

                {/* Scanning reticle overlay */}
                <div className="absolute inset-8 pointer-events-none border-2 border-teal-400/80 rounded-2xl shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-teal-400 -mt-1 -ml-1 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-teal-400 -mt-1 -mr-1 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-teal-400 -mb-1 -ml-1 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-teal-400 -mb-1 -mr-1 rounded-br-md" />

                  {isScanning && !cameraError && (
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Torch button overlay */}
                {hasTorch && isScanning && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full backdrop-blur-md transition ${
                      isTorchOn ? 'bg-amber-500 text-white' : 'bg-slate-900/70 text-slate-200'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}

                {/* Camera error / instructions message */}
                {cameraError && (
                  <div className="absolute inset-4 rounded-2xl bg-slate-900/90 backdrop-blur-md p-4 text-center flex flex-col items-center justify-center space-y-2 z-10 text-white">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-slate-200">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => handleScanWithCapacitorCamera(CameraSource.Camera)}
                      className="px-4 py-2 mt-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <CameraIcon className="w-3.5 h-3.5" />
                      Take Photo with Camera
                    </button>
                  </div>
                )}

                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-20 text-white">
                    <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                    <span className="text-xs font-semibold">Reading QR Code...</span>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS: @capacitor/camera CAPTURE OR GALLERY PICKER */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleScanWithCapacitorCamera(CameraSource.Camera)}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-teal-600 hover:bg-teal-500 active:scale-[0.98] text-white text-xs font-bold shadow-sm shadow-teal-600/20 transition border border-teal-500/50"
                >
                  <CameraIcon className="w-4 h-4 shrink-0" />
                  <span>Snap Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScanWithCapacitorCamera(CameraSource.Photos)}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition border border-slate-200 dark:border-slate-700 active:scale-[0.98]"
                >
                  <ImageIcon className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <span>From Gallery</span>
                </button>
              </div>

              <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 px-2">
                Scan printed receipts, customer menus, hosted hubs, or inventory item barcodes.
              </div>
            </>
          ) : (
            /* SCANNED RESULT VIEW */
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  {scanResult.type === 'receipt' && <ReceiptIcon className="w-5 h-5" />}
                  {scanResult.type === 'customer_page' && <QrCode className="w-5 h-5" />}
                  {scanResult.type === 'inventory_item' && <Boxes className="w-5 h-5" />}
                  {(scanResult.type === 'url' || scanResult.type === 'text') && (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {scanResult.type.replace('_', ' ')}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {scanResult.title}
                  </h4>
                  {scanResult.subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {scanResult.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* DETAILS CARD */}
              {scanResult.receipt && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Receipt No:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {scanResult.receipt.receiptNumber}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Customer:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {scanResult.receipt.customerName || 'Walk-in'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Total Amount:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {scanResult.receipt.currency || 'UGX'}{' '}
                      {scanResult.receipt.total?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Date:</span>
                    <span>
                      {new Date(scanResult.receipt.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>

                  {onOpenReceipt && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReceipt(scanResult.receipt!);
                      }}
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open & View Receipt</span>
                    </button>
                  )}
                </div>
              )}

              {scanResult.customerPage && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Page Title:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {scanResult.customerPage.title}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Target Section:</span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400 uppercase">
                      {scanResult.targetTab || 'Full Showcase Hub'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Showcase Items:</span>
                    <span>{scanResult.customerPage.menuItems?.length || 0} items</span>
                  </div>

                  {onOpenCustomerPage && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomerPage(
                          scanResult.customerPage!,
                          scanResult.targetTab,
                          scanResult.targetItemId,
                          scanResult.targetPhotoId
                        );
                      }}
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Customer Page</span>
                    </button>
                  )}
                </div>
              )}

              {scanResult.product && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Product:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {scanResult.product.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Available Stock:</span>
                    <span
                      className={`font-bold ${
                        scanResult.product.quantity <= 5
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {scanResult.product.quantity} units
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Price:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {(scanResult.product.sellingPrice ?? (scanResult.product as any).unitPrice ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {onOpenInventoryProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenInventoryProduct(scanResult.product!);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>View in Stock</span>
                      </button>
                    )}

                    {onCreateReceiptWithItem && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onCreateReceiptWithItem({
                            name: scanResult.product!.name,
                            unitPrice: scanResult.product.sellingPrice || (scanResult.product as any).unitPrice || 0,
                            quantity: 1,
                          });
                        }}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Receipt</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {scanResult.url && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="text-slate-500 break-all">{scanResult.url}</div>
                  <a
                    href={scanResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Web Link</span>
                  </a>
                </div>
              )}

              {/* RESET SCAN BUTTON */}
              <button
                type="button"
                onClick={handleResetScan}
                className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Scan Another Code</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
