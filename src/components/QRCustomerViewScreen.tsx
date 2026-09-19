import React, { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Wifi,
  Search,
  Share2,
  ChevronLeft,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  Flame,
  Leaf,
  Star,
  Plus,
  Minus,
  X,
  Send,
  Camera,
  Utensils,
  Info,
  Check,
  Tag,
  BadgePercent,
  Calendar,
} from 'lucide-react';
import { QRCodeHostedPage, QRMenuItem, QRBusinessPhoto } from '../types';
import { shareContent } from '../services/fileSaver';

interface QRCustomerViewScreenProps {
  page: QRCodeHostedPage;
  onBackToApp?: () => void;
  isMerchantPreview?: boolean;
  initialTab?: 'menu' | 'photos' | 'about';
  initialItemId?: string;
  initialPhotoId?: string;
}

interface TrayItem {
  item: QRMenuItem;
  quantity: number;
}

export const QRCustomerViewScreen: React.FC<QRCustomerViewScreenProps> = ({
  page,
  onBackToApp,
  isMerchantPreview = false,
  initialTab,
  initialItemId,
  initialPhotoId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'menu' | 'photos' | 'about'>(() => {
    if (initialPhotoId) return 'photos';
    if (initialItemId) return 'menu';
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('photo') || params.get('photoId')) return 'photos';
      if (params.get('item') || params.get('itemId')) return 'menu';
      const tabParam = params.get('tab');
      if (tabParam === 'photos' || tabParam === 'gallery') return 'photos';
      if (tabParam === 'about' || tabParam === 'info') return 'about';
      if (tabParam === 'menu' || tabParam === 'items') return 'menu';
    }
    return 'menu';
  });

  const [selectedPhoto, setSelectedPhoto] = useState<QRBusinessPhoto | null>(() => {
    if (initialPhotoId) {
      return page.photos.find((p) => p.id === initialPhotoId) || null;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const photoIdParam = params.get('photo') || params.get('photoId');
      if (photoIdParam) {
        return page.photos.find((p) => p.id === photoIdParam) || null;
      }
    }
    return null;
  });

  const [selectedItemModal, setSelectedItemModal] = useState<QRMenuItem | null>(() => {
    if (initialItemId) {
      return page.menuItems.find((i) => i.id === initialItemId) || null;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const itemIdParam = params.get('item') || params.get('itemId');
      if (itemIdParam) {
        return page.menuItems.find((i) => i.id === itemIdParam) || null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (initialItemId) {
      const found = page.menuItems.find((i) => i.id === initialItemId);
      if (found) {
        setActiveTab('menu');
        setSelectedItemModal(found);
      }
    } else if (initialPhotoId) {
      const found = page.photos.find((p) => p.id === initialPhotoId);
      if (found) {
        setActiveTab('photos');
        setSelectedPhoto(found);
      }
    } else if (initialTab) {
      setActiveTab(initialTab);
    } else if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const itemIdParam = params.get('item') || params.get('itemId');
      const photoIdParam = params.get('photo') || params.get('photoId');
      if (itemIdParam) {
        const found = page.menuItems.find((i) => i.id === itemIdParam);
        if (found) {
          setActiveTab('menu');
          setSelectedItemModal(found);
        }
      } else if (photoIdParam) {
        const found = page.photos.find((p) => p.id === photoIdParam);
        if (found) {
          setActiveTab('photos');
          setSelectedPhoto(found);
        }
      } else {
        const tabParam = params.get('tab');
        if (tabParam === 'photos' || tabParam === 'gallery') {
          setActiveTab('photos');
        } else if (tabParam === 'about' || tabParam === 'info') {
          setActiveTab('about');
        } else if (tabParam === 'menu' || tabParam === 'items') {
          setActiveTab('menu');
        }
      }
    }
  }, [initialTab, initialItemId, initialPhotoId, page.id, page.menuItems, page.photos]);
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);
  const [showOrderTrayModal, setShowOrderTrayModal] = useState<boolean>(false);
  const [tableNumber, setTableNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [trayItems, setTrayItems] = useState<Record<string, TrayItem>>({});
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedWifi, setCopiedWifi] = useState<boolean>(false);

  // Check if promo is currently active based on date range
  const isItemPromoActive = (item: QRMenuItem): boolean => {
    if (!item.hasPromo) return false;
    const today = new Date().toISOString().split('T')[0];
    if (item.promoStartDate && item.promoStartDate > today) return false;
    if (item.promoEndDate && item.promoEndDate < today) return false;
    return true;
  };

  const getItemEffectivePrice = (item: QRMenuItem): number => {
    if (isItemPromoActive(item) && item.promoPrice !== undefined && item.promoPrice > 0) {
      return item.promoPrice;
    }
    return item.price;
  };

  // Filter menu items
  const filteredItems = useMemo(() => {
    return page.menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [page.menuItems, selectedCategory, searchQuery]);

  // Total in tray
  const trayList = useMemo(() => Object.values(trayItems) as TrayItem[], [trayItems]);
  const totalTrayCount = useMemo(() => trayList.reduce((sum, i) => sum + i.quantity, 0), [trayList]);
  const totalTrayPrice = useMemo(
    () => trayList.reduce((sum, i) => sum + i.quantity * getItemEffectivePrice(i.item), 0),
    [trayList]
  );

  const handleAddToCart = (item: QRMenuItem) => {
    setTrayItems((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: { ...existing, quantity: existing.quantity + 1 },
        };
      }
      return {
        ...prev,
        [item.id]: { item, quantity: 1 },
      };
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setTrayItems((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  const handleShareMenu = async () => {
    const url = window.location.href;
    const res = await shareContent({
      title: page.title,
      text: page.tagline || `Check out ${page.title} digital items & showcase!`,
      url,
      dialogTitle: 'Share Menu',
    });

    if (res.method === 'clipboard_copy') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSendWhatsAppOrder = () => {
    if (!page.whatsapp && !page.phone) {
      alert('No business WhatsApp number configured for this page.');
      return;
    }

    const cleanNumber = (page.whatsapp || page.phone || '').replace(/[^0-9]/g, '');
    let orderMsg = `👋 Hello *${page.title}*,\nI would like to place an order for the following items:\n\n`;

    if (tableNumber.trim()) {
      orderMsg += `📍 *Table / Room Number:* ${tableNumber.trim()}\n`;
    }
    if (customerName.trim()) {
      orderMsg += `👤 *Customer:* ${customerName.trim()}\n`;
    }
    orderMsg += `\n*Order Details:*\n`;

    trayList.forEach((t) => {
      const effPrice = getItemEffectivePrice(t.item);
      const isPromo = isItemPromoActive(t.item) && t.item.promoPrice !== undefined && t.item.promoPrice > 0;
      orderMsg += `• ${t.quantity}x ${t.item.name}${isPromo ? ' (🔥 PROMO)' : ''} (${page.currency} ${(t.quantity * effPrice).toLocaleString()})\n`;
    });

    orderMsg += `\n*Total:* ${page.currency} ${totalTrayPrice.toLocaleString()}\n`;
    orderMsg += `\nThank you!`;

    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(orderMsg)}`;
    window.open(waUrl, '_blank');
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add('All');
    (page.menuCategories || []).forEach((c) => {
      if (c && c.trim() && c.trim() !== 'All') {
        set.add(c.trim());
      }
    });
    (page.menuItems || []).forEach((i) => {
      if (i.category && i.category.trim()) {
        set.add(i.category.trim());
      }
    });
    return Array.from(set);
  }, [page.menuCategories, page.menuItems]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-24">
      {/* Merchant preview top bar */}
      {isMerchantPreview && (
        <div className="bg-emerald-700 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>Customer View Mode (Live Preview)</span>
          </div>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white font-bold transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Editor</span>
            </button>
          )}
        </div>
      )}

      {/* Hero Header */}
      <div className="relative w-full overflow-hidden bg-slate-900 text-white">
        {page.coverImage ? (
          <div className="absolute inset-0 z-0">
            <img
              src={page.coverImage}
              alt={page.title}
              className="w-full h-full object-cover opacity-35"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 opacity-95">
            <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
          </div>
        )}

        <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6 pb-6 sm:pt-8 sm:pb-8">
          {/* Top Actions: Share, Wifi, Back */}
          <div className="flex items-center justify-between mb-4">
            {onBackToApp ? (
              <button
                onClick={onBackToApp}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition active:scale-95"
                title="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold backdrop-blur-md border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verified QR Items</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {(page.wifiName || page.wifiPassword) && (
                <button
                  type="button"
                  onClick={() => setShowWifiModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition active:scale-95"
                >
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WiFi</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareMenu}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{copiedLink ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* Business Logo & Titles */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            {page.logo ? (
              <img
                src={page.logo}
                alt={page.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl bg-slate-800 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-2xl font-black shadow-xl border-2 border-white/20 shrink-0">
                {page.title.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                {page.title}
              </h1>
              {page.tagline && (
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 line-clamp-2 leading-relaxed">
                  {page.tagline}
                </p>
              )}

              {/* Status Badge & Hours */}
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Open for Guests
                </span>
                {page.openingHours && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{page.openingHours}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Contact Buttons Bar */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/10">
            {page.phone && (
              <a
                href={`tel:${page.phone}`}
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition active:scale-98 text-center"
              >
                <Phone className="w-4 h-4 mb-1 text-emerald-400" />
                <span className="truncate w-full text-[11px]">Call Venue</span>
              </a>
            )}

            {page.whatsapp && (
              <a
                href={`https://wa.me/${page.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition active:scale-98 text-center"
              >
                <MessageCircle className="w-4 h-4 mb-1 text-emerald-400" />
                <span className="truncate w-full text-[11px]">WhatsApp</span>
              </a>
            )}

            {page.address && (
              <a
                href={page.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(page.address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition active:scale-98 text-center"
              >
                <MapPin className="w-4 h-4 mb-1 text-emerald-400" />
                <span className="truncate w-full text-[11px]">Directions</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Announcement Banner */}
      {page.announcement && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="flex-1">{page.announcement}</p>
        </div>
      )}

      {/* Nav Tabs: Menu | Photos & Ambience | About & Info */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <div className="flex gap-4 sm:gap-6">
            <button
              onClick={() => setActiveTab('menu')}
              className={`py-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === 'menu'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Items</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                {page.menuItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('photos')}
              className={`py-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === 'photos'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Gallery & Photos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                {page.photos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`py-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === 'about'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>About & Venue</span>
            </button>
          </div>

          {/* Quick tray trigger */}
          {page.allowWhatsAppOrdering && totalTrayCount > 0 && (
            <button
              onClick={() => setShowOrderTrayModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs active:scale-95 transition"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Tray ({totalTrayCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content Container */}
      <div className="max-w-2xl mx-auto px-4 pt-4 flex-1 w-full">
        {/* TAB 1: DIGITAL MENU */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search items, products, or specials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Menu Items List */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <Utensils className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No items found</p>
                <p className="text-xs text-slate-400 mt-0.5">Try searching for a different item or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredItems.map((item) => {
                  const inTray = trayItems[item.id]?.quantity || 0;
                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex gap-3.5"
                    >
                      {/* Optional Item Photo */}
                      {item.photoUrl ? (
                        <div
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 cursor-pointer"
                          onClick={() => setSelectedItemModal(item)}
                          title="View full details and photo"
                        >
                          <img
                            src={item.photoUrl}
                            alt={item.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : null}

                      {/* Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                              onClick={() => setSelectedItemModal(item)}
                              title="View full details"
                            >
                              {item.name}
                            </h3>
                            <div className="flex flex-col items-end shrink-0">
                              {isItemPromoActive(item) && item.promoPrice !== undefined && item.promoPrice > 0 ? (
                                <>
                                  <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 leading-tight">
                                    {page.currency} {item.promoPrice.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] sm:text-[11px] line-through text-slate-400 font-medium">
                                    {page.currency} {item.price.toLocaleString()}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {page.currency} {item.price.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tags & Promo Badge */}
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {isItemPromoActive(item) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                                <BadgePercent className="w-2.5 h-2.5" />
                                <span>Promo{item.promoEndDate ? ` to ${item.promoEndDate}` : ''}</span>
                              </span>
                            )}
                            {item.tags &&
                              item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                  {tag === 'Spicy' && <Flame className="w-2.5 h-2.5 text-rose-500" />}
                                  {tag === 'Vegetarian' && <Leaf className="w-2.5 h-2.5 text-emerald-500" />}
                                  {tag === 'Chef Special' && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                                  {tag}
                                </span>
                              ))}
                          </div>

                          {isItemPromoActive(item) && item.promoDescription && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 line-clamp-1 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>{item.promoDescription}</span>
                            </p>
                          )}

                          {item.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Order Tray / Add Counter */}
                        {page.allowWhatsAppOrdering && (
                          <div className="mt-3 flex items-center justify-end">
                            {inTray > 0 ? (
                              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-0.5">
                                <button
                                  onClick={() => handleRemoveFromCart(item.id)}
                                  className="w-6 h-6 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold shadow-2xs hover:bg-slate-100"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 px-1 font-mono">
                                  {inTray}
                                </span>
                                <button
                                  onClick={() => handleAddToCart(item)}
                                  className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs hover:bg-emerald-500"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddToCart(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add to Order</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PHOTOS & GALLERY */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Photo Gallery</h2>
              <span className="text-xs text-slate-400">{page.photos.length} Photos</span>
            </div>

            {page.photos.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No photos uploaded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">The business owner can add photos in the QR Hosting editor</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {page.photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="group relative aspect-4/3 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer shadow-xs border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 transition"
                  >
                    <img
                      src={photo.url}
                      alt={photo.title || 'Business photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {photo.badge && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold shadow-xs backdrop-blur-xs flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" />
                          <span>{photo.badge}</span>
                        </span>
                      </div>
                    )}
                    {(photo.title || photo.category) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-2 text-white">
                        <p className="text-xs font-semibold truncate drop-shadow-xs">{photo.title || 'Business Photo'}</p>
                        {photo.category && <p className="text-[10px] text-emerald-300 font-medium">{photo.category}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ABOUT & VENUE INFO */}
        {activeTab === 'about' && (
          <div className="space-y-4">
            {/* Description Card */}
            {page.description && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">About Our Venue</h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {page.description}
                </p>
              </div>
            )}

            {/* Hours & Location Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location & Hours</h3>

              {page.address && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs sm:text-sm">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Physical Address</p>
                    <p className="text-slate-500 dark:text-slate-400">{page.address}</p>
                    <a
                      href={page.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(page.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1 mt-1 hover:underline"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {page.openingHours && (
                <div className="flex items-start gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs sm:text-sm">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Opening Hours</p>
                    <p className="text-slate-500 dark:text-slate-400">{page.openingHours}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Guest WiFi Info Card */}
            {(page.wifiName || page.wifiPassword) && (
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                      Complimentary Guest Wi-Fi
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      if (page.wifiPassword) {
                        navigator.clipboard.writeText(page.wifiPassword);
                        setCopiedWifi(true);
                        setTimeout(() => setCopiedWifi(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition"
                  >
                    {copiedWifi ? 'Password Copied!' : 'Copy Password'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Network (SSID):</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{page.wifiName || 'Guest WiFi'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Password:</span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {page.wifiPassword || 'None'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Order Bar at bottom */}
      {page.allowWhatsAppOrdering && totalTrayCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setShowOrderTrayModal(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3.5 rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-between transition-transform active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black">
                {totalTrayCount}
              </div>
              <div className="text-left">
                <p className="text-xs text-emerald-100 font-normal">View Current Order</p>
                <p className="text-sm font-extrabold">{totalTrayCount} items selected</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base font-black">
                {page.currency} {totalTrayPrice.toLocaleString()}
              </span>
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Send className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* MODAL: ORDER TRAY & WHATSAPP CHECKOUT */}
      {showOrderTrayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Your Order Tray</h3>
                  <p className="text-[11px] text-slate-400">{totalTrayCount} items selected</p>
                </div>
              </div>

              <button
                onClick={() => setShowOrderTrayModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items list */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {trayList.map((t) => (
                <div
                  key={t.item.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t.item.name}</p>
                    <p className="text-slate-400">
                      {page.currency} {getItemEffectivePrice(t.item).toLocaleString()} each
                      {isItemPromoActive(t.item) && t.item.promoPrice !== undefined && t.item.promoPrice > 0 && (
                        <span className="ml-1 text-[10px] font-bold text-amber-500">
                          (🔥 Promo)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                      <button
                        onClick={() => handleRemoveFromCart(t.item.id)}
                        className="w-6 h-6 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-1">{t.quantity}</span>
                      <button
                        onClick={() => handleAddToCart(t.item)}
                        className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-bold text-emerald-600 dark:text-emerald-400 w-16 text-right">
                      {page.currency} {(t.quantity * t.item.price).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              {/* Table / Details inputs */}
              <div className="pt-3 space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Table or Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Table 4, Poolside, Room 12"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Your Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer with checkout button */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
              <div className="flex items-center justify-between text-sm font-extrabold">
                <span className="text-slate-600 dark:text-slate-400">Total:</span>
                <span className="text-lg text-emerald-600 dark:text-emerald-400">
                  {page.currency} {totalTrayPrice.toLocaleString()}
                </span>
              </div>

              <button
                onClick={handleSendWhatsAppOrder}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Order via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FULLSCREEN ITEM DETAILS (SHOWS ALL INFORMATION) */}
      {selectedItemModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setSelectedItemModal(null)}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedItemModal(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition active:scale-95 shadow-md"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Container */}
            <div className="overflow-y-auto flex-1">
              {/* Photo Display */}
              {selectedItemModal.photoUrl ? (
                <div className="w-full bg-black/80 flex items-center justify-center min-h-[220px] max-h-[46vh] overflow-hidden">
                  <img
                    src={selectedItemModal.photoUrl}
                    alt={selectedItemModal.name}
                    className="w-full max-h-[46vh] object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}

              {/* All Item Information */}
              <div className="p-5 sm:p-6 space-y-4">
                {/* Category & Availability */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-white/10">
                      {selectedItemModal.category}
                    </span>
                    {selectedItemModal.isAvailable !== false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        Currently Unavailable
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end">
                    {isItemPromoActive(selectedItemModal) &&
                    selectedItemModal.promoPrice !== undefined &&
                    selectedItemModal.promoPrice > 0 ? (
                      <>
                        <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono leading-tight">
                          {page.currency} {selectedItemModal.promoPrice.toLocaleString()}
                        </span>
                        <span className="text-xs line-through text-slate-400 font-medium">
                          {page.currency} {selectedItemModal.price.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                        {page.currency} {selectedItemModal.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                  {selectedItemModal.name}
                </h2>

                {/* Promo Banner if Active */}
                {isItemPromoActive(selectedItemModal) && (
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                          <BadgePercent className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-300">Special Promotion Active</p>
                          <p className="text-[11px] text-slate-300">
                            {selectedItemModal.promoStartDate && selectedItemModal.promoEndDate
                              ? `Valid from ${selectedItemModal.promoStartDate} to ${selectedItemModal.promoEndDate}`
                              : selectedItemModal.promoEndDate
                              ? `Ends on ${selectedItemModal.promoEndDate}`
                              : 'Limited-time special offer'}
                          </p>
                        </div>
                      </div>
                      {selectedItemModal.promoPrice && selectedItemModal.promoPrice < selectedItemModal.price && (
                        <span className="shrink-0 text-[11px] font-extrabold text-amber-200 px-2 py-1 rounded-lg bg-amber-500/30 border border-amber-500/40">
                          SAVE {page.currency} {(selectedItemModal.price - selectedItemModal.promoPrice).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {selectedItemModal.promoDescription && (
                      <div className="pt-2 border-t border-amber-500/20 text-xs text-amber-200/90 font-medium">
                        "{selectedItemModal.promoDescription}"
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {selectedItemModal.tags && selectedItemModal.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItemModal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-slate-200 border border-white/10"
                      >
                        {tag === 'Spicy' && <Flame className="w-3 h-3 text-rose-400" />}
                        {tag === 'Vegetarian' && <Leaf className="w-3 h-3 text-emerald-400" />}
                        {tag === 'Chef Special' && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Full Description */}
                {selectedItemModal.description && (
                  <div className="space-y-1 pt-2 border-t border-white/10">
                    <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                      Item Description & Ingredients
                    </h4>
                    <p className="text-sm text-slate-200 leading-relaxed font-normal">
                      {selectedItemModal.description}
                    </p>
                  </div>
                )}

                {/* WhatsApp Order Action */}
                {page.allowWhatsAppOrdering && (
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">
                      {trayItems[selectedItemModal.id]?.quantity ? (
                        <span className="text-emerald-400 font-semibold">
                          In your order ({trayItems[selectedItemModal.id]?.quantity})
                        </span>
                      ) : (
                        <span>Ready to order?</span>
                      )}
                    </div>

                    <div>
                      {trayItems[selectedItemModal.id]?.quantity ? (
                        <div className="flex items-center gap-2 bg-white/10 rounded-xl p-1 border border-white/10">
                          <button
                            onClick={() => handleRemoveFromCart(selectedItemModal.id)}
                            className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold hover:bg-white/30 active:scale-95"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold text-emerald-300 px-2 font-mono">
                            {trayItems[selectedItemModal.id]?.quantity}
                          </span>
                          <button
                            onClick={() => handleAddToCart(selectedItemModal)}
                            className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold hover:bg-emerald-500 active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(selectedItemModal)}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 transition"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add to Order</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Close Button */}
            <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-end">
              <button
                onClick={() => setSelectedItemModal(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PHOTO LIGHTBOX (FOR VENUE / GALLERY PHOTOS) */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-xl w-full text-center relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.title || 'Photo'}
              className="max-h-[72vh] w-auto mx-auto rounded-2xl shadow-2xl object-contain border border-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="mt-3 text-center">
              {selectedPhoto.badge && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/40 mb-1.5">
                  <Tag className="w-3 h-3" />
                  <span>{selectedPhoto.badge}</span>
                </span>
              )}
              {selectedPhoto.title && (
                <p className="text-white font-bold text-base drop-shadow-sm">{selectedPhoto.title}</p>
              )}
              {selectedPhoto.category && (
                <p className="text-emerald-400 text-xs font-semibold mt-0.5">{selectedPhoto.category}</p>
              )}
              {selectedPhoto.description && (
                <p className="text-slate-300 text-xs mt-1.5 max-w-md mx-auto leading-relaxed">{selectedPhoto.description}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="mt-4 px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL: WI-FI INFO POPUP */}
      {showWifiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xs w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Wifi className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Guest Wi-Fi Access</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Connect free during your visit</p>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-left space-y-2 border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Network Name:</span>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">{page.wifiName || 'Guest WiFi'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Password:</span>
                <p className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                  {page.wifiPassword || 'No password'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {page.wifiPassword && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(page.wifiPassword || '');
                    setCopiedWifi(true);
                    setTimeout(() => setCopiedWifi(false), 2000);
                  }}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  {copiedWifi ? 'Copied!' : 'Copy Password'}
                </button>
              )}
              <button
                onClick={() => setShowWifiModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
