import React from 'react';
import { Home, Receipt as ReceiptIcon, FileText, Boxes, QrCode } from 'lucide-react';
import { ActiveScreen } from '../types';

interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  receiptsCount: number;
  invoicesCount?: number;
  inventoryCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  receiptsCount,
  invoicesCount = 0,
  inventoryCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors pb-safe">
      <div className="max-w-2xl mx-auto px-1 sm:px-4 py-1 flex items-center justify-around relative">
        {/* Home */}
        <button
          id="nav-btn-home"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 sm:px-3 rounded-xl transition ${
            currentScreen === 'home' || currentScreen === 'receipts-invoices'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] sm:text-[11px]">Home</span>
        </button>

        {/* Receipts History */}
        <button
          id="nav-btn-receipts"
          onClick={() => onNavigate('receipts')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 sm:px-3 rounded-xl transition ${
            currentScreen === 'receipts'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ReceiptIcon className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[10px] sm:text-[11px]">Receipts</span>
        </button>

        {/* Invoices History */}
        <button
          id="nav-btn-invoices"
          onClick={() => onNavigate('invoices')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 sm:px-3 rounded-xl transition ${
            currentScreen === 'invoices'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <FileText className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[10px] sm:text-[11px]">Invoices</span>
        </button>

        {/* Inventory */}
        <button
          id="nav-btn-inventory"
          onClick={() => onNavigate('inventory')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 sm:px-3 rounded-xl transition ${
            currentScreen === 'inventory'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Boxes className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[10px] sm:text-[11px]">Inventory</span>
        </button>

        {/* Host QR & Business Info */}
        <button
          id="nav-btn-qr-hosting"
          onClick={() => onNavigate('qr-hosting')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 sm:px-3 rounded-xl transition ${
            currentScreen === 'qr-hosting'
              ? 'text-teal-600 dark:text-teal-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <QrCode className="w-5 h-5 mb-0.5" />
          </div>
          <span className="text-[10px] sm:text-[11px] whitespace-nowrap">Host QR</span>
        </button>
      </div>
    </nav>
  );
};
