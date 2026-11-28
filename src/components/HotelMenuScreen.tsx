import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Wifi,
  MapPin,
  Mail,
  Globe,
} from 'lucide-react';
import { BusinessProfile, QRCodeHostedPage, QrCategoryId } from '../types';
import { StorageService } from '../services/storage';
import { t } from '../utils/i18n';
import { CategoryPhotoIcon } from './CategoryPhotoIcon';
import { SetDefaultPageButton } from './SetDefaultPageButton';
import { AdMobNativeAd } from './AdMobNativeAd';
import { ADMOB_UNITS } from '../services/admobService';

interface HotelMenuScreenProps {
  business: BusinessProfile;
  onNavigateHome: () => void;
  onOpenQrCategory: (category: QrCategoryId) => void;
}

export const HotelMenuScreen: React.FC<HotelMenuScreenProps> = ({
  business,
  onNavigateHome,
  onOpenQrCategory,
}) => {
  const lang = business?.language;
  const [hostedPage, setHostedPage] = useState<QRCodeHostedPage | undefined>(() =>
    StorageService.getHostedQRPages()[0]
  );
  const [roomsCount, setRoomsCount] = useState<number>(() =>
    StorageService.getRoomsQrItems().length
  );

  useEffect(() => {
    const syncData = () => {
      setHostedPage(StorageService.getHostedQRPages()[0]);
      setRoomsCount(StorageService.getRoomsQrItems().length);
    };
    syncData();
    window.addEventListener('brivu_data_refreshed', syncData);
    window.addEventListener('storage', syncData);
    return () => {
      window.removeEventListener('brivu_data_refreshed', syncData);
      window.removeEventListener('storage', syncData);
    };
  }, []);

  const menuPhotosCount = hostedPage?.menuImages?.length || 0;
  const menuItemsCount = hostedPage?.menuItems?.length || 0;
  const businessPhotosCount = hostedPage?.photos?.length || 0;
  const wifiName = (hostedPage?.wifiName || '').trim();
  const hasLocation = Boolean((hostedPage?.googleMapsUrl || hostedPage?.address || '').trim());
  const hasContacts = Boolean((hostedPage?.phone || hostedPage?.whatsapp || hostedPage?.email || '').trim());

  return (
    <div className="min-h-screen bg-[#F7F9F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-36 sm:pb-40 flex flex-col transition-colors">
      {/* STICKY HEADER BAR */}
      <div className="sticky top-0 z-30 bg-[#F7F9F7]/95 dark:bg-slate-950/95 backdrop-blur-md pt-3 pb-3 px-4 border-b border-slate-200/60 dark:border-slate-800/70">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="btn-hotel-menu-back"
              type="button"
              onClick={onNavigateHome}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs text-slate-800 dark:text-slate-100 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition shrink-0 cursor-pointer"
              title={t('home', lang)}
              aria-label={t('home', lang)}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            </button>

            <CategoryPhotoIcon
              kind="hotel-menu"
              className="w-11 h-9 rounded-xl shrink-0"
              alt="Hotel & menu"
            />

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none truncate">
                Hotel &amp; menu
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                Menus, rooms &amp; guest QR tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SetDefaultPageButton
              variant="light"
              compact
              config={{
                screen: 'hotel-menu',
                label: 'Hotel & menu',
              }}
            />
            <button
              id="btn-hotel-menu-home"
              type="button"
              onClick={onNavigateHome}
              className="h-9 px-4 rounded-full bg-[#EAF6EC] dark:bg-emerald-950/80 hover:bg-[#DCF0DF] dark:hover:bg-emerald-900/80 text-[#0E6A33] dark:text-emerald-300 text-xs sm:text-sm font-extrabold transition active:scale-95 cursor-pointer"
            >
              {t('home', lang)}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-xl mx-auto w-full px-4 pt-4 space-y-3 animate-fadeIn">
        {/* PRIMARY SHOWCASE CARDS */}
        <div className="space-y-2.5">
          {/* 1. Menu QR Code */}
          <button
            id="btn-hotel-menu-choice-menu"
            type="button"
            onClick={() => onOpenQrCategory('menu')}
            className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3.5 text-left transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <CategoryPhotoIcon
                kind="menu-photos"
                className="w-16 h-12 rounded-xl shrink-0"
                alt="Menu QR Code"
              />
              <div className="min-w-0">
                <div className="text-[15px] sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                  Menu QR Code
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Host your hotel/restaurant menu photo and generate a scannable QR code for your customers
                </p>
                <div className="text-[11px] font-semibold text-[#0E6A33] dark:text-emerald-400 mt-1 tabular-nums">
                  {menuPhotosCount > 0
                    ? `${menuPhotosCount} menu photo${menuPhotosCount === 1 ? '' : 's'} · QR ready`
                    : 'No menu photos yet · Tap to add'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
          </button>

          {/* 2. Rooms QR Code */}
          <button
            id="btn-hotel-menu-choice-rooms"
            type="button"
            onClick={() => onOpenQrCategory('rooms')}
            className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3.5 text-left transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <CategoryPhotoIcon
                kind="hotel-rooms"
                className="w-16 h-12 rounded-xl shrink-0"
                alt="Rooms QR Code"
              />
              <div className="min-w-0">
                <div className="text-[15px] sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                  Rooms QR Code
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Showcase your hotel rooms, nightly rates, amenities &amp; photos via one scannable QR code
                </p>
                <div className="text-[11px] font-semibold text-[#0E6A33] dark:text-emerald-400 mt-1 tabular-nums">
                  {roomsCount > 0
                    ? `${roomsCount} room${roomsCount === 1 ? '' : 's'} listed · QR ready`
                    : 'Add room types, pricing & photos'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
          </button>

          {/* 3. WiFi QR Code */}
          <button
            id="btn-hotel-menu-choice-wifi"
            type="button"
            onClick={() => onOpenQrCategory('wifi')}
            className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3.5 text-left transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-16 h-12 rounded-xl bg-[#EAF6EC] dark:bg-emerald-950/70 border border-[#CBE7D1] dark:border-emerald-800/70 flex items-center justify-center shrink-0">
                <Wifi className="w-6 h-6 text-[#0E6A33] dark:text-emerald-400 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                  WiFi QR Code
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Turn your WiFi name &amp; password into a scannable QR code so guests connect in one scan
                </p>
                <div className="text-[11px] font-semibold text-[#0E6A33] dark:text-emerald-400 mt-1 truncate">
                  {wifiName ? `Network: ${wifiName}` : 'Configure WiFi name & password'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
          </button>

          {/* 4. Website */}
          <button
            id="btn-hotel-menu-choice-hub"
            type="button"
            onClick={() => onOpenQrCategory('business')}
            className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3.5 text-left transition active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-16 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 text-amber-700 dark:text-amber-400 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                  Website
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Create items or add your photos and files here to turn them into a full live website accessible online by link or QR code
                </p>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
                  {`${menuItemsCount} item${menuItemsCount === 1 ? '' : 's'} · ${businessPhotosCount} photo${businessPhotosCount === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* GUEST INFO & PREVIEW ROW */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            id="btn-hotel-menu-location"
            type="button"
            onClick={() => onOpenQrCategory('location')}
            className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 flex items-center gap-2.5 text-left transition active:scale-[0.98] cursor-pointer min-h-[56px]"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Location QR
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {hasLocation ? 'Map pin ready' : 'Add map link'}
              </div>
            </div>
          </button>

          <button
            id="btn-hotel-menu-contacts"
            type="button"
            onClick={() => onOpenQrCategory('contacts')}
            className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 flex items-center gap-2.5 text-left transition active:scale-[0.98] cursor-pointer min-h-[56px]"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Desk &amp; Contacts
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {hasContacts ? 'Contact info set' : 'Phone & email QR'}
              </div>
            </div>
          </button>
        </div>

        <div className="pt-2">
          <AdMobNativeAd
            context="home"
            variant="bottom"
            unitId={ADMOB_UNITS.NATIVE_ADVANCED}
          />
        </div>
      </div>
    </div>
  );
};
