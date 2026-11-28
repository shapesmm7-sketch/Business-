import React from 'react';
import { Home, Boxes, QrCode } from 'lucide-react';
import { ActiveScreen } from '../types';
import { t } from '../utils/i18n';

interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  inventoryCount?: number;
  lang?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  lang,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 transition-colors pb-safe">
      <div className="max-w-2xl mx-auto px-2 sm:px-4 py-1 flex items-center justify-around relative">
        {/* Home */}
        <button
          id="nav-btn-home"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition cursor-pointer ${
            currentScreen === 'home' || currentScreen === 'receipts-invoices' || currentScreen === 'hotel-menu'
              ? 'text-[#0E6A33] dark:text-emerald-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] sm:text-[11px] truncate max-w-[72px]">
            {t('home', lang)}
          </span>
        </button>

        {/* Inventory */}
        <button
          id="nav-btn-inventory"
          onClick={() => onNavigate('inventory')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition cursor-pointer ${
            currentScreen === 'inventory'
              ? 'text-[#0E6A33] dark:text-emerald-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Boxes className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[10px] sm:text-[11px] truncate max-w-[72px]">
            {t('inventory', lang)}
          </span>
        </button>

        {/* Host QR & Business Info */}
        <button
          id="nav-btn-qr-hosting"
          onClick={() => onNavigate('qr-hosting')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition cursor-pointer ${
            currentScreen === 'qr-hosting'
              ? 'text-[#0E6A33] dark:text-emerald-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <QrCode className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[10px] sm:text-[11px] whitespace-nowrap truncate max-w-[72px]">
            {t('qr_code', lang)}
          </span>
        </button>
      </div>
    </nav>
  );
};
