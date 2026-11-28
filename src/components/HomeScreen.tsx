import React from 'react';
import {
  FileText,
  ChevronRight,
  Scan,
} from 'lucide-react';
import { ActiveScreen, BusinessProfile, Receipt, InventoryTab, QrCategoryId } from '../types';
import { t } from '../utils/i18n';
import { AdMobNativeAd } from './AdMobNativeAd';
import { ADMOB_UNITS } from '../services/admobService';
import { CategoryPhotoIcon, CategoryPhotoKind } from './CategoryPhotoIcon';

interface HomeScreenProps {
  business: BusinessProfile;
  stats: {
    totalReceipts: number;
    totalInvoices?: number;
    todayReceipts: number;
    todaySales: number;
    pendingInvoices?: number;
    totalOutstanding?: number;
    recentReceipts: Receipt[];
  };
  activeTemplate: string;
  onNavigate: (screen: ActiveScreen) => void;
  onNavigateToInventory?: (
    tab?: InventoryTab,
    showAddInline?: boolean,
    explicitCategory?: 'products' | 'money' | 'people' | null
  ) => void;
  onNavigateToQrCategory?: (category: QrCategoryId) => void;
  onSelectReceipt: (receipt: Receipt) => void;
  onShareReceipt: (receipt: Receipt) => void;
  onOpenCustomerView?: (page: any) => void;
  onOpenQrScanner?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  business,
  onNavigate,
  onNavigateToInventory,
  onNavigateToQrCategory,
  onOpenQrScanner,
}) => {
  const lang = business?.language;

  const openQrCategory = (category: QrCategoryId) => {
    if (onNavigateToQrCategory) {
      onNavigateToQrCategory(category);
    } else {
      onNavigate('qr-hosting');
    }
  };

  const quickShortcuts: Array<{
    id: string;
    label: string;
    iconKind: CategoryPhotoKind;
    onClick: () => void;
  }> = [
    {
      id: 'btn-home-shortcut-stock',
      label: t('stock', lang) || 'Stock',
      iconKind: 'stock',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('stock', false, 'products')
          : onNavigate('inventory'),
    },
    {
      id: 'btn-home-shortcut-sales',
      label: 'Sales',
      iconKind: 'sales',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('sales', false, 'products')
          : onNavigate('inventory'),
    },
    {
      id: 'btn-home-shortcut-clients',
      label: 'Clients',
      iconKind: 'clients',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('customers', false, 'people')
          : onNavigate('inventory'),
    },
    {
      id: 'btn-home-shortcut-shopping',
      label: 'Shopping list',
      iconKind: 'shopping-list',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('shoppingList', false, 'products')
          : onNavigate('inventory'),
    },
    {
      id: 'btn-home-shortcut-events',
      label: t('events', lang) || 'Events',
      iconKind: 'events',
      onClick: () => openQrCategory('events'),
    },
    {
      id: 'btn-home-shortcut-hotel-menu',
      label: 'Hotel & menu',
      iconKind: 'hotel-menu',
      onClick: () => onNavigate('hotel-menu'),
    },
    {
      id: 'btn-home-shortcut-staff',
      label: 'Staff',
      iconKind: 'staff',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('workers', false, 'people')
          : onNavigate('inventory'),
    },
    {
      id: 'btn-home-shortcut-expenses',
      label: 'Expenses',
      iconKind: 'expenses',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('expense', false, 'money')
          : onNavigate('inventory'),
    },
    {
      id: 'btn-home-shortcut-debts',
      label: 'Debts',
      iconKind: 'debts',
      onClick: () =>
        onNavigateToInventory
          ? onNavigateToInventory('debts', false, 'money')
          : onNavigate('inventory'),
    },
  ];

  return (
    <div className="space-y-4 pt-1 pb-36 sm:pb-40 animate-fadeIn max-w-2xl mx-auto">
      {/* TOP FEATURED BANNER: HOST QR CODE */}
      <button
        id="btn-main-qr-hosting"
        type="button"
        onClick={() => onNavigate('qr-hosting')}
        className="w-full group flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#0E6A33] hover:bg-[#0B592B] text-white shadow-xs active:scale-[0.99] transition-all text-left cursor-pointer"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <CategoryPhotoIcon
            kind="qr-host"
            className="w-12 h-12 rounded-xl border-white/25 bg-white/15 group-hover:scale-105 transition-transform"
            alt="Host QR code"
          />
          <div className="min-w-0">
            <div className="text-[17px] sm:text-lg font-extrabold tracking-tight text-white leading-snug truncate">
              Host QR code
            </div>
            <p className="text-xs sm:text-[13px] text-emerald-50/90 font-normal leading-snug truncate mt-0.5">
              Photos, menu &amp; business links
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/90 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* QUICK ACTIONS HEADER */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[17px] sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('quick_actions', lang) || 'Quick actions'}
          </h2>
        </div>

        {/* TWO FEATURED PRIMARY CARDS: RECEIPTS & INVOICES + INVENTORY */}
        <div className="grid grid-cols-2 gap-3">
          {/* RECEIPTS & INVOICES */}
          <button
            id="btn-main-receipts-invoices"
            type="button"
            onClick={() => onNavigate('receipts-invoices')}
            className="group flex flex-col justify-between p-4 rounded-2xl bg-[#0B2817] hover:bg-[#10341F] dark:bg-[#0D2E1B] dark:hover:bg-[#133C24] border border-[#174128] text-white active:scale-[0.985] transition-all text-left min-h-[126px] shadow-xs cursor-pointer"
          >
            <CategoryPhotoIcon
              kind="receipts-invoices"
              className="w-11 h-11 rounded-xl bg-white/10 border-white/15 group-hover:scale-105 transition-transform"
              alt="Receipts and Invoices"
            />

            <div className="mt-2.5">
              <div className="text-[15px] sm:text-base font-extrabold tracking-tight text-white leading-tight">
                {t('receipts_and_invoices', lang)}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300/90 font-normal mt-1 leading-snug">
                Create and manage
              </p>
            </div>
          </button>

          {/* INVENTORY */}
          <button
            id="btn-main-inventory"
            type="button"
            onClick={() => onNavigate('inventory')}
            className="group flex flex-col justify-between p-4 rounded-2xl bg-[#E4F3E7] hover:bg-[#D7EDDC] dark:bg-emerald-950/70 dark:hover:bg-emerald-900/70 border border-[#CBE7D1] dark:border-emerald-800/70 active:scale-[0.985] transition-all text-left min-h-[126px] shadow-xs cursor-pointer"
          >
            <CategoryPhotoIcon
              kind="inventory"
              className="w-14 h-11 rounded-xl border-[#BCE0C4] dark:border-emerald-700/70 group-hover:scale-105 transition-transform"
              alt="Inventory"
            />

            <div className="mt-2.5">
              <div className="text-[15px] sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                {t('inventory', lang)}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-emerald-100/80 font-normal mt-1 leading-snug">
                Track stock
              </p>
            </div>
          </button>
        </div>

        {/* 3x3 QUICK SHORTCUT GRID */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-0.5">
          {quickShortcuts.map((item) => (
            <button
              key={item.id}
              id={item.id}
              type="button"
              onClick={item.onClick}
              className="group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-2 py-2.5 min-h-[104px] flex flex-col items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 active:scale-[0.98] transition-all cursor-pointer"
            >
              <CategoryPhotoIcon
                kind={item.iconKind}
                className="w-[72px] h-[54px] sm:w-[80px] sm:h-[60px] group-hover:scale-105 transition-transform"
                alt={item.label}
              />
              <span className="text-[12px] sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 text-center leading-tight truncate max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* BOTTOM TEXT-ICON LINKS: QUOTATION & SCAN QR CODE */}
        <div className="pt-2 px-1 flex items-center gap-6">
          <button
            id="btn-home-quotation"
            type="button"
            onClick={() => onNavigate('create-quotation')}
            className="inline-flex items-center gap-2 min-h-[44px] text-sm sm:text-[15px] font-extrabold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap cursor-pointer active:opacity-70 transition"
          >
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 stroke-[2.2]" />
            <span>Quotation</span>
          </button>

          {onOpenQrScanner && (
            <button
              id="btn-home-scan-qr"
              type="button"
              onClick={onOpenQrScanner}
              className="inline-flex items-center gap-2 min-h-[44px] text-sm sm:text-[15px] font-extrabold text-[#0E6A33] dark:text-emerald-400 hover:text-[#0B592B] dark:hover:text-emerald-300 whitespace-nowrap cursor-pointer active:opacity-70 transition"
            >
              <Scan className="w-4 h-4 text-[#0E6A33] dark:text-emerald-400 shrink-0 stroke-[2.2]" />
              <span>{t('scan_qr', lang) || 'Scan QR Code'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Native Advanced Ad */}
      <div className="pt-2">
        <AdMobNativeAd
          context="home"
          variant="bottom"
          unitId={ADMOB_UNITS.NATIVE_ADVANCED}
        />
      </div>
    </div>
  );
};
