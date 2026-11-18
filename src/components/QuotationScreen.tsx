import React from 'react';
import { ArrowLeft, List, PlusCircle } from 'lucide-react';
import {
  BusinessProfile,
  PaymentMethod,
  Receipt,
  ReceiptTemplateId,
} from '../types';
import { CreateInvoiceScreen } from './CreateInvoiceScreen';
import { ReceiptsHistoryScreen } from './ReceiptsHistoryScreen';

export type QuotationTab = 'create' | 'list';

interface QuotationScreenProps {
  activeTab: QuotationTab;
  onTabChange: (tab: QuotationTab) => void;
  business: BusinessProfile;
  defaultTemplate: ReceiptTemplateId;
  defaultPaymentMethod?: PaymentMethod;
  receipts: Receipt[];
  editingQuotation?: Receipt | null;
  duplicateFromQuotation?: Receipt | null;
  onCancel: () => void;
  onSaveOnly: (quotation: Receipt) => void;
  onSaveAndPreview: (quotation: Receipt) => void;
  onQuickDownload: (quotation: Receipt) => void;
  onQuickShare: (quotation: Receipt) => void;
  onOpenReceipt: (quotation: Receipt) => void;
  onEditReceipt: (quotation: Receipt) => void;
  onShareReceipt: (quotation: Receipt) => void;
  onDuplicateReceipt: (quotation: Receipt) => void;
  onDownloadReceipt: (quotation: Receipt) => void;
  onDeleteReceipt: (id: string) => void;
  onCreateNewFromList: () => void;
  onOpenTemplates: () => void;
  onEditProfile: () => void;
}

export const QuotationScreen: React.FC<QuotationScreenProps> = ({
  activeTab,
  onTabChange,
  business,
  defaultTemplate,
  defaultPaymentMethod = 'Bank',
  receipts,
  editingQuotation,
  duplicateFromQuotation,
  onCancel,
  onSaveOnly,
  onSaveAndPreview,
  onQuickDownload,
  onQuickShare,
  onOpenReceipt,
  onEditReceipt,
  onShareReceipt,
  onDuplicateReceipt,
  onDownloadReceipt,
  onDeleteReceipt,
  onCreateNewFromList,
  onOpenTemplates,
  onEditProfile,
}) => {
  const quotationsCount = (receipts || []).filter(
    (r) => r.documentType === 'quotation'
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Switcher Bar: Back + Create new & List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 sm:p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2">
        <button
          id="btn-quotation-back-home"
          type="button"
          onClick={onCancel}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          title="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-2 gap-1.5 flex-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            id="btn-quotation-tab-create"
            type="button"
            onClick={() => onTabChange('create')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Create new</span>
          </button>

          <button
            id="btn-quotation-tab-list"
            type="button"
            onClick={() => onTabChange('list')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-4 h-4 shrink-0" />
            <span>List</span>
            {quotationsCount > 0 && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                  activeTab === 'list'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {quotationsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <CreateInvoiceScreen
          mode="quotation"
          hideBackButton={true}
          business={business}
          defaultTemplate={defaultTemplate}
          defaultPaymentMethod={defaultPaymentMethod}
          editingInvoice={editingQuotation}
          duplicateFromInvoice={duplicateFromQuotation}
          onCancel={onCancel}
          onSaveOnly={onSaveOnly}
          onSaveAndPreview={onSaveAndPreview}
          onQuickDownload={onQuickDownload}
          onQuickShare={onQuickShare}
        />
      ) : (
        <ReceiptsHistoryScreen
          receipts={receipts}
          business={business}
          mode="quotations"
          onOpenReceipt={onOpenReceipt}
          onEditReceipt={onEditReceipt}
          onShareReceipt={onShareReceipt}
          onDuplicateReceipt={onDuplicateReceipt}
          onDownloadReceipt={onDownloadReceipt}
          onDeleteReceipt={onDeleteReceipt}
          onOpenTemplates={onOpenTemplates}
          onCreateNew={onCreateNewFromList}
          onCreateInvoice={onCreateNewFromList}
          onEditProfile={onEditProfile}
        />
      )}
    </div>
  );
};
