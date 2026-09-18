import React from 'react';
import {
  ArrowUpRight,
  FileText,
  Receipt as ReceiptIcon,
  Boxes,
  QrCode,
} from 'lucide-react';
import { ActiveScreen, BusinessProfile, Receipt, InventoryTab } from '../types';

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
  onNavigateToInventory?: (tab?: InventoryTab, showAddInline?: boolean) => void;
  onSelectReceipt: (receipt: Receipt) => void;
  onShareReceipt: (receipt: Receipt) => void;
  onOpenCustomerView?: (page: any) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onNavigateToInventory,
}) => {
  return (
    <div className="space-y-6 pt-2 pb-24 animate-fadeIn max-w-2xl mx-auto">
      {/* SECTION: CHOOSE DOCUMENT OR ACTION (RECEIPT, INVOICE, INVENTORY, OR QR HOSTING) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] font-medium text-slate-400">
            Select an option below
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* OPTION 1: CREATE NEW RECEIPT */}
          <button
            id="btn-main-create-receipt"
            type="button"
            onClick={() => onNavigate('create-receipt')}
            className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-600/20 active:scale-[0.99] transition-all overflow-hidden border border-emerald-500/50 text-left min-h-[96px] sm:min-h-[108px]"
          >
            <div className="flex items-start justify-between w-full mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <ReceiptIcon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md sm:rounded-lg bg-white/15 text-[10px] sm:text-xs font-semibold text-emerald-100 group-hover:bg-white/25 transition">
                <span>Sale</span>
                <ArrowUpRight className="w-3 h-3 text-white" />
              </div>
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                Create Receipt
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 font-normal mt-0.5 leading-snug">
                Issue proof of payment
              </p>
            </div>
          </button>

          {/* OPTION 2: CREATE NEW INVOICE */}
          <button
            id="btn-main-create-invoice"
            type="button"
            onClick={() => onNavigate('create-invoice')}
            className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm shadow-indigo-600/20 active:scale-[0.99] transition-all overflow-hidden border border-indigo-500/50 text-left min-h-[96px] sm:min-h-[108px]"
          >
            <div className="flex items-start justify-between w-full mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md sm:rounded-lg bg-white/15 text-[10px] sm:text-xs font-semibold text-indigo-100 group-hover:bg-white/25 transition">
                <span>Bill</span>
                <ArrowUpRight className="w-3 h-3 text-white" />
              </div>
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                Create Invoice
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-100/90 font-normal mt-0.5 leading-snug">
                Bill clients with due dates
              </p>
            </div>
          </button>

          {/* OPTION 3: INVENTORY */}
          <button
            id="btn-main-inventory"
            type="button"
            onClick={() => onNavigateToInventory ? onNavigateToInventory('stock', true) : onNavigate('inventory')}
            className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-sm shadow-sky-600/20 active:scale-[0.99] transition-all overflow-hidden border border-sky-500/50 text-left min-h-[96px] sm:min-h-[108px]"
          >
            <div className="flex items-start justify-between w-full mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <Boxes className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md sm:rounded-lg bg-white/15 text-[10px] sm:text-xs font-semibold text-sky-100 group-hover:bg-white/25 transition">
                <span>Stock</span>
                <ArrowUpRight className="w-3 h-3 text-white" />
              </div>
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                Inventory
              </div>
              <p className="text-[11px] sm:text-xs text-sky-100/90 font-normal mt-0.5 leading-snug">
                Track stock & products
              </p>
            </div>
          </button>

          {/* OPTION 4: QR CODE HOSTING */}
          <button
            id="btn-main-qr-hosting"
            type="button"
            onClick={() => onNavigate('qr-hosting')}
            className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-sm shadow-teal-600/20 active:scale-[0.99] transition-all overflow-hidden border border-teal-500/50 text-left min-h-[96px] sm:min-h-[108px]"
          >
            <div className="flex items-start justify-between w-full mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md sm:rounded-lg bg-white/15 text-[10px] sm:text-xs font-semibold text-teal-100 group-hover:bg-white/25 transition">
                <span>Items</span>
                <ArrowUpRight className="w-3 h-3 text-white" />
              </div>
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                Host QR code & business info
              </div>
              <p className="text-[11px] sm:text-xs text-teal-100/90 font-normal mt-0.5 leading-snug">
                Host photos, menu, business information & get the QR code or link for your business
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

