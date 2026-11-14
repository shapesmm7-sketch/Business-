import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Phone,
  MessageCircle,
  MapPin,
  Mail,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  X,
  Share2,
  Check,
  Tag,
  Store,
  Layers,
  ArrowLeft,
  Sparkles,
  Info,
  Clock,
} from 'lucide-react';
import {
  PublicCatalogPayload,
  PublicCatalogProduct,
  PublicCatalogSettings,
  BusinessProfile,
} from '../types';
import { StorageService } from '../services/storage';
import { CloudflareService } from '../services/cloudflareService';
import { Browser } from '@capacitor/browser';

interface StoreCatalogScreenProps {
  slug?: string | null;
  isMerchantPreview?: boolean;
  onNavigateHome?: () => void;
}

function getStoreEmailFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get('email') ||
    params.get('u') ||
    params.get('user') ||
    params.get('user_id') ||
    (window as any).__OWNER_EMAIL__ ||
    '';
  const clean = String(raw || '').toLowerCase().trim();
  return clean && clean.includes('@') && !clean.startsWith('brivu-usr-') ? clean : '';
}

function isStoreUrlContext(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname || '';
  const hash = window.location.hash || '';
  return Boolean(
    pathname.includes('/store/') ||
    pathname === '/store' ||
    pathname.endsWith('/store') ||
    params.has('store') ||
    hash.includes('/store/') ||
    hash.startsWith('#/store')
  );
}

function buildPublicCatalogFromBackupData(
  bData: any,
  targetSlug: string,
  ownerEmail: string
): PublicCatalogPayload | null {
  if (!bData || typeof bData !== 'object') return null;
  const rawProducts = Array.isArray(bData.inventoryProducts)
    ? bData.inventoryProducts
    : Array.isArray(bData.products)
    ? bData.products
    : [];
  const profile = bData.profile || {};
  const savedSettings = bData.publicCatalogSettings || {};
  const categories = Array.isArray(bData.productCategories) ? bData.productCategories : [];

  const settings: PublicCatalogSettings = {
    enabled: savedSettings.enabled !== false,
    slug: targetSlug || savedSettings.slug || 'store',
    businessName: savedSettings.businessName || profile.name || '',
    tagline: savedSettings.tagline || profile.description || '',
    phone: savedSettings.phone || profile.phone || '',
    whatsapp: savedSettings.whatsapp || profile.whatsapp || profile.phone || '',
    email: ownerEmail || savedSettings.email || profile.email || '',
    address: savedSettings.address || profile.address || '',
    currency: savedSettings.currency || profile.currency || 'UGX',
    showExactQuantity: savedSettings.showExactQuantity !== false,
    hideOutOfStock: savedSettings.hideOutOfStock === true,
    allowWhatsAppOrders: savedSettings.allowWhatsAppOrders !== false,
    updatedAt: savedSettings.updatedAt || bData.exportedAt || new Date().toISOString(),
  };

  const publicProducts = rawProducts.filter((p: any) => p && p.isPublicInCatalog !== false);
  const visibleProducts = settings.hideOutOfStock
    ? publicProducts.filter((p: any) => Number(p.quantity ?? p.stockQuantity ?? 0) > 0)
    : publicProducts;

  const categoryMap = new Map<string, any>(categories.map((c: any) => [c.id, c]));

  const catalogProducts: PublicCatalogProduct[] = visibleProducts.map((p: any) => {
    const qty = Number(p.quantity ?? p.stockQuantity ?? 0);
    const cat = p.categoryId ? categoryMap.get(p.categoryId) : undefined;
    const isAvailable = qty > 0;
    const status: 'in-stock' | 'low-stock' | 'out-of-stock' =
      qty === 0 ? 'out-of-stock' : qty < 5 ? 'low-stock' : 'in-stock';

    return {
      id: p.id,
      itemId: p.itemId || '',
      name: p.name || 'Unnamed Product',
      description: p.description,
      image: p.image,
      sizes: Array.isArray(p.sizes) ? p.sizes : undefined,
      color: p.color,
      quantity: qty,
      unit: p.unit,
      sellingPrice: Number(p.sellingPrice ?? p.price ?? 0),
      categoryId: p.categoryId,
      categoryName: cat?.name || p.category,
      categoryColor: cat?.color,
      isAvailable,
      status,
    };
  });

  const categoryCounts = categories.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    count: catalogProducts.filter((cp) => cp.categoryId === cat.id).length,
  }));

  if (catalogProducts.length === 0 && !profile.name) {
    return null;
  }

  return {
    settings,
    business: {
      name: profile.name || settings.businessName || 'Brivu Store',
      description: profile.description || settings.tagline || '',
      logo: profile.logo,
      phone: profile.phone || settings.phone || '',
      whatsapp: profile.whatsapp || profile.phone || settings.whatsapp || '',
      email: ownerEmail || profile.email || settings.email || '',
      address: profile.address || settings.address || '',
      currency: profile.currency || settings.currency || 'UGX',
    },
    categories: categoryCounts,
    products: catalogProducts,
    lastUpdated: new Date().toISOString(),
  };
}

function isSsrCatalogValidForRequest(ssr: any, emailFromUrl: string): ssr is PublicCatalogPayload {
  if (!ssr || typeof ssr !== 'object') return false;
  const ssrEmail = String(ssr.settings?.email || ssr.business?.email || '').toLowerCase().trim();
  if (emailFromUrl && ssrEmail && ssrEmail !== emailFromUrl) return false;
  const hasProducts = Array.isArray(ssr.products) && ssr.products.length > 0;
  const hasRealBiz = Boolean(ssr.business?.name && ssr.business.name !== 'Brivu Store');
  return hasProducts || hasRealBiz;
}

export const StoreCatalogScreen: React.FC<StoreCatalogScreenProps> = ({
  slug,
  isMerchantPreview = false,
  onNavigateHome,
}) => {
  const emailFromUrl = useMemo(() => getStoreEmailFromLocation(), []);
  const externalStoreContext = useMemo(() => isStoreUrlContext(), []);

  const [catalog, setCatalog] = useState<PublicCatalogPayload | null>(() => {
    if (typeof window !== 'undefined') {
      const ssr = (window as any).__INITIAL_STORE_CATALOG__;
      if (isSsrCatalogValidForRequest(ssr, getStoreEmailFromLocation())) {
        return ssr;
      }
    }
    if (isMerchantPreview && !isStoreUrlContext()) {
      const localSettings = StorageService.getPublicCatalogSettings();
      return StorageService.getPublicCatalogPayload(slug || localSettings.slug);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!catalog);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<PublicCatalogProduct | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const localSettings = StorageService.getPublicCatalogSettings();
    const targetSlug = (slug || localSettings.slug || 'store').trim().toLowerCase() || 'store';
    const urlEmail = getStoreEmailFromLocation();

    // Pure in-app owner preview (not opened from external /store/... URL)
    if (isMerchantPreview && !externalStoreContext && !urlEmail) {
      setCatalog(StorageService.getPublicCatalogPayload(targetSlug));
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const initialSsr =
      typeof window !== 'undefined' &&
      isSsrCatalogValidForRequest((window as any).__INITIAL_STORE_CATALOG__, urlEmail)
        ? ((window as any).__INITIAL_STORE_CATALOG__ as PublicCatalogPayload)
        : null;

    if (!initialSsr) {
      setIsLoading(true);
    }
    setError(null);

    const resolveRemoteCatalog = async () => {
      try {
        const res = await CloudflareService.fetchPublicStoreCatalog(targetSlug, urlEmail || undefined);
        if (!isMounted) return;
        if (res.success && res.data && (Array.isArray(res.data.products) || res.data.business)) {
          const fetchedProducts = Array.isArray(res.data.products) ? res.data.products : [];
          if (fetchedProducts.length > 0 || !urlEmail) {
            setCatalog(res.data);
            setIsLoading(false);
            return;
          }
        }

        // Backup recovery by user email ID (matching how QR links recover from cloud backup)
        if (urlEmail) {
          const bData = await CloudflareService.fetchUserBackupData(urlEmail);
          if (!isMounted) return;
          const backupCatalog = buildPublicCatalogFromBackupData(bData, targetSlug, urlEmail);
          if (backupCatalog) {
            setCatalog(backupCatalog);
            setIsLoading(false);
            return;
          }
          if (res.success && res.data) {
            setCatalog(res.data);
            setIsLoading(false);
            return;
          }
        }

        if (initialSsr) {
          setCatalog(initialSsr);
          setIsLoading(false);
          return;
        }

        // Owner device fallback only when URL has no conflicting email
        const signedInEmail = StorageService.resolveStoreOwnerEmail();
        if (!urlEmail || (signedInEmail && signedInEmail === urlEmail)) {
          const localPayload = StorageService.getPublicCatalogPayload(targetSlug);
          if (localPayload && (localPayload.products.length > 0 || localPayload.business.name !== 'Brivu Store')) {
            setCatalog(localPayload);
            setIsLoading(false);
            return;
          }
        }

        setError(`Store "${targetSlug}" is currently not available.`);
      } catch (err: any) {
        if (!isMounted) return;
        if (initialSsr) {
          setCatalog(initialSsr);
        } else {
          const signedInEmail = StorageService.resolveStoreOwnerEmail();
          const localPayload =
            !urlEmail || (signedInEmail && signedInEmail === urlEmail)
              ? StorageService.getPublicCatalogPayload(targetSlug)
              : null;
          if (localPayload && localPayload.products.length > 0) {
            setCatalog(localPayload);
          } else {
            setError(err?.message || 'Unable to load store catalog');
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    resolveRemoteCatalog();

    return () => {
      isMounted = false;
    };
  }, [slug, emailFromUrl, isMerchantPreview, externalStoreContext]);

  const business = catalog?.business || {
    name: 'Brivu Store',
    currency: 'UGX',
  };
  const settings = catalog?.settings || {
    enabled: true,
    slug: slug || 'store',
    showExactQuantity: true,
    hideOutOfStock: false,
    allowWhatsAppOrders: true,
  };
  const categories = catalog?.categories || [];
  const rawProducts = catalog?.products || [];

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return rawProducts.filter((p) => {
      // Category filter
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }

      // Hide out-of-stock if configured
      if (settings.hideOutOfStock && p.quantity <= 0) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCat = p.categoryName && p.categoryName.toLowerCase().includes(q);
      const matchColor = p.color && p.color.toLowerCase().includes(q);
      const matchSizes = p.sizes && p.sizes.some((s) => s.toLowerCase().includes(q));
      return Boolean(matchName || matchCat || matchColor || matchSizes);
    });
  }, [rawProducts, selectedCategoryId, searchQuery, settings.hideOutOfStock]);

  const formatPrice = (amount: number) => {
    const cur = business.currency || 'UGX';
    return `${cur} ${amount.toLocaleString()}`;
  };

  const openExternalLink = async (targetUrl: string) => {
    try {
      const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
      if (isNative) {
        await Browser.open({ url: targetUrl });
        return;
      }
    } catch (_) {}
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleWhatsAppInquiry = (product?: PublicCatalogProduct) => {
    const phone = business.whatsapp || business.phone;
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    let text = `Hello *${business.name}*!`;
    if (product) {
      text += ` I am interested in ordering *${product.name}* (${formatPrice(product.sellingPrice)}).`;
      if (product.sizes && product.sizes.length > 0) {
        text += ` Available sizes: ${product.sizes.join(', ')}.`;
      }
      text += ` Is this item currently in stock?`;
    } else {
      text += ` I am browsing your online catalog and would like to make an inquiry.`;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    openExternalLink(waUrl);
  };

  const handleShareCatalog = async () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${business.name} | Live Catalog`,
          text: `Check out available products and live stock at ${business.name}!`,
          url: currentUrl,
        });
      } else {
        await navigator.clipboard.writeText(currentUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // Fallback copy
      try {
        await navigator.clipboard.writeText(currentUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } catch (_) {}
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-sky-600/10 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 animate-bounce">
          <Store className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
          Loading Live Catalog...
        </h3>
        <p className="text-xs text-slate-400 mt-1">Connecting to live inventory</p>
      </div>
    );
  }

  // Error State
  if (error || !catalog) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">Store Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
          {error || 'The requested catalog link is either inactive or does not exist.'}
        </p>
        {isMerchantPreview && onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="mt-6 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition"
          >
            Return to App
          </button>
        )}
      </div>
    );
  }

  // Paused / Offline State
  if (settings.enabled === false) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">
          {business.name} is Currently Closed
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
          The public product catalog is temporarily offline. Please check back later or contact the business directly.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Business</span>
            </a>
          )}
          {(business.whatsapp || business.phone) && (
            <button
              type="button"
              onClick={() => handleWhatsAppInquiry()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Message on WhatsApp</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-white pb-20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="max-w-3xl mx-auto px-3.5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {business.logo ? (
              <img
                src={business.logo}
                alt={business.name}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {business.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                {business.name}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Inventory</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isMerchantPreview && onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition"
              >
                Owner View
              </button>
            )}
            <button
              type="button"
              onClick={handleShareCatalog}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              title="Share store link"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Business Banner & Contact Info */}
      <section className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-3">
          {business.description && (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {business.description}
            </p>
          )}

          {/* Quick Contact & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(business.whatsapp || business.phone) && (
              <button
                type="button"
                onClick={() => handleWhatsAppInquiry()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5 text-white" />
                <span>Chat on WhatsApp</span>
              </button>
            )}

            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
              >
                <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{business.phone}</span>
              </a>
            )}

            {business.address && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 px-2 py-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{business.address}</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name, size, or color..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white shadow-2xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Visual Category Filter Bar (Inspired by Jiji rounded category cards) */}
        {categories.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Categories
              </span>
              <span className="text-[10px] text-slate-400">
                {rawProducts.length} items available
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  selectedCategoryId === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>All Products</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategoryId === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {rawProducts.length}
                </span>
              </button>

              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                    style={{
                      backgroundColor: isSelected ? cat.color || '#0284c7' : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#ffffff' : cat.color || '#64748b',
                      }}
                    />
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-Column Product Grid (Mobile First) */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
            {filteredProducts.map((prod) => {
              const isOutOfStock = prod.quantity === 0;
              const isLowStock = prod.quantity > 0 && prod.quantity < 5;

              return (
                <div
                  key={prod.id}
                  onClick={() => setSelectedProduct(prod)}
                  className="group bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
                >
                  {/* Photo Section */}
                  <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                    {prod.image ? (
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-slate-400 bg-gradient-to-br from-slate-100 to-sky-50 dark:from-slate-800 dark:to-slate-900">
                        <ShoppingBag className="w-8 h-8 text-sky-400/80 mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          #{prod.itemId}
                        </span>
                      </div>
                    )}

                    {/* Stock status badge overlay */}
                    <div className="absolute top-2 right-2">
                      <span
                        className={`text-[9.5px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 ${
                          isOutOfStock
                            ? 'bg-rose-500 text-white'
                            : isLowStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        {isOutOfStock ? (
                          'Out of Stock'
                        ) : isLowStock ? (
                          settings.showExactQuantity ? (
                            `Only ${prod.quantity} left`
                          ) : (
                            'Low Stock'
                          )
                        ) : settings.showExactQuantity ? (
                          `${prod.quantity} in stock`
                        ) : (
                          'In Stock'
                        )}
                      </span>
                    </div>

                    {/* Category overlay */}
                    {prod.categoryName && (
                      <div className="absolute bottom-2 left-2 max-w-[85%]">
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white truncate shadow-2xs block"
                          style={{
                            backgroundColor: prod.categoryColor || '#475569',
                          }}
                        >
                          {prod.categoryName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Details */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {prod.name}
                      </h3>

                      {/* Sizes and Color tags */}
                      <div className="flex flex-wrap items-center gap-1">
                        {prod.sizes && prod.sizes.length > 0 && (
                          <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            Sizes: {prod.sizes.join(', ')}
                          </span>
                        )}
                        {prod.color && (
                          <span className="text-[9.5px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded">
                            {prod.color}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price and Action */}
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">
                          Price
                        </span>
                        <span className="text-xs sm:text-sm font-black text-sky-700 dark:text-sky-400 font-mono">
                          {formatPrice(prod.sellingPrice)}
                        </span>
                      </div>

                      {settings.allowWhatsAppOrders && (business.whatsapp || business.phone) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWhatsAppInquiry(prod);
                          }}
                          className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/80 dark:hover:bg-emerald-600 dark:text-emerald-300 transition shrink-0"
                          title="Order via WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">
                No products found
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {searchQuery
                  ? `No items match "${searchQuery}". Try a different keyword.`
                  : 'Check back soon for new stock arrivals!'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-1.5 rounded-xl bg-sky-600 text-white font-bold text-xs"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close Button */}
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Product Photo */}
            <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
              {selectedProduct.image ? (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <ShoppingBag className="w-16 h-16 text-sky-400 mb-2" />
                  <span className="text-xs font-mono font-bold">#{selectedProduct.itemId}</span>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {selectedProduct.categoryName && (
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-md text-white"
                      style={{
                        backgroundColor: selectedProduct.categoryColor || '#475569',
                      }}
                    >
                      {selectedProduct.categoryName}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      selectedProduct.quantity === 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : selectedProduct.quantity < 5
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {selectedProduct.quantity === 0
                      ? 'Out of Stock'
                      : settings.showExactQuantity
                      ? `${selectedProduct.quantity} units available`
                      : 'In Stock'}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  {selectedProduct.name}
                </h2>

                <div className="mt-1 text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                  {formatPrice(selectedProduct.sellingPrice)}
                </div>
              </div>

              {/* Sizes Available */}
              {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Available Sizes
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.sizes.map((sz) => (
                      <span
                        key={sz}
                        className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      >
                        {sz}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Available */}
              {selectedProduct.color && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Color
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 inline-block">
                    {selectedProduct.color}
                  </span>
                </div>
              )}

              {/* Product Description */}
              {selectedProduct.description && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Product Description
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {/* Business Contact & Order Button */}
              <div className="pt-2 space-y-2">
                {(business.whatsapp || business.phone) && (
                  <button
                    type="button"
                    onClick={() => handleWhatsAppInquiry(selectedProduct)}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.99] transition"
                  >
                    <MessageCircle className="w-4 h-4 text-white" />
                    <span>Inquire / Order via WhatsApp</span>
                  </button>
                )}

                {business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-sky-600" />
                    <span>Call Store: {business.phone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="mt-8 text-center text-slate-400 text-[11px] space-y-1 pb-6">
        <p>
          Powered by <strong className="text-slate-600 dark:text-slate-300">Brivu</strong> • Live Stock Catalog
        </p>
        <p className="text-[10px] text-slate-400">
          Real-time inventory updates for customers
        </p>
      </footer>
    </div>
  );
};
