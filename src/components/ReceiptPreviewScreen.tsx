import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Share2,
  Edit,
  Copy,
  Printer,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCheck,
  Sparkles,
  Palette,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { Receipt, ReceiptTemplateId } from '../types';
import { formatCurrency, formatDateTime } from '../utils/currencies';
import { PdfGenerator, resolveEffectiveBusinessProfile } from '../services/pdfGenerator';
import { StorageService } from '../services/storage';
import { BluetoothPrinterService } from '../services/bluetoothPrinterService';
import { AdMobService } from '../services/admobService';
import { BRAND_COLOR_PRESETS, isValidHex, normalizeHex, getContrastTextHex } from '../utils/colors';

interface ReceiptPreviewScreenProps {
  receipt: Receipt;
  onBack: () => void;
  onEdit: (receipt: Receipt) => void;
  onDuplicate: (receipt: Receipt) => void;
}

import { TEMPLATES_CONFIG, getTemplateConfig } from '../utils/templates';
import { ReceiptLayoutRenderer } from './ReceiptLayoutRenderer';

import { DownloadSuccessModal } from './DownloadSuccessModal';

export const ReceiptPreviewScreen: React.FC<ReceiptPreviewScreenProps> = ({
  receipt: initialReceipt,
  onBack,
  onEdit,
  onDuplicate,
}) => {
  const [receipt, setReceipt] = useState<Receipt>(initialReceipt);

  useEffect(() => {
    setReceipt(initialReceipt);
  }, [initialReceipt]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [toastState, setToastState] = useState<{ text: string; isError?: boolean } | null>(null);
  const [printerFallbackModal, setPrinterFallbackModal] = useState<{
    isOpen: boolean;
    printerName: string;
    errorMessage: string;
  }>({ isOpen: false, printerName: '', errorMessage: '' });
  const [downloadModalData, setDownloadModalData] = useState<{
    isOpen: boolean;
    fileName?: string;
    folderName?: string;
    documentType?: 'receipt' | 'invoice' | 'quotation';
    documentNumber?: string;
  }>({ isOpen: false });

  const business = resolveEffectiveBusinessProfile(receipt);
  const currency = business?.currency || receipt.currency || 'UGX';
  const effectiveTemplate = (receipt.template || StorageService.getSettings().defaultTemplate || 'modern') as ReceiptTemplateId;
  const currentTheme = getTemplateConfig(effectiveTemplate);
  const isQuotation = receipt.documentType === 'quotation';
  const isInvoice = receipt.documentType === 'invoice';

  const showToast = (msg: string, isError = false) => {
    setToastState({ text: msg, isError });
    setTimeout(() => {
      setToastState((prev) => (prev?.text === msg ? null : prev));
    }, 3800);
  };

  const handleTemplateChange = (templateId: ReceiptTemplateId) => {
    const updated: Receipt = {
      ...receipt,
      template: templateId,
      accentColor: undefined,
      customTheme: undefined,
    };
    setReceipt(updated);
    StorageService.saveReceipt(updated);
    showToast(`Switched to ${templateId.toUpperCase()} template`);
  };

  const handleAccentColorChange = (newColor: string) => {
    const updated: Receipt = {
      ...receipt,
      accentColor: newColor || undefined,
    };
    setReceipt(updated);
    StorageService.saveReceipt(updated);
    if (newColor) {
      showToast(`Accent color updated to ${newColor.toUpperCase()}`);
    } else {
      showToast('Accent color reset to theme default');
    }
  };

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const res = await PdfGenerator.downloadPdf(receipt);
      showToast(res.message);
      AdMobService.showInterstitial('preview_pdf_download');
      setDownloadModalData({
        isOpen: true,
        fileName: res.filename,
        folderName: res.folder || 'Documents/Brivu',
        documentType: isQuotation ? 'quotation' : isInvoice ? 'invoice' : 'receipt',
        documentNumber: receipt.receiptNumber,
      });
    } catch (err) {
      console.error('PDF download error:', err);
      showToast('Error generating PDF file');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePhoto = async () => {
    try {
      setIsGenerating(true);
      showToast('Generating photo...');
      const res = await PdfGenerator.downloadReceiptPhoto(receipt);
      showToast(res.message);
      AdMobService.showInterstitial('preview_photo_save');
      setDownloadModalData({
        isOpen: true,
        fileName: res.filename,
        folderName: res.folder || 'Pictures/Brivu',
        documentType: isQuotation ? 'quotation' : isInvoice ? 'invoice' : 'receipt',
        documentNumber: receipt.receiptNumber,
      });
    } catch (err) {
      console.error('Photo save error:', err);
      showToast('Error saving receipt photo');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsGenerating(true);
      const res = await PdfGenerator.shareReceiptPdf(receipt);
      showToast(res.message);
      AdMobService.showInterstitial('preview_pdf_share');
    } catch (err) {
      console.error('Share error:', err);
      showToast('Sharing cancelled or failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const rawSavedPrinter = StorageService.getSavedThermalPrinter();
  const savedPrinter =
    rawSavedPrinter && rawSavedPrinter.id && rawSavedPrinter.id !== 'system-default'
      ? rawSavedPrinter
      : undefined;
  const [isThermalPrinting, setIsThermalPrinting] = useState(false);

  const handleOpenSystemPrint = async () => {
    setPrinterFallbackModal({ isOpen: false, printerName: '', errorMessage: '' });
    setIsThermalPrinting(true);
    try {
      const res = await BluetoothPrinterService.printWithSystemDialog(receipt);
      if (!res.success) {
        showToast(res.message || 'Unable to open Android Print dialog.', true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Unable to open print dialog.', true);
    } finally {
      setIsThermalPrinting(false);
    }
  };

  const handleSmartPrint = async () => {
    if (savedPrinter) {
      setIsThermalPrinting(true);
      try {
        showToast(`Sending to ${savedPrinter.name}...`);
        const res = await BluetoothPrinterService.printReceipt(savedPrinter, receipt);
        if (res.success) {
          showToast(res.message || `Printed successfully to ${savedPrinter.name}!`, false);
        } else {
          showToast(res.message || `Could not reach printer "${savedPrinter.name}".`, true);
          setPrinterFallbackModal({
            isOpen: true,
            printerName: savedPrinter.name,
            errorMessage:
              res.message ||
              `Bluetooth printer "${savedPrinter.name}" is not connected or powered off.`,
          });
        }
      } catch (err: any) {
        const msg = `Thermal print error: ${err?.message || 'Check printer connection'}`;
        showToast(msg, true);
        setPrinterFallbackModal({
          isOpen: true,
          printerName: savedPrinter.name,
          errorMessage: msg,
        });
      } finally {
        setIsThermalPrinting(false);
      }
    } else {
      await handleOpenSystemPrint();
    }
  };

  const handlePrint = () => {
    handleSmartPrint();
  };

  const handleThermalPrint = async () => {
    handleSmartPrint();
  };

  return (
    <div className="space-y-4 pb-36 animate-fadeIn max-w-2xl mx-auto">
      {/* Toast Notification (Centered prominently in screen) */}
      {toastState && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 pointer-events-none z-[99999] flex items-center justify-center p-4">
          <div
            className={`pointer-events-auto max-w-sm sm:max-w-md w-auto px-5 py-3.5 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white text-xs sm:text-sm font-bold shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
              toastState.isError ? 'border-amber-500/50' : 'border-emerald-500/40'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                toastState.isError
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {toastState.isError ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <span className="leading-snug">{toastState.text}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <button
          id="btn-preview-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {isInvoice ? 'Invoices' : 'Receipts'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-preview-edit"
            onClick={() => onEdit(receipt)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isInvoice ? 'Edit Invoice' : 'Edit Receipt'}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            id="btn-preview-duplicate"
            onClick={() => onDuplicate(receipt)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isInvoice ? 'Duplicate Invoice' : 'Duplicate Receipt'}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            id="btn-preview-print"
            onClick={handlePrint}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isInvoice ? 'Print Invoice' : 'Print Receipt'}
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Template Selector Pills & Accent Color Row */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {isInvoice ? 'Invoice Template Theme' : 'Receipt Template Theme'}
            </span>
            <span className={`text-[10px] font-semibold ${isInvoice ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {TEMPLATES_CONFIG.length} Professional Themes
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {TEMPLATES_CONFIG.map((t) => {
              const active = effectiveTemplate === t.id;
              return (
                <button
                  key={t.id}
                  id={`btn-template-select-${t.id}`}
                  onClick={() => handleTemplateChange(t.id)}
                  className={`py-1.5 px-3 text-center rounded-xl border text-xs font-bold transition shrink-0 whitespace-nowrap active:scale-95 ${
                    active
                      ? isInvoice
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color Picker Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
            <Palette className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px]">Accent:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-1">
            {(() => {
              const savedTemplate = StorageService.getCustomTemplate(effectiveTemplate);
              const currentAccent = receipt.accentColor || savedTemplate?.accentColor;
              return (
                <>
                  {BRAND_COLOR_PRESETS.map((preset) => {
                    const isSelected =
                      currentAccent && normalizeHex(currentAccent) === normalizeHex(preset.hex);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        id={`btn-preview-accent-${preset.id}`}
                        onClick={() => handleAccentColorChange(preset.hex)}
                        title={preset.name}
                        className={`w-5 h-5 rounded-full shadow-xs flex items-center justify-center transition-transform shrink-0 ${
                          isSelected ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : 'hover:scale-105'
                        }`}
                        style={{ background: preset.hex }}
                      >
                        {isSelected && (
                          <Check
                            className="w-3 h-3 stroke-[3]"
                            style={{ color: getContrastTextHex(preset.hex) }}
                          />
                        )}
                      </button>
                    );
                  })}

                  {/* Custom Eye Dropper */}
                  <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600">
                    <input
                      id="input-preview-custom-accent"
                      type="color"
                      value={
                        currentAccent && isValidHex(currentAccent)
                          ? normalizeHex(currentAccent)
                          : '#059669'
                      }
                      onChange={(e) => handleAccentColorChange(e.target.value)}
                      className="absolute -top-1 -left-1 w-8 h-8 cursor-pointer border-0 p-0"
                    />
                  </div>

                  {receipt.accentColor && (
                    <button
                      type="button"
                      id="btn-preview-reset-accent"
                      onClick={() => handleAccentColorChange('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition underline shrink-0 ml-1"
                    >
                      Reset
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* REALISTIC RECEIPT PREVIEW CONTAINER                          */}
      {/* ============================================================ */}
      <div
        className="receipt-print-area"
        id="receipt-preview-render-node"
        data-receipt-id={receipt.id}
        data-receipt-number={receipt.receiptNumber}
      >
        <ReceiptLayoutRenderer
          data={{
            storeName: business.name || '',
            businessDescription: business.description || '',
            phone: business.phone || '',
            email: business.email || '',
            address: business.address || '',
            taxNumber: business.taxNumber || '',
            logo: business.logo,
            signature: business.signature,
            customFooter: business.customFooter || '',
            receiptNumber: receipt.receiptNumber,
            createdAt: receipt.createdAt,
            customerName: receipt.customerName,
            customerPhone: receipt.customerPhone,
            customerEmail: receipt.customerEmail,
            customerAddress: receipt.customerAddress,
            documentType: receipt.documentType || (isQuotation ? 'quotation' : isInvoice ? 'invoice' : 'receipt'),
            dueDate: receipt.dueDate,
            paymentTerms: receipt.paymentTerms,
            paymentMethod: receipt.paymentMethod,
            paymentStatus: receipt.paymentStatus,
            items: receipt.items || [],
            subtotal: receipt.subtotal,
            discountAmount: receipt.discountAmount,
            total: receipt.total,
            amountPaid: receipt.amountPaid,
            balance: receipt.balance,
            amountInWords: receipt.amountInWords,
            notes: receipt.notes,
            nonReturnable: receipt.nonReturnable === true || (receipt.nonReturnable === undefined && !receipt.nonRefundable),
            nonRefundable: Boolean(receipt.nonRefundable),
            currency: currency,
            template: effectiveTemplate,
            accentColor: receipt.accentColor || StorageService.getCustomTemplate(effectiveTemplate)?.accentColor,
            customTheme: (() => {
              const saved = StorageService.getCustomTemplate(effectiveTemplate);
              const defaultDocBadge = isQuotation ? 'QUOTATION' : isInvoice ? 'INVOICE' : 'RECEIPT';
              const rawBadge = receipt.customTheme?.badgeText || saved?.badgeText;
              const upperBadge = (rawBadge || '').trim().toUpperCase();
              const resolvedBadge = isQuotation
                ? (!rawBadge || upperBadge === 'RECEIPT' || upperBadge === 'INVOICE' ? 'QUOTATION' : rawBadge)
                : isInvoice
                  ? (!rawBadge || upperBadge === 'RECEIPT' ? 'INVOICE' : rawBadge)
                  : rawBadge || defaultDocBadge;
              return {
                headerBgColor: receipt.customTheme?.headerBgColor || saved?.headerBgColor,
                headerTextColor: receipt.customTheme?.headerTextColor || saved?.headerTextColor,
                totalBgColor: receipt.customTheme?.totalBgColor || saved?.totalBgColor,
                totalTextColor: receipt.customTheme?.totalTextColor || saved?.totalTextColor,
                paperBgColor: receipt.customTheme?.paperBgColor || saved?.paperBgColor,
                accentColor: receipt.customTheme?.accentColor || receipt.accentColor || saved?.accentColor,
                fontFamily: receipt.customTheme?.fontFamily || saved?.fontFamily,
                badgeText: resolvedBadge,
                badgeBgColor: receipt.customTheme?.badgeBgColor || saved?.badgeBgColor,
                badgeTextColor: receipt.customTheme?.badgeTextColor || saved?.badgeTextColor,
                headerNameColor: receipt.customTheme?.headerNameColor || saved?.headerNameColor,
                headerDescColor: receipt.customTheme?.headerDescColor || saved?.headerDescColor,
                headerAddressColor: receipt.customTheme?.headerAddressColor || saved?.headerAddressColor,
                receiptTextColor: receipt.customTheme?.receiptTextColor || saved?.receiptTextColor,
                metaTextColor: receipt.customTheme?.metaTextColor || saved?.metaTextColor,
                paymentTextColor: receipt.customTheme?.paymentTextColor || saved?.paymentTextColor,
                footerTextColor: receipt.customTheme?.footerTextColor || saved?.footerTextColor,
              };
            })(),
            isSample: false,
          }}
        />
      </div>

      {/* FIXED BOTTOM FLOATING ACTION BAR: DOWNLOAD & SHARE */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-2.5 sm:p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="max-w-2xl mx-auto grid grid-cols-4 gap-1.5 sm:gap-2">
          {/* Download PDF */}
          <button
            id="btn-preview-download-pdf"
            onClick={handleDownload}
            disabled={isGenerating}
            className="py-2.5 px-1 sm:px-2 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs border border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50"
            title={isQuotation ? 'Download PDF Quotation' : isInvoice ? 'Download PDF Invoice' : 'Download PDF Receipt'}
          >
            <Download className={`w-3.5 h-3.5 shrink-0 ${isQuotation || isInvoice ? 'text-indigo-600' : 'text-emerald-600'}`} />
            <span className="whitespace-nowrap">{isQuotation ? 'Quote PDF' : isInvoice ? 'Invoice PDF' : 'PDF'}</span>
          </button>

          {/* Save Image */}
          <button
            id="btn-preview-save-photo"
            onClick={handleSavePhoto}
            disabled={isGenerating}
            className="py-2.5 px-1 sm:px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold text-xs border border-emerald-300 dark:border-emerald-700 shadow-sm active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50"
            title={isQuotation ? 'Save Quotation as Image (PNG)' : isInvoice ? 'Save Invoice as Image (PNG)' : 'Save Receipt as Image (PNG)'}
          >
            <Download className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="whitespace-nowrap">Image</span>
          </button>

          {/* Share PDF (WhatsApp / Android Sheet) */}
          <button
            id="btn-preview-share-pdf"
            onClick={handleShare}
            disabled={isGenerating}
            className={`py-2.5 px-1 sm:px-2 rounded-xl text-white font-bold text-xs shadow-xs active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50 ${
              isInvoice
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-95'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Share</span>
          </button>

          {/* Print Button (Bluetooth Thermal / System Printer) */}
          <button
            id="btn-preview-thermal-print"
            type="button"
            onClick={handleThermalPrint}
            disabled={isGenerating || isThermalPrinting}
            title={savedPrinter ? `Print directly to ${savedPrinter.name}` : 'Print Invoice / Receipt'}
            className="py-2.5 px-1 sm:px-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50 cursor-pointer"
          >
            <Printer className={`w-3.5 h-3.5 shrink-0 ${isThermalPrinting ? 'animate-bounce' : ''}`} />
            <span className="whitespace-nowrap">{isThermalPrinting ? 'Printing...' : savedPrinter ? 'Print (BT)' : 'Print'}</span>
          </button>
        </div>
      </div>

      <DownloadSuccessModal
        isOpen={downloadModalData.isOpen}
        onClose={() => setDownloadModalData({ isOpen: false })}
        fileName={downloadModalData.fileName}
        folderName={downloadModalData.folderName}
        documentType={downloadModalData.documentType}
        documentNumber={downloadModalData.documentNumber}
      />

      {printerFallbackModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Thermal Printer Not Connected
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {printerFallbackModal.errorMessage}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenSystemPrint}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print with Android Print Dialog</span>
              </button>
              <button
                type="button"
                onClick={() => setPrinterFallbackModal({ isOpen: false, printerName: '', errorMessage: '' })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
