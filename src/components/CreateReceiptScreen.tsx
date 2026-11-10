import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  DollarSign,
  Check,
  Eye,
  Share2,
  Percent,
  Sparkles,
  ArrowLeft,
  Info,
  Save,
  Download,
  Camera,
  CheckCircle2,
  Boxes,
  Scan,
  Users,
  Building2,
  MapPin,
} from 'lucide-react';
import {
  BusinessProfile,
  PaymentMethod,
  PaymentStatus,
  Receipt,
  ReceiptItem,
  ReceiptTemplateId,
} from '../types';
import { formatCurrency, roundMoney } from '../utils/currencies';
import { StorageService } from '../services/storage';
import { PdfGenerator } from '../services/pdfGenerator';
import { BluetoothPrinterService } from '../services/bluetoothPrinterService';
import { AdMobService } from '../services/admobService';
import { StockProductPickerModal, SelectedStockItem } from './StockProductPickerModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { PhoneInputField } from './PhoneInputField';
import { DownloadSuccessModal } from './DownloadSuccessModal';
import { ClientPickerModal, ClientOption } from './ClientPickerModal';
import { t, formatNumber } from '../utils/i18n';

interface CreateReceiptScreenProps {
  business: BusinessProfile;
  defaultTemplate: ReceiptTemplateId;
  defaultPaymentMethod: PaymentMethod;
  editingReceipt?: Receipt | null;
  duplicateFromReceipt?: Receipt | null;
  onCancel: () => void;
  onSaveOnly?: (receipt: Receipt) => void;
  onSaveAndPreview: (receipt: Receipt) => void;
  onQuickDownload?: (receipt: Receipt) => void;
  onQuickShare: (receipt: Receipt) => void;
}

const getLocalDatetimeString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const CreateReceiptScreen: React.FC<CreateReceiptScreenProps> = ({
  business,
  defaultTemplate,
  defaultPaymentMethod,
  editingReceipt,
  duplicateFromReceipt,
  onCancel,
  onSaveOnly,
  onSaveAndPreview,
  onQuickDownload,
  onQuickShare,
}) => {
  const currency = business.currency || 'UGX';

  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Receipt numbering & metadata
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(
    getLocalDatetimeString(new Date())
  );

  // Customer information
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerTaxNumber, setCustomerTaxNumber] = useState<string>('');

  // Items
  const [items, setItems] = useState<ReceiptItem[]>([
    { id: '1', name: '', quantity: 1, unitPrice: 0, subtotal: 0 },
  ]);

  // Discount
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Payment
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [amountInWords, setAmountInWords] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    defaultPaymentMethod || 'Cash'
  );
  const [notes, setNotes] = useState<string>(t('thank_you_business', business?.language));
  const [nonReturnable, setNonReturnable] = useState<boolean>(true);
  const [nonRefundable, setNonRefundable] = useState<boolean>(false);

  // Form error states
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Client Picker, Stock Product Picker & Barcode Scanner Modal States
  const [isClientPickerOpen, setIsClientPickerOpen] = useState<boolean>(false);
  const [isStockPickerOpen, setIsStockPickerOpen] = useState<boolean>(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState<boolean>(false);

  const handleSelectClient = (client: ClientOption) => {
    if (client.name) setCustomerName(client.name);
    if (client.contact) setCustomerPhone(client.contact);
    if (client.email) setCustomerEmail(client.email);
    if (client.location) setCustomerAddress(client.location);
    if (client.taxNumber) setCustomerTaxNumber(client.taxNumber);
  };
  const [downloadModalData, setDownloadModalData] = useState<{
    isOpen: boolean;
    fileName?: string;
    folderName?: string;
    documentType?: 'receipt' | 'invoice';
    documentNumber?: string;
  }>({ isOpen: false });

  // Initialize receipt number and form data
  useEffect(() => {
    if (editingReceipt) {
      setReceiptNumber(editingReceipt.receiptNumber);
      try {
        setReceiptDate(getLocalDatetimeString(new Date(editingReceipt.createdAt)));
      } catch {
        setReceiptDate(getLocalDatetimeString(new Date()));
      }
      setCustomerName(editingReceipt.customerName || '');
      setCustomerPhone(editingReceipt.customerPhone || '');
      setCustomerEmail(editingReceipt.customerEmail || '');
      setCustomerAddress(editingReceipt.customerAddress || '');
      setCustomerTaxNumber(editingReceipt.customerTaxNumber || '');
      setItems(
        editingReceipt.items.length > 0
          ? editingReceipt.items
          : [{ id: '1', name: '', quantity: 1, unitPrice: 0, subtotal: 0 }]
      );
      setDiscountType(editingReceipt.discountType || 'fixed');
      setDiscountValue(editingReceipt.discount || 0);
      setAmountPaidInput(String(editingReceipt.amountPaid));
      setAmountInWords(editingReceipt.amountInWords || '');
      setPaymentMethod(editingReceipt.paymentMethod);
      setNotes(editingReceipt.notes || '');
      setNonReturnable(editingReceipt.nonReturnable ?? true);
      setNonRefundable(Boolean(editingReceipt.nonRefundable));
    } else if (duplicateFromReceipt) {
      // Duplicating: fresh receipt number, current timestamp, but copy over details
      setReceiptNumber(StorageService.generateReceiptNumber());
      setReceiptDate(getLocalDatetimeString(new Date()));
      setCustomerName(duplicateFromReceipt.customerName || '');
      setCustomerPhone(duplicateFromReceipt.customerPhone || '');
      setCustomerEmail(duplicateFromReceipt.customerEmail || '');
      setCustomerAddress(duplicateFromReceipt.customerAddress || '');
      setCustomerTaxNumber(duplicateFromReceipt.customerTaxNumber || '');
      setItems(
        duplicateFromReceipt.items.map((it, idx) => ({
          ...it,
          id: `item-${Date.now()}-${idx}`,
        }))
      );
      setDiscountType(duplicateFromReceipt.discountType || 'fixed');
      setDiscountValue(duplicateFromReceipt.discount || 0);
      setAmountPaidInput(String(duplicateFromReceipt.amountPaid));
      setAmountInWords(duplicateFromReceipt.amountInWords || '');
      setPaymentMethod(duplicateFromReceipt.paymentMethod);
      setNotes(duplicateFromReceipt.notes || '');
      setNonReturnable(duplicateFromReceipt.nonReturnable ?? true);
      setNonRefundable(Boolean(duplicateFromReceipt.nonRefundable));
    } else {
      // Check if draft exists
      const draft = StorageService.getDraft();
      if (draft && draft.items && draft.items.length > 0) {
        setReceiptNumber(draft.receiptNumber || StorageService.generateReceiptNumber());
        setCustomerName(draft.customerName || '');
        setCustomerPhone(draft.customerPhone || '');
        setCustomerEmail(draft.customerEmail || '');
        setCustomerAddress(draft.customerAddress || '');
        setCustomerTaxNumber(draft.customerTaxNumber || '');
        setItems(draft.items);
        setDiscountType(draft.discountType || 'fixed');
        setDiscountValue(draft.discount || 0);
        setAmountPaidInput(draft.amountPaid !== undefined ? String(draft.amountPaid) : '');
        setAmountInWords(draft.amountInWords || '');
        const defaultNotes = t('thank_you_business', business?.language);
        const isDefaultOrEng = !draft.notes || draft.notes === 'Thank you' || draft.notes === 'Thank you for your business!';
        setNotes(isDefaultOrEng ? defaultNotes : draft.notes);
        setNonReturnable(draft.nonReturnable ?? true);
        setNonRefundable(Boolean(draft.nonRefundable));
      } else {
        setReceiptNumber(StorageService.generateReceiptNumber());
        setNotes(t('thank_you_business', business?.language));
        setNonReturnable(true);
        setNonRefundable(false);
      }
    }
  }, [editingReceipt, duplicateFromReceipt, defaultPaymentMethod, business?.language]);

  // Calculations
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
  );

  let discountAmount = 0;
  if (discountValue > 0) {
    if (discountType === 'percentage') {
      discountAmount = roundMoney((subtotal * Math.min(100, discountValue)) / 100);
    } else {
      discountAmount = roundMoney(Math.min(subtotal, discountValue));
    }
  }

  const total = roundMoney(Math.max(0, subtotal - discountAmount));

  // Determine amount paid
  const parsedPaid = amountPaidInput.trim() === '' ? total : parseFloat(amountPaidInput) || 0;
  const amountPaid = roundMoney(parsedPaid);
  const balance = roundMoney(amountPaid - total); // positive = change, negative = due

  let paymentStatus: PaymentStatus = 'paid';
  if (amountPaid === 0 && total > 0) {
    paymentStatus = 'unpaid';
  } else if (amountPaid < total) {
    paymentStatus = 'partial';
  } else {
    paymentStatus = 'paid';
  }

  // Auto-save draft on changes (when not editing an existing finalized receipt)
  useEffect(() => {
    if (!editingReceipt && items.some((i) => i.name.trim() !== '')) {
      StorageService.saveDraft({
        receiptNumber,
        customerName,
        customerPhone,
        customerEmail,
        items,
        discountType,
        discount: discountValue,
        amountPaid,
        amountInWords,
        paymentMethod,
        notes,
        nonReturnable,
        nonRefundable,
      });
    }
  }, [
    editingReceipt,
    receiptNumber,
    customerName,
    customerPhone,
    customerEmail,
    items,
    discountType,
    discountValue,
    amountPaid,
    paymentMethod,
    notes,
    nonReturnable,
    nonRefundable,
  ]);

  // Item change handler
  const handleItemChange = (
    id: string,
    field: keyof ReceiptItem,
    val: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };

        const qty = typeof updated.quantity === 'number' ? updated.quantity : parseFloat(String(updated.quantity)) || 0;
        const price = typeof updated.unitPrice === 'number' ? updated.unitPrice : parseFloat(String(updated.unitPrice)) || 0;
        updated.quantity = qty;
        updated.unitPrice = price;
        updated.subtotal = roundMoney(qty * price);
        return updated;
      })
    );
  };

  const handleAddItem = (presetName = '') => {
    const newItem: ReceiptItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      name: presetName,
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleSelectStockProduct = (selected: SelectedStockItem) => {
    const qty = selected.quantity > 0 ? selected.quantity : 1;
    const price = selected.unitPrice || 0;
    const sub = roundMoney(qty * price);

    setItems((prev) => {
      // If the current list only has one empty item, replace it
      if (prev.length === 1 && prev[0].name.trim() === '' && (!prev[0].unitPrice || prev[0].unitPrice === 0)) {
        return [
          {
            id: prev[0].id,
            name: selected.name,
            quantity: qty,
            unitPrice: price,
            subtotal: sub,
          },
        ];
      }
      // Otherwise append as a new item
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: selected.name,
          quantity: qty,
          unitPrice: price,
          subtotal: sub,
        },
      ];
    });
    showToast(`Added "${selected.name}" from stock`);
  };

  const handleSelectMultipleStockProducts = (selectedList: SelectedStockItem[]) => {
    if (!selectedList || selectedList.length === 0) return;

    setItems((prev) => {
      const nonEmpties = prev.filter(
        (i) => i.name.trim() !== '' || (i.unitPrice && i.unitPrice > 0)
      );

      const newItems: ReceiptItem[] = selectedList.map((sel, idx) => {
        const qty = sel.quantity > 0 ? sel.quantity : 1;
        const price = sel.unitPrice || 0;
        return {
          id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          name: sel.name,
          quantity: qty,
          unitPrice: price,
          subtotal: roundMoney(qty * price),
        };
      });

      return [...nonEmpties, ...newItems];
    });
    showToast(`Added ${selectedList.length} items from stock`);
  };

  const handleScanBarcodeResult = ({
    scannedCode,
    matchedProduct,
  }: {
    scannedCode: string;
    matchedProduct?: import('../types').InventoryProduct;
  }) => {
    if (matchedProduct) {
      handleSelectStockProduct({
        name: matchedProduct.name,
        unitPrice: matchedProduct.sellingPrice || 0,
        quantity: 1,
        inventoryProductId: matchedProduct.id,
        itemId: matchedProduct.itemId,
      });
    } else if (scannedCode) {
      handleAddItem(`Barcode Item #${scannedCode}`);
      showToast(`Added item with barcode #${scannedCode}`);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([{ id: '1', name: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Build finalized Receipt object
  const buildReceiptObject = (): Receipt | null => {
    const validItems = items
      .filter((i) => i.name.trim() !== '' || Number(i.unitPrice) > 0)
      .map((item, idx) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity)) || 1;
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        return {
          id: item.id || `rec-item-${Date.now()}-${idx}`,
          name: item.name.trim() || `Item #${idx + 1}`,
          quantity: qty > 0 ? qty : 1,
          unitPrice: price,
          subtotal: roundMoney(qty * price),
        };
      });

    if (validItems.length === 0) {
      setErrorMessage('Please add at least one item.');
      return null;
    }

    setErrorMessage('');

    let createdAtIso: string;
    try {
      createdAtIso = new Date(receiptDate).toISOString();
    } catch {
      createdAtIso = new Date().toISOString();
    }

    const receipt: Receipt = {
      id: editingReceipt ? editingReceipt.id : `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      receiptNumber: receiptNumber.trim() || StorageService.generateReceiptNumber(),
      createdAt: createdAtIso,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerTaxNumber: customerTaxNumber.trim() || undefined,
      items: validItems,
      subtotal,
      discount: discountValue,
      discountType,
      discountAmount,
      total,
      amountPaid,
      balance,
      paymentStatus,
      paymentMethod,
      amountInWords: amountInWords.trim() || undefined,
      notes: notes.trim() || undefined,
      nonReturnable,
      nonRefundable,
      template: editingReceipt ? editingReceipt.template : defaultTemplate,
      accentColor: editingReceipt?.accentColor || business.accentColor,
      businessSnapshot: StorageService.getProfile() || business,
    };

    return receipt;
  };

  const handleSubmit = async (action: 'save' | 'download' | 'photo' | 'share' | 'preview') => {
    const receipt = buildReceiptObject();
    if (!receipt) return;

    setIsProcessing(true);

    try {
      // Cloud-first: Save to Cloudflare D1 first before showing in app
      const saveRes = await StorageService.saveReceiptAsync(receipt);
      if (!editingReceipt) {
        StorageService.advanceReceiptSequence();
        StorageService.clearDraft();
      }

      // Check if default thermal printer has auto-print enabled
      const defaultPrinter = StorageService.getSavedThermalPrinter();
      if (defaultPrinter && defaultPrinter.autoPrintOnSave) {
        BluetoothPrinterService.printReceipt(defaultPrinter, receipt).catch((err) => {
          console.warn('Auto thermal print note:', err);
        });
      }

      if (action === 'save') {
        showToast(
          `Receipt ${receipt.receiptNumber} has been saved successfully! You can find it anytime in Receipts & Invoices.`
        );
        AdMobService.showInterstitial('receipt_saved');
        if (onSaveOnly) {
          onSaveOnly(receipt);
        } else {
          onSaveAndPreview(receipt);
        }
      } else if (action === 'download') {
        AdMobService.showInterstitial('receipt_downloaded');
        if (onQuickDownload) {
          await onQuickDownload(receipt);
        } else {
          const res = await PdfGenerator.downloadPdf(receipt);
          showToast(res.message);
          setDownloadModalData({
            isOpen: true,
            fileName: res.filename,
            folderName: res.folder || 'Documents/Brivu',
            documentType: 'receipt',
            documentNumber: receipt.receiptNumber,
          });
          onSaveAndPreview(receipt);
        }
      } else if (action === 'photo') {
        AdMobService.showInterstitial('receipt_photo_saved');
        showToast('Generating photo...');
        const res = await PdfGenerator.downloadReceiptPhoto(receipt);
        showToast(res.message);
        setDownloadModalData({
          isOpen: true,
          fileName: res.filename,
          folderName: res.folder || 'Pictures/Brivu',
          documentType: 'receipt',
          documentNumber: receipt.receiptNumber,
        });
        onSaveAndPreview(receipt);
      } else if (action === 'share') {
        await onQuickShare(receipt);
      } else if (action === 'preview') {
        onSaveAndPreview(receipt);
      }
    } catch (err) {
      console.error('Receipt action error:', err);
      setErrorMessage('Action failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 pb-36 animate-fadeIn max-w-2xl mx-auto relative">
      {/* Toast Notification (Centered prominently so user sees it without scrolling) */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 pointer-events-none z-[99999] flex items-center justify-center p-4">
          <div className="pointer-events-auto max-w-sm sm:max-w-md w-auto px-5 py-3.5 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white text-xs sm:text-sm font-bold shadow-2xl border border-emerald-500/40 flex items-center gap-3 backdrop-blur-md animate-bounce">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="leading-snug">{toastMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Top Bar with back button */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-cancel-receipt"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back', business?.language)}</span>
        </button>

        <h1 className="text-base font-bold text-slate-900 dark:text-white">
          {editingReceipt ? t('edit_receipt', business?.language) : t('new_receipt', business?.language)}
        </h1>

        <div className="w-12 text-right">
          <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">
            {currency}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Header & Receipt Identity */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Receipt Number */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {t('receipt_no', business?.language)}
            </label>
            <div className="relative">
              <input
                id="input-receipt-number"
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="REC-01"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {t('date_and_time', business?.language)}
            </label>
            <div className="relative">
              <input
                id="input-receipt-date"
                type="datetime-local"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Client Details Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <Building2 className="w-4 h-4" />
            <span>{t('client_details', business?.language)}</span>
          </div>

          <button
            id="btn-add-client-from-list-receipt"
            type="button"
            onClick={() => setIsClientPickerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold transition active:scale-95 shadow-2xs cursor-pointer"
            title="Choose client from inventory list"
          >
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Add from list</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('customer_name', business?.language)}</span>
            </label>
            <input
              id="input-customer-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Acme Corp / John Doe"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <PhoneInputField
            id="input-customer-phone"
            label={t('customer_phone', business?.language)}
            value={customerPhone}
            onChange={(val) => setCustomerPhone(val)}
            language={business?.language}
            placeholder="700 000 000"
          />

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('customer_email', business?.language)}</span>
            </label>
            <input
              id="input-customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="billing@company.com"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('customer_address', business?.language)}</span>
            </label>
            <input
              id="input-customer-address"
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="e.g. Plot 10, Industrial Park"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t('tax_id', business?.language)}</span>
            </label>
            <input
              id="input-customer-tax"
              type="text"
              value={customerTaxNumber}
              onChange={(e) => setCustomerTaxNumber(e.target.value)}
              placeholder="e.g. TIN-1002938475"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* 2. Items Section */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('products_services', business?.language)}
            </h2>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
              {items.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-scan-barcode-receipt-top"
              type="button"
              onClick={() => setIsBarcodeScannerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold transition active:scale-95 shadow-2xs"
              title="Scan product barcode with camera"
            >
              <Scan className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('scan_item', business?.language)}</span>
            </button>

            <button
              id="btn-pick-stock-receipt-top"
              type="button"
              onClick={() => setIsStockPickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800 text-xs font-bold transition active:scale-95 shadow-2xs"
              title="Pick products from your Stock Inventory"
            >
              <Boxes className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>{t('from_stock', business?.language)}</span>
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2.5 pt-1">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2"
            >
              {/* Item Name Row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                    {t('item_no', business?.language)} #{formatNumber(index + 1, business?.language)}
                  </span>
                  <button
                    id={`btn-remove-item-${item.id}`}
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <label
                    htmlFor={`input-item-name-${item.id}`}
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{t('item_name', business?.language)}</span>
                      <span className="text-rose-500 font-bold text-xs">*</span>
                    </span>
                  </label>
                  <input
                    id={`input-item-name-${item.id}`}
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    placeholder={t('enter_product_name', business?.language)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Quantity, Unit Price, and Auto Subtotal */}
              <div className="grid grid-cols-12 gap-2 items-end">
                {/* Quantity */}
                <div className="col-span-3 sm:col-span-3">
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-0.5">
                    {t('qty', business?.language)}
                  </label>
                  <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleItemChange(item.id, 'quantity', Math.max(1, (Number(item.quantity) || 1) - 1))}
                      className="px-1 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs shrink-0 select-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.quantity === 0 ? '' : item.quantity}
                      onChange={(e) =>
                        handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      title={String(item.quantity || '')}
                      className={`w-full min-w-0 text-center py-1 font-bold text-slate-900 dark:text-white focus:outline-hidden transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        String(item.quantity || '').length >= 7
                          ? 'text-[8px] tracking-tighter px-0.5'
                          : String(item.quantity || '').length >= 5
                          ? 'text-[9.5px] tracking-tighter px-0.5'
                          : String(item.quantity || '').length >= 4
                          ? 'text-[10.5px] tracking-tight px-0.5'
                          : 'text-xs px-1'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleItemChange(item.id, 'quantity', (Number(item.quantity) || 0) + 1)}
                      className="px-1 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs shrink-0 select-none"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div className="col-span-5 sm:col-span-4">
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-0.5 truncate">
                    {t('unit_price', business?.language)} ({currency})
                  </label>
                  <input
                    id={`input-item-price-${item.id}`}
                    type="number"
                    min="0"
                    step="any"
                    value={item.unitPrice === 0 ? '' : item.unitPrice}
                    onChange={(e) =>
                      handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    title={String(item.unitPrice || '')}
                    className={`w-full min-w-0 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-1.5 ${
                      String(item.unitPrice || '').length >= 13
                        ? 'text-[8px] tracking-tighter px-0.5'
                        : String(item.unitPrice || '').length >= 10
                        ? 'text-[9px] tracking-tighter px-1'
                        : String(item.unitPrice || '').length >= 8
                        ? 'text-[10px] tracking-tight px-1'
                        : String(item.unitPrice || '').length >= 6
                        ? 'text-[11px] tracking-tight px-1.5'
                        : 'text-xs sm:text-sm px-2'
                    }`}
                  />
                </div>

                {/* Subtotal */}
                <div className="col-span-4 sm:col-span-5">
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-0.5 text-right">
                    {t('subtotal', business?.language)}
                  </label>
                  <div
                    className={`min-w-0 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-bold font-mono text-slate-900 dark:text-white text-right overflow-hidden whitespace-nowrap shadow-2xs transition-all ${
                      formatCurrency(item.subtotal || 0, currency).length >= 18
                        ? 'text-[8px] tracking-tighter px-0.5'
                        : formatCurrency(item.subtotal || 0, currency).length >= 15
                        ? 'text-[9px] tracking-tighter px-1'
                        : formatCurrency(item.subtotal || 0, currency).length >= 12
                        ? 'text-[10px] tracking-tight px-1'
                        : formatCurrency(item.subtotal || 0, currency).length >= 9
                        ? 'text-[11px] tracking-tight px-1.5'
                        : 'text-xs sm:text-sm px-2'
                    }`}
                    title={formatCurrency(item.subtotal || 0, currency)}
                  >
                    {formatCurrency(item.subtotal || 0, currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button: Add Item */}
        <button
          id="btn-add-item-bottom"
          type="button"
          onClick={() => handleAddItem()}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-600 dark:text-slate-300 hover:text-emerald-600 text-xs font-bold flex items-center justify-center gap-1.5 transition mt-1"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_item', business?.language)}</span>
        </button>
      </div>

      {/* 3. Totals & Payment */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
        {/* GRAND TOTAL BANNER */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-extrabold text-emerald-700 dark:text-emerald-400 tracking-wider">
              {t('total_amount_label', business?.language)}
            </span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatNumber(items.filter((i) => i.name.trim()).length, business?.language)} {t('items_included', business?.language)}
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="pt-2">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            {t('payment_method_label', business?.language)}
          </label>
          <div className="relative">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-hidden appearance-none"
            >
              {(['Cash', 'Mobile Money', 'Bank', 'Card', 'Check', 'Other'] as PaymentMethod[]).map((method) => {
                let methodLabel: string = method;
                if (method === 'Cash') methodLabel = t('cash', business?.language);
                else if (method === 'Mobile Money') methodLabel = t('mobile_money', business?.language);
                else if (method === 'Bank') methodLabel = t('bank_transfer', business?.language);
                else if (method === 'Card') methodLabel = t('card', business?.language);
                else if (method === 'Check') methodLabel = t('check', business?.language);
                else if (method === 'Other') methodLabel = t('other', business?.language);
                return (
                  <option key={method} value={method}>
                    {methodLabel}
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Amount Paid in Words */}
        <div className="pt-4">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
            {t('amount_in_words_opt', business?.language)}
          </label>
          <input
            id="input-amount-words"
            type="text"
            value={amountInWords}
            onChange={(e) => setAmountInWords(e.target.value)}
            placeholder={t('amount_in_words_placeholder', business?.language)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        {/* Amount Paid & Balance Section */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {t('amount_paid_numbers', business?.language)}
            </label>
            <div className="relative">
              <input
                id="input-amount-paid"
                type="number"
                min="0"
                step="any"
                value={amountPaidInput}
                onChange={(e) => setAmountPaidInput(e.target.value)}
                placeholder={`e.g. ${formatNumber(total, business?.language)}`}
                title={amountPaidInput}
                className={`w-full min-w-0 pl-3 pr-12 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  String(amountPaidInput || '').length >= 13
                    ? 'text-[8.5px] tracking-tighter'
                    : String(amountPaidInput || '').length >= 10
                    ? 'text-[9.5px] tracking-tighter'
                    : String(amountPaidInput || '').length >= 8
                    ? 'text-[11px] tracking-tight'
                    : 'text-xs'
                }`}
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                {currency}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {t('amount_paid_help', business?.language)} ({formatCurrency(total, currency)}).
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {t('balance_status', business?.language)}
            </label>
            <div className={`p-2.5 rounded-xl border flex flex-col justify-center h-[38px] ${
              balance < 0
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400'
                : balance > 0
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold leading-none">
                <span>
                  {balance < 0 ? t('balance_remained_due', business?.language) : balance > 0 ? t('change_to_return', business?.language) : t('fully_paid', business?.language)}
                </span>
                <span className="font-extrabold font-mono">
                  {formatCurrency(Math.abs(balance), currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Notes */}
        <div className="pt-2">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
            {t('notes_warranty_opt', business?.language)}
          </label>
          <textarea
            id="input-receipt-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notes_placeholder', business?.language)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
          />
        </div>
        
        {/* Terms & Disclaimers Toggles */}
        <div className="pt-2 pb-2 space-y-2">
          {/* Goods Non-Returnable Toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">{t('goods_non_returnable', business?.language)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{t('goods_non_returnable_sub', business?.language)}</div>
            </div>
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${nonReturnable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${nonReturnable ? 'translate-x-4.5' : 'translate-x-1'}`} />
              <input type="checkbox" id="toggle-goods-non-returnable" className="sr-only" checked={nonReturnable} onChange={(e) => setNonReturnable(e.target.checked)} />
            </div>
          </label>

          {/* Money Non-Refundable Toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">{t('money_non_refundable', business?.language)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{t('money_non_refundable_sub', business?.language)}</div>
            </div>
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${nonRefundable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${nonRefundable ? 'translate-x-4.5' : 'translate-x-1'}`} />
              <input type="checkbox" id="toggle-money-non-refundable" className="sr-only" checked={nonRefundable} onChange={(e) => setNonRefundable(e.target.checked)} />
            </div>
          </label>
        </div>
      </div>

      {/* 4. Action Buttons Fixed Bottom Floating Bar (Cancel, Save, Download, Share, Preview) */}
      <div className="fixed bottom-0 left-0 right-0 p-2.5 sm:p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl z-50">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Top Row: Back Button + Save Receipt Button */}
          <div className="flex items-center gap-2">
            <button
              id="btn-receipt-cancel"
              type="button"
              onClick={onCancel}
              className="p-2.5 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition shrink-0"
              title="Cancel & Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              id="btn-action-save"
              type="button"
              onClick={() => handleSubmit('save')}
              disabled={isProcessing}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 transition disabled:opacity-50"
              title="Save Receipt"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{t('save_receipt', business?.language)}</span>
            </button>
          </div>

          {/* Bottom Row: 4 Action Buttons Grid (PDF, Photo, Share, Preview) */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {/* Download PDF */}
            <button
              id="btn-action-download"
              type="button"
              onClick={() => handleSubmit('download')}
              disabled={isProcessing}
              className="py-2.5 px-1 sm:px-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs hover:bg-slate-700 active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="whitespace-nowrap">{t('pdf_format', business?.language)}</span>
            </button>

            {/* Save Photo */}
            <button
              id="btn-action-photo"
              type="button"
              onClick={() => handleSubmit('photo')}
              disabled={isProcessing}
              className="py-2.5 px-1 sm:px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold text-xs border border-emerald-300 dark:border-emerald-700 active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50"
              title="Save Receipt Photo (PNG)"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap">{t('photo', business?.language)}</span>
            </button>

            {/* Share */}
            <button
              id="btn-action-share"
              type="button"
              onClick={() => handleSubmit('share')}
              disabled={isProcessing}
              className="py-2.5 px-1 sm:px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-xs hover:opacity-95 active:scale-95 flex items-center justify-center gap-1 transition disabled:opacity-50"
              title="Generate & Share PDF"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t('share', business?.language)}</span>
            </button>

            {/* Preview */}
            <button
              id="btn-action-preview"
              type="button"
              onClick={() => handleSubmit('preview')}
              disabled={isProcessing}
              className="py-2.5 px-1 sm:px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1 disabled:opacity-50"
              title="Preview Receipt"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t('preview', business?.language)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stock Product Picker Modal */}
      <StockProductPickerModal
        isOpen={isStockPickerOpen}
        currency={currency}
        documentType="receipt"
        onClose={() => setIsStockPickerOpen(false)}
        onSelectProduct={handleSelectStockProduct}
        onSelectMultipleProducts={handleSelectMultipleStockProducts}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        currency={currency}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScanResult={handleScanBarcodeResult}
      />

      {/* Client Picker Modal */}
      <ClientPickerModal
        isOpen={isClientPickerOpen}
        onClose={() => setIsClientPickerOpen(false)}
        onSelectClient={handleSelectClient}
        language={business?.language}
      />

      <DownloadSuccessModal
        isOpen={downloadModalData.isOpen}
        onClose={() => setDownloadModalData({ isOpen: false })}
        fileName={downloadModalData.fileName}
        folderName={downloadModalData.folderName}
        documentType={downloadModalData.documentType}
        documentNumber={downloadModalData.documentNumber}
      />
    </div>
  );
};
