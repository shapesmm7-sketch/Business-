import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Lightbulb,
  FileText,
  Package,
  Users,
  Camera,
  Loader2,
  Folder,
  Download,
  Upload,
  Sparkles,
  ShieldCheck,
  Layers,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  GoogleDriveService,
  GoogleDriveAccount,
  DriveBackupFile,
} from '../services/googleDriveService';
import { StorageService } from '../services/storage';

interface SyncToGoogleDriveScreenProps {
  onBack: () => void;
  onDataRestored?: () => void;
}

export const SyncToGoogleDriveScreen: React.FC<SyncToGoogleDriveScreenProps> = ({
  onBack,
  onDataRestored,
}) => {
  const [account, setAccount] = useState<GoogleDriveAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingBackups, setIsFetchingBackups] = useState(false);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  
  // Backups List Modal state
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  
  // Single backup restore confirmation state
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<DriveBackupFile | null>(null);
  const [localJsonContent, setLocalJsonContent] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);

  // Restore All state
  const [isRestoringAll, setIsRestoringAll] = useState(false);
  const [restoreAllProgress, setRestoreAllProgress] = useState<{ current: number; total: number; file: string } | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    // Load stored account on mount
    const stored = GoogleDriveService.getStoredAccount();
    if (stored && stored.connected) {
      setAccount(stored);
      loadBackups();
    }
  }, []);

  const loadBackups = async () => {
    setIsFetchingBackups(true);
    setBackupsError(null);
    setNeedsReconnect(false);
    try {
      const res = await GoogleDriveService.listBackupsWithStatus();
      setBackups(res.files);
      if (res.error) {
        setBackupsError(res.error);
        setNeedsReconnect(Boolean(res.needsReconnect));
      }
    } catch (e: any) {
      console.warn('Failed loading backups list:', e);
      setBackupsError(e?.message || 'Could not load Google Drive backups. Please tap Retry.');
    } finally {
      setIsFetchingBackups(false);
    }
  };

  /**
   * Opens Google's REAL account selection and authorization interface
   */
  const handleConnect = async (openModalAfter = false) => {
    setIsConnecting(true);
    setBackupsError(null);
    setNeedsReconnect(false);
    try {
      const connectedAccount = await GoogleDriveService.connectGoogleDrive();
      setAccount(connectedAccount);
      showToast('success', `Connected to Google Drive as ${connectedAccount.email}`);
      if (openModalAfter) {
        setShowBackupsModal(true);
      }
      await loadBackups();
    } catch (err: any) {
      console.error('Google authorization error:', err);
      showToast('error', err?.message || 'Google account authorization was cancelled or failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Triggers native Google Play Services account chooser by signing out active session first
   */
  const handleSwitchAccount = async () => {
    setIsConnecting(true);
    setBackupsError(null);
    setNeedsReconnect(false);
    try {
      const connectedAccount = await GoogleDriveService.switchGoogleAccount();
      setAccount(connectedAccount);
      showToast('success', `Switched Google Drive account to ${connectedAccount.email}`);
      await loadBackups();
    } catch (err: any) {
      console.error('Google switch account error:', err);
      showToast('error', err?.message || 'Failed to switch Google account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await GoogleDriveService.disconnectGoogleDrive();
      setAccount(null);
      setBackups([]);
      setBackupsError(null);
      setNeedsReconnect(false);
      setShowBackupsModal(false);
      showToast('success', 'Disconnected from Google Drive');
    } catch (err: any) {
      showToast('error', 'Error disconnecting Google Drive');
    }
  };

  const handleSyncNow = async () => {
    if (!account?.connected) {
      handleConnect();
      return;
    }

    setIsSyncing(true);
    try {
      const res = await GoogleDriveService.syncNow();
      if (res.success) {
        const photoMsg = res.photoCount ? ` (${res.photoCount} photos saved)` : '';
        showToast('success', `Backed up to "Brivu Backups" folder in Google Drive!${photoMsg}`);
        const updated = GoogleDriveService.getStoredAccount();
        if (updated) setAccount(updated);
        loadBackups();
      } else {
        showToast('error', res.error || 'Failed to sync data to Google Drive');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Handles opening the Backups Modal or connecting Google Drive first
   */
  const handleOpenRestoreModal = () => {
    if (!account?.connected) {
      handleConnect(true);
    } else {
      loadBackups();
      setShowBackupsModal(true);
    }
  };

  /**
   * Sequentially restores & merges ALL backups found in Google Drive
   */
  const handleRestoreAllBackups = async () => {
    setIsRestoringAll(true);
    setRestoreAllProgress({ current: 0, total: backups.length, file: 'Starting...' });
    try {
      const res = await GoogleDriveService.restoreAllBackups((curr, total, fileName) => {
        setRestoreAllProgress({ current: curr, total, file: fileName });
      });

      if (res.success) {
        const photosCount = res.totalItems?.photos || 0;
        const photoInfo = photosCount > 0 ? ` and ${photosCount} photos` : '';
        showToast(
          'success',
          `Successfully restored ALL ${res.restoredCount} backups (${res.totalItems?.receipts || 0} receipts${photoInfo}) using Replace Mode!`
        );
        setShowBackupsModal(false);
        if (onDataRestored) onDataRestored();
      } else {
        showToast('error', res.error || 'Failed to restore all backups');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error restoring all backups');
    } finally {
      setIsRestoringAll(false);
      setRestoreAllProgress(null);
    }
  };

  const handleConfirmRestore = async () => {
    setIsRestoring(true);
    try {
      let res;
      if (localJsonContent) {
        res = await GoogleDriveService.restoreFromLocalJson(localJsonContent, restoreMode);
      } else if (selectedBackupForRestore) {
        res = await GoogleDriveService.restoreBackup(selectedBackupForRestore.id, restoreMode);
      } else {
        return;
      }

      if (res.success) {
        const photosCount = res.itemCount?.photos || 0;
        const photoInfo = photosCount > 0 ? ` and ${photosCount} photos` : '';
        showToast('success', `Business data${photoInfo} successfully restored!`);
        setSelectedBackupForRestore(null);
        setLocalJsonContent(null);
        setShowBackupsModal(false);
        if (onDataRestored) onDataRestored();
      } else {
        showToast('error', res.error || 'Restore failed');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error restoring data');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setLocalJsonContent(content);
        setSelectedBackupForRestore({
          id: 'local_file',
          name: file.name,
          createdTime: new Date(file.lastModified).toISOString(),
          modifiedTime: new Date(file.lastModified).toISOString(),
          size: String(file.size),
          mimeType: 'application/json',
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Local data statistics
  const allReceipts = StorageService.getReceipts();
  const receiptsCount = allReceipts.filter((r) => (r.documentType || 'receipt') === 'receipt').length;
  const invoicesCount = allReceipts.filter((r) => r.documentType === 'invoice').length;
  const productsCount = StorageService.getInventoryProducts().length;
  const customersCount = StorageService.getCustomers().length;
  const photoStats = GoogleDriveService.getPhotoStats();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col pb-20">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center gap-3 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Sync to Google Drive
        </h1>
      </div>

      <div className="p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-md animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        )}

        {/* Hidden File Input for Local JSON Restores */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleLocalFileSelect}
          className="hidden"
        />

        {/* MAIN CARD: Google Drive Status Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start gap-3.5">
            {/* Blue cloud icon */}
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900 flex items-center justify-center shrink-0">
              <Cloud className="w-6 h-6 text-sky-500" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Sync to Google Drive
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {account?.connected && account.email ? account.email : 'Not connected'}
                </p>
                {account?.connected && (
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    disabled={isConnecting}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0 disabled:opacity-50"
                  >
                    Switch Account
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Badges: Status & Last Sync */}
          <div className="flex items-center gap-2 flex-wrap">
            {account?.connected ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Not connected</span>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
              <span>{account?.lastSyncTime ? account.lastSyncTime : 'Never synced'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1">
            {account?.connected ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="flex-1 py-3 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Tap to Sync'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="py-3 px-5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition shrink-0 active:scale-[0.98]"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleConnect(false)}
                disabled={isConnecting}
                className="w-full py-3 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening Google Accounts...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Connect Google Drive</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* SYNC TIPS CARD */}
        <div className="bg-[#fff9f3] dark:bg-[#1f1a14] rounded-3xl p-5 border border-[#fce8d5] dark:border-[#38291e] space-y-3">
          <div className="flex items-center gap-2 text-[#d96b27] dark:text-[#f59e0b]">
            <Lightbulb className="w-5 h-5 stroke-[2.2]" />
            <h3 className="font-bold text-sm text-[#2c1d11] dark:text-[#fef3c7]">
              Sync Tips
            </h3>
          </div>

          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5 leading-relaxed font-normal">
            <p>- Sync early to keep your data backed up on time.</p>
            <p>
              - Use the same Google Drive account to sync data across devices. Keep all devices
              updated to the same latest app version to avoid data conflicts.
            </p>
            <p>
              - If sync fails, check your internet connection, available Google Drive storage, and
              Google Drive access permissions, then try again.
            </p>
          </div>
        </div>

        {/* READY FOR BACKUP (DATA & PHOTOS) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Ready for Backup</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold lowercase">
                data &amp; photos
              </span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Saved to "Brivu Backups" Folder</span>
            </span>
          </div>

          {/* 5-Column Grid including Photos */}
          <div className="grid grid-cols-5 gap-1.5 text-center">
            <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
              <FileText className="w-3.5 h-3.5 mx-auto text-emerald-600 mb-0.5" />
              <div className="text-xs font-black text-slate-900 dark:text-white">{receiptsCount}</div>
              <div className="text-[9px] text-slate-400 truncate">Receipts</div>
            </div>

            <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
              <FileText className="w-3.5 h-3.5 mx-auto text-indigo-600 mb-0.5" />
              <div className="text-xs font-black text-slate-900 dark:text-white">{invoicesCount}</div>
              <div className="text-[9px] text-slate-400 truncate">Invoices</div>
            </div>

            <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
              <Package className="w-3.5 h-3.5 mx-auto text-amber-600 mb-0.5" />
              <div className="text-xs font-black text-slate-900 dark:text-white">{productsCount}</div>
              <div className="text-[9px] text-slate-400 truncate">Products</div>
            </div>

            <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
              <Users className="w-3.5 h-3.5 mx-auto text-sky-600 mb-0.5" />
              <div className="text-xs font-black text-slate-900 dark:text-white">{customersCount}</div>
              <div className="text-[9px] text-slate-400 truncate">Clients</div>
            </div>

            <div className="p-2 rounded-2xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-900/50">
              <Camera className="w-3.5 h-3.5 mx-auto text-blue-600 dark:text-blue-400 mb-0.5" />
              <div className="text-xs font-black text-blue-700 dark:text-blue-300">{photoStats.totalPhotos}</div>
              <div className="text-[9px] font-bold text-blue-500 truncate">Photos</div>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{photoStats.inventoryPhotos} product, {photoStats.clientPhotos} client, {photoStats.agentPhotos} agent, {photoStats.staffPhotos} staff photos</span>
            </span>
            <span className="font-bold text-slate-700 dark:text-slate-300">100% Protected</span>
          </div>
        </div>

        {/* RESTORE CARD: Clean single button card replacing the raw backup list */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Restore Data &amp; Photos</span>
            </h3>

            {account?.connected && backups.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {backups.length} {backups.length === 1 ? 'Backup' : 'Backups'} Available
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Access your saved cloud backups to restore your business records, products, inventory, clients, staff, and photos.
          </p>

          {/* Primary "Restore from Google Drive" Button */}
          <button
            type="button"
            onClick={handleOpenRestoreModal}
            disabled={isConnecting}
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2.5 active:scale-[0.98] transition disabled:opacity-50 group"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening Google Accounts...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Restore from Google Drive</span>
                <ChevronRight className="w-4 h-4 ml-auto opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          {/* Local File Import Fallback */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-1.5 mx-auto transition"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Or restore from downloaded JSON file</span>
            </button>
          </div>
        </div>
      </div>

      {/* DEDICATED BACKUPS MODAL */}
      {showBackupsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                    Google Drive Backups
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {account?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={loadBackups}
                  disabled={isFetchingBackups}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition"
                  title="Refresh Backups"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingBackups ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowBackupsModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="overflow-y-auto space-y-4 pr-0.5 flex-1">
              {isFetchingBackups ? (
                <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-400 gap-2.5">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span>Loading backup files from "Brivu Backups" folder...</span>
                </div>
              ) : backups.length === 0 && backupsError ? (
                <div className="text-center py-8 text-xs text-slate-400 space-y-3">
                  <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
                  <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                    Could not load Google Drive backups
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    {backupsError}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={loadBackups}
                      disabled={isFetchingBackups}
                      className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBackups ? 'animate-spin' : ''}`} />
                      <span>Retry Loading Backups</span>
                    </button>
                    {needsReconnect && (
                      <button
                        type="button"
                        onClick={() => handleConnect(true)}
                        disabled={isConnecting}
                        className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                      >
                        Reconnect Google Account
                      </button>
                    )}
                  </div>
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 space-y-3">
                  <Folder className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
                    No backup files found
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    No backup files were found in the "Brivu Backups" folder of your Google Drive account ({account?.email}).
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={loadBackups}
                      disabled={isFetchingBackups}
                      className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBackups ? 'animate-spin' : ''}`} />
                      <span>Check Again</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                    >
                      Create First Backup Now
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress overlay for Restore All */}
                  {isRestoringAll && (
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 space-y-2">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Restoring &amp; Merging All Backups...</span>
                      </div>
                      {restoreAllProgress && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            Processing backup file {restoreAllProgress.current} of {restoreAllProgress.total}
                          </div>
                          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full transition-all duration-300"
                              style={{ width: `${(restoreAllProgress.current / restoreAllProgress.total) * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {restoreAllProgress.file}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top Action Options: Restore All vs Restore Latest */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Quick Restore Options
                    </label>

                    {/* Button 1: Restore All Backups - Prominent Clickable Button */}
                    <button
                      type="button"
                      onClick={handleRestoreAllBackups}
                      disabled={isRestoringAll || isFetchingBackups}
                      className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-left shadow-lg shadow-emerald-700/25 border-2 border-emerald-400/50 transition-all active:scale-[0.98] disabled:opacity-50 group cursor-pointer block"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                            <Layers className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-white flex items-center gap-2">
                              <span>Restore All Backups</span>
                              <span className="text-[10px] bg-white/25 text-white px-2 py-0.5 rounded-full font-bold">
                                {backups.length} Files
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] bg-emerald-950/80 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-md uppercase tracking-wider font-black">
                                Replace Mode
                              </span>
                              <span className="text-[11px] text-emerald-100/90 truncate">
                                Restores all files &amp; photos into place
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Distinct clickable button pill */}
                        <div className="shrink-0">
                          <div className="px-3.5 py-2 rounded-xl bg-white text-emerald-800 font-extrabold text-xs shadow-md flex items-center gap-1.5 group-hover:bg-emerald-50 group-hover:scale-105 active:scale-95 transition-all">
                            <Download className="w-4 h-4 text-emerald-700" />
                            <span>Restore All</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Button 2: Restore Latest Backup */}
                    {backups.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBackupForRestore(backups[0])}
                        disabled={isRestoringAll}
                        className="w-full p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-slate-800 dark:text-slate-100 text-left hover:bg-sky-100/70 transition flex items-center justify-between group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-sky-900 dark:text-sky-200">
                              Restore Latest Backup
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {new Date(backups[0].modifiedTime || backups[0].createdTime).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 underline group-hover:translate-x-0.5 transition-transform shrink-0">
                          Select &rarr;
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Individual Backup Files Section */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Individual Backups ({backups.length})
                    </label>

                    <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                      {backups.map((file, idx) => (
                        <div
                          key={file.id}
                          className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2.5 hover:border-emerald-400 dark:hover:border-emerald-600 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <span>{file.name}</span>
                              {idx === 0 && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200">
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>
                                {new Date(file.modifiedTime || file.createdTime).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {file.size && (
                                <span className="font-mono text-slate-500">
                                  {(parseInt(file.size, 10) / 1024).toFixed(1)} KB
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedBackupForRestore(file)}
                            disabled={isRestoringAll}
                            className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition shrink-0 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Download className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowBackupsModal(false)}
                className="px-5 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Restoration with Merge & Replace Modes */}
      {selectedBackupForRestore && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Download className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Restore Business Data &amp; Photos
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Restore records and photos from{' '}
              <strong className="text-slate-900 dark:text-white font-mono break-all">
                {selectedBackupForRestore.name}
              </strong>
              ?
            </p>

            {/* Restored items notice */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-900 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Restores complete business files:</span>
              </div>
              <ul className="list-disc list-inside text-[10.5px] opacity-90 pl-1 space-y-0.5">
                <li>Inventory items &amp; product photos</li>
                <li>Clients, agents &amp; staff with profile photos</li>
                <li>Receipts, invoices &amp; transaction ledgers</li>
              </ul>
            </div>

            {/* Mode selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Restoration Mode
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreMode('replace')}
                  className={`p-2.5 rounded-2xl border text-left transition ${
                    restoreMode === 'replace'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>Replace Mode</span>
                    <span className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100">
                      Best
                    </span>
                  </div>
                  <div className="text-[9px] mt-0.5 opacity-80 leading-tight">
                    Fresh restore into all app records &amp; lists
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`p-2.5 rounded-2xl border text-left transition ${
                    restoreMode === 'merge'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">Merge Mode</div>
                  <div className="text-[9px] mt-0.5 opacity-80 leading-tight">
                    Keeps local items &amp; adds missing ones
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBackupForRestore(null);
                  setLocalJsonContent(null);
                }}
                className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex-1 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Restoring Files &amp; Photos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
