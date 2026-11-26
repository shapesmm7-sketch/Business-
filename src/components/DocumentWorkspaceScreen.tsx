import React from 'react';
import { ArrowLeft, List, PlusCircle } from 'lucide-react';
import {
  BusinessProfile,
  PaymentMethod,
  Receipt,
  ReceiptTemplateId,
} from '../types';
import { CreateReceiptScreen } from './CreateReceiptScreen';
import { CreateInvoiceScreen } from './CreateInvoiceScreen';
import { ReceiptsHistoryScreen } from './ReceiptsHistoryScreen';

export type DocumentWorkspaceTab = 'create' | 'list';

interface DocumentWorkspaceScreenProps {
  docType: 'receipt' | 'invoice';
  activeTab: DocumentWorkspaceTab;
  onTabChange: (tab: DocumentWorkspaceTab) => void;
  business: BusinessProfile;
  defaultTemplate: ReceiptTemplateId;
  defaultPaymentMethod?: PaymentMethod;
  receipts: Receipt[];
  editingDocument?: Receipt | null;
  duplicateFromDocument?: Receipt | null;
  onCancel: () => void;
  onSaveOnly: (doc: Receipt) => void;
  onSaveAndPreview: (doc: Receipt) => void;
  onQuickDownload: (doc: Receipt) => void;
  onQuickShare: (doc: Receipt) => void;
  onOpenReceipt: (doc: Receipt) => void;
  onEditReceipt: (doc: Receipt) => void;
  onShareReceipt: (doc: Receipt) => void;
  onDuplicateReceipt: (doc: Receipt) => void;
  onDownloadReceipt: (doc: Receipt) => void;
  onDeleteReceipt: (id: string) => void;
  onCreateNewFromList: () => void;
  onOpenTemplates: () => void;
  onEditProfile: () => void;
}

export const DocumentWorkspaceScreen: React.FC<DocumentWorkspaceScreenProps> = ({
  docType,
  activeTab,
  onTabChange,
  business,
  defaultTemplate,
  defaultPaymentMethod = 'Cash',
  receipts,
  editingDocument,
  duplicateFromDocument,
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
  const isInvoice = docType === 'invoice';
  const docCount = (receipts || []).filter((r) =>
    isInvoice ? r.documentType === 'invoice' : (r.documentType || 'receipt') === 'receipt'
  ).length;

  const activePillClass = isInvoice
    ? 'bg-indigo-600 text-white shadow-xs'
    : 'bg-emerald-600 text-white shadow-xs';

  return (
    <div className="space-y-4">
      {/* Top Switcher Bar: Back + Create new & List (matching QuotationScreen) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 sm:p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2 max-w-2xl mx-auto">
        <button
          id={isInvoice ? 'btn-invoice-back-home' : 'btn-receipt-back-home'}
          type="button"
          onClick={onCancel}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          title="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-2 gap-1.5 flex-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            id={isInvoice ? 'btn-invoice-tab-create' : 'btn-receipt-tab-create'}
            type="button"
            onClick={() => onTabChange('create')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'create'
                ? activePillClass
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Create new</span>
          </button>

          <button
            id={isInvoice ? 'btn-invoice-tab-list' : 'btn-receipt-tab-list'}
            type="button"
            onClick={() => onTabChange('list')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? activePillClass
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-4 h-4 shrink-0" />
            <span>List</span>
            {docCount > 0 && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                  activeTab === 'list'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {docCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        isInvoice ? (
          <CreateInvoiceScreen
            mode="invoice"
            hideBackButton={true}
            business={business}
            defaultTemplate={defaultTemplate}
            defaultPaymentMethod={defaultPaymentMethod}
            editingInvoice={editingDocument}
            duplicateFromInvoice={duplicateFromDocument}
            onCancel={onCancel}
            onSaveOnly={onSaveOnly}
            onSaveAndPreview={onSaveAndPreview}
            onQuickDownload={onQuickDownload}
            onQuickShare={onQuickShare}
          />
        ) : (
          <CreateReceiptScreen
            hideBackButton={true}
            business={business}
            defaultTemplate={defaultTemplate}
            defaultPaymentMethod={defaultPaymentMethod}
            editingReceipt={editingDocument}
            duplicateFromReceipt={duplicateFromDocument}
            onCancel={onCancel}
            onSaveOnly={onSaveOnly}
            onSaveAndPreview={onSaveAndPreview}
            onQuickDownload={onQuickDownload}
            onQuickShare={onQuickShare}
          />
        )
      ) : (
        <ReceiptsHistoryScreen
          receipts={receipts}
          business={business}
          mode={isInvoice ? 'invoices' : 'receipts'}
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
