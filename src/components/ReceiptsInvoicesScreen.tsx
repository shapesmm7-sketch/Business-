import React from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { ActiveScreen, BusinessProfile, Receipt } from '../types';

interface ReceiptsInvoicesScreenProps {
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
  onNavigate: (screen: ActiveScreen) => void;
  onNavigateHome: () => void;
}

export const ReceiptsInvoicesScreen: React.FC<ReceiptsInvoicesScreenProps> = ({
  stats,
  onNavigate,
  onNavigateHome,
}) => {
  return (
    <div className="space-y-6 pt-2 pb-24 animate-fadeIn max-w-2xl mx-auto">
      {/* Top Header Row with Back Button */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <button
            id="btn-back-to-home"
            type="button"
            onClick={onNavigateHome}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 flex items-center justify-center"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Receipts & Invoices
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an option to create or manage billing documents
            </p>
          </div>
        </div>
      </div>

      {/* Main Two Action Buttons (Identical to original home page card styling) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Create Document
          </h2>
          <span className="text-[11px] font-medium text-slate-400">
            Choose document type
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
          {/* OPTION 1: CREATE NEW RECEIPT */}
          <button
            id="btn-page-create-receipt"
            type="button"
            onClick={() => onNavigate('create-receipt')}
            className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-600/20 active:scale-[0.99] transition-all overflow-hidden border border-emerald-500/50 text-left min-h-[108px] sm:min-h-[120px]"
          >
            <div className="flex items-start justify-between w-full mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <ReceiptIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] text-white" />
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 text-[11px] sm:text-xs font-semibold text-emerald-100 group-hover:bg-white/25 transition">
                <span>Sale</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div>
              <div className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Create Receipt
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/90 font-normal mt-0.5 leading-snug">
                Issue proof of payment
              </p>
            </div>
          </button>

          {/* OPTION 2: CREATE NEW INVOICE */}
          <button
            id="btn-page-create-invoice"
            type="button"
            onClick={() => onNavigate('create-invoice')}
            className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm shadow-indigo-600/20 active:scale-[0.99] transition-all overflow-hidden border border-indigo-500/50 text-left min-h-[108px] sm:min-h-[120px]"
          >
            <div className="flex items-start justify-between w-full mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] text-white" />
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 text-[11px] sm:text-xs font-semibold text-indigo-100 group-hover:bg-white/25 transition">
                <span>Bill</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div>
              <div className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Create Invoice
              </div>
              <p className="text-xs sm:text-sm text-indigo-100/90 font-normal mt-0.5 leading-snug">
                Bill clients with due dates
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
