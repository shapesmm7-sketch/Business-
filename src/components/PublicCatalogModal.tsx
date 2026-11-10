import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe,
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  QrCode,
  Eye,
  EyeOff,
  Store,
  Layers,
  Sparkles,
  ShoppingBag,
  Phone,
  MessageCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { PublicCatalogSettings, InventoryProduct, BusinessProfile } from '../types';
import { StorageService } from '../services/storage';

interface PublicCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessProfile;
  products: InventoryProduct[];
  onProductsUpdated?: () => void;
}

export const PublicCatalogModal: React.FC<PublicCatalogModalProps> = ({
  isOpen,
  onClose,
  business,
  products,
  onProductsUpdated,
}) => {
  const [settings, setSettings] = useState<PublicCatalogSettings>(() =>
    StorageService.getPublicCatalogSettings()
  );
  const [slugInput, setSlugInput] = useState<string>(settings.slug);
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const s = StorageService.getPublicCatalogSettings();
      setSettings(s);
      setSlugInput(s.slug);
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const workerBase =
    (typeof window !== 'undefined' && window.location.origin.includes('workers.dev')
      ? window.location.origin
      : 'https://brivu.shapesmm7.workers.dev');

  const currentSlug = (settings.slug || StorageService.generateStoreSlug(business.name || 'store')).trim();
  const catalogUrl = `${workerBase.replace(/\/+$/, '')}/store/${currentSlug}`;
  const relativeStorePath = `/store/${currentSlug}`;

  const publicProductsCount = products.filter((p) => p.isPublicInCatalog !== false).length;
  const inStockPublicCount = products.filter(
    (p) => p.isPublicInCatalog !== false && p.quantity > 0
  ).length;

  const handleToggleCatalog = (newVal: boolean) => {
    const updated = StorageService.savePublicCatalogSettings({ enabled: newVal });
    setSettings(updated);
    showNotice(newVal ? 'Public catalog is now ONLINE' : 'Public catalog paused (OFFLINE)');
  };

  const handleSaveSlug = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = StorageService.generateStoreSlug(slugInput);
    if (!sanitized) return;
    const updated = StorageService.savePublicCatalogSettings({ slug: sanitized });
    setSettings(updated);
    setSlugInput(updated.slug);
    showNotice(`Store link updated to /store/${updated.slug}`);
  };

  const handleToggleExactQuantity = (newVal: boolean) => {
    const updated = StorageService.savePublicCatalogSettings({ showExactQuantity: newVal });
    setSettings(updated);
  };

  const handleToggleHideOutOfStock = (newVal: boolean) => {
    const updated = StorageService.savePublicCatalogSettings({ hideOutOfStock: newVal });
    setSettings(updated);
  };

  const handleToggleWhatsAppOrders = (newVal: boolean) => {
    const updated = StorageService.savePublicCatalogSettings({ allowWhatsAppOrders: newVal });
    setSettings(updated);
  };

  const handlePublishAll = (makePublic: boolean) => {
    StorageService.setAllProductsPublicCatalog(makePublic);
    onProductsUpdated?.();
    showNotice(makePublic ? 'All products are now public' : 'All products marked private');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(catalogUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showNotice('Store link copied to clipboard!');
    } catch {
      showNotice('Could not copy automatically. You can copy the link manually.');
    }
  };

  const handleOpenStore = () => {
    // Open in new tab or navigate
    if (typeof window !== 'undefined') {
      window.open(catalogUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello! Check out our current products and live stock catalog here: ${catalogUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleManualSync = async () => {
    setIsPublishing(true);
    try {
      const res = await StorageService.publishPublicCatalog();
      if (res.success) {
        showNotice('Catalog published to Cloud successfully!');
      } else {
        showNotice('Saved locally. Cloud sync will retry automatically.');
      }
    } catch {
      showNotice('Saved locally.');
    } finally {
      setIsPublishing(false);
    }
  };

  // QR code image URL for scanning
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    catalogUrl
  )}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-sky-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold truncate">Live Stock Catalog</h3>
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    settings.enabled
                      ? 'bg-emerald-400 text-slate-950 shadow-xs'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {settings.enabled ? '● Online' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-sky-100 truncate">
                Share a live public link of your available inventory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-fadeIn shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
          {/* Main Master Switch */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  settings.enabled
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  Public Store Catalog
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {settings.enabled
                    ? 'Customers can view your live stock via your store link'
                    : 'Catalog is hidden from public view'}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => handleToggleCatalog(!settings.enabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                settings.enabled
                  ? 'bg-emerald-500 justify-end'
                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md" />
            </button>
          </div>

          {/* Shareable Link Card */}
          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-sky-600" /> Your Live Catalog Link
              </span>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isPublishing}
                className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                title="Sync latest stock changes with cloud"
              >
                <RefreshCw className={`w-3 h-3 ${isPublishing ? 'animate-spin' : ''}`} />
                <span>{isPublishing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800/80 shadow-2xs">
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate flex-1 pl-1">
                {catalogUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-sky-600 hover:bg-sky-700 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleOpenStore}
                className="py-2 px-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-sky-100 dark:hover:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                <span>Open Store</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs"
              >
                <MessageCircle className="w-3.5 h-3.5 text-white" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className="py-2 px-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs"
              >
                <QrCode className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>{showQrCode ? 'Hide QR' : 'Show QR'}</span>
              </button>
            </div>

            {/* QR Code Section */}
            {showQrCode && (
              <div className="pt-2 text-center bg-white dark:bg-slate-900 rounded-xl p-3 border border-sky-100 dark:border-slate-800 animate-fadeIn space-y-2">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Customers can scan this QR code to open your store:
                </p>
                <div className="inline-block p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <img src={qrCodeUrl} alt="Store QR Code" className="w-36 h-36 mx-auto object-contain" />
                </div>
                <p className="text-[10px] text-slate-400">
                  Print or put this QR code on your flyers, counter stickers, or WhatsApp status.
                </p>
              </div>
            )}
          </div>

          {/* Business Slug Configuration */}
          <form onSubmit={handleSaveSlug} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                CUSTOM STORE LINK SLUG
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                /store/{settings.slug}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                  /store/
                </span>
                <input
                  type="text"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  placeholder="e.g. johns-electronics"
                  className="w-full pl-16 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs transition shrink-0 shadow-xs"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Only letters, numbers, and dashes (e.g. <code>{business.name ? StorageService.generateStoreSlug(business.name) : 'my-store'}</code>).
            </p>
          </form>

          {/* Publishing & Privacy Controls */}
          <div className="space-y-2.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              CATALOG PRIVACY & DISPLAY OPTIONS
            </span>

            {/* Toggle 1: Show Exact Quantity */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Show Exact Stock Quantity
                </h5>
                <p className="text-[10.5px] text-slate-400">
                  {settings.showExactQuantity
                    ? 'Customers see number of units (e.g. "18 units in stock")'
                    : 'Shows status only: In Stock, Low Stock, or Out of Stock'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showExactQuantity}
                onClick={() => handleToggleExactQuantity(!settings.showExactQuantity)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                  settings.showExactQuantity
                    ? 'bg-sky-600 justify-end'
                    : 'bg-slate-300 dark:bg-slate-600 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md" />
              </button>
            </div>

            {/* Toggle 2: Hide Out of Stock Products */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Hide Out of Stock Items
                </h5>
                <p className="text-[10.5px] text-slate-400">
                  {settings.hideOutOfStock
                    ? 'Items with 0 quantity are hidden completely'
                    : 'Items with 0 quantity are shown with red "Out of Stock" badge'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.hideOutOfStock}
                onClick={() => handleToggleHideOutOfStock(!settings.hideOutOfStock)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                  settings.hideOutOfStock
                    ? 'bg-sky-600 justify-end'
                    : 'bg-slate-300 dark:bg-slate-600 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md" />
              </button>
            </div>

            {/* Toggle 3: WhatsApp Ordering */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Allow WhatsApp Orders & Inquiries
                </h5>
                <p className="text-[10.5px] text-slate-400">
                  Adds a prominent "Order / Inquire via WhatsApp" button to every product card
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.allowWhatsAppOrders}
                onClick={() => handleToggleWhatsAppOrders(!settings.allowWhatsAppOrders)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                  settings.allowWhatsAppOrders
                    ? 'bg-emerald-600 justify-end'
                    : 'bg-slate-300 dark:bg-slate-600 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md" />
              </button>
            </div>
          </div>

          {/* Product Publishing Summary & Batch Controls */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Product Visibility
                </h5>
                <p className="text-[11px] text-slate-500">
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    {publicProductsCount} of {products.length}
                  </span>{' '}
                  products published online ({inStockPublicCount} in stock)
                </p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePublishAll(true)}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-[10px] font-bold border border-sky-200/60 dark:border-sky-800 transition"
                >
                  Publish All
                </button>
                <button
                  type="button"
                  onClick={() => handlePublishAll(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 text-[10px] font-bold transition"
                >
                  Hide All
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
              🔒 <strong>Strict Privacy Guarantee:</strong> Costs, profits, tax details, and internal notes are never included in the public catalog.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <button
            type="button"
            onClick={handleOpenStore}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Preview Customer Store</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
