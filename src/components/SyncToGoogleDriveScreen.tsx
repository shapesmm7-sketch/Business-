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
  ExternalLink,
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
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<DriveBackupFile | null>(null);
  const [localJsonContent, setLocalJsonContent] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
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
    try {
      const files = await GoogleDriveService.listBackups();
      setBackups(files);
    } catch (e) {
      console.warn('Failed loading backups list:', e);
    } finally {
      setIsFetchingBackups(false);
    }
  };

  /**
   * Opens Google's REAL account selection and authorization interface
   * using official Google Identity Services (GIS) / Google Play Services
   */
  const handleConnect = async (autoRestore = false) => {
    setIsConnecting(true);
    try {
      const connectedAccount = await GoogleDriveService.connectGoogleDrive();
      setAccount(connectedAccount);
      showToast('success', `Connected to Google Drive as ${connectedAccount.email}`);
      const files = await GoogleDriveService.listBackups();
      setBackups(files);

      if (autoRestore && files.length > 0) {
        setSelectedBackupForRestore(files[0]);
      }
    } catch (err: any) {
      console.error('Google authorization error:', err);
      showToast('error', err?.message || 'Google account authorization was cancelled or failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await GoogleDriveService.disconnectGoogleDrive();
      setAccount(null);
      setBackups([]);
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
        showToast('success', `Business data${photoInfo} successfully restored from Google Drive!`);
        setSelectedBackupForRestore(null);
        setLocalJsonContent(null);
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
                    onClick={() => handleConnect(false)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0"
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

        {/* RESTORE SECTION: View and restore backups from Google Drive */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Restore from Google Drive</span>
            </h3>

            {account?.connected && (
              <button
                type="button"
                onClick={loadBackups}
                disabled={isFetchingBackups}
                className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Refresh Google Drive Backups"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBackups ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Action Button: When not connected */}
          {!account?.connected ? (
            <div className="py-2 space-y-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Connect your Google Drive account to view and restore your backed-up inventory, clients, agents, staff photos, receipts, and invoices.
              </p>

              <button
                type="button"
                onClick={() => handleConnect(true)}
                disabled={isConnecting}
                className="w-full py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening Google Accounts...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Connect &amp; Restore from Google Drive</span>
                  </>
                )}
              </button>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                >
                  Or restore from a local backup file (.json)
                </button>
              </div>
            </div>
          ) : isFetchingBackups ? (
            <div className="flex items-center justify-center py-6 text-xs text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Checking your "Brivu Backups" folder in Google Drive...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 space-y-3">
              <Folder className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                No backup files found in "Brivu Backups" folder on this Google Drive account.
              </p>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                Tap "Tap to Sync" above to create your first backup in your Google Drive, or restore from a downloaded .json backup file below.
              </p>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSyncNow}
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                >
                  Backup Now
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Import Local File
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Restore Latest Button */}
              {backups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBackupForRestore(backups[0])}
                  className="w-full py-2.5 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-between hover:bg-emerald-100/70 transition group"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Restore Latest Backup ({new Date(backups[0].modifiedTime || backups[0].createdTime).toLocaleDateString()})</span>
                  </span>
                  <span className="text-[11px] underline group-hover:translate-x-0.5 transition-transform">
                    Restore Now &rarr;
                  </span>
                </button>
              )}

              {/* Backups List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
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
                      className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition shrink-0 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Local File Fallback Option */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-1.5 mx-auto transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore from downloaded JSON file</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  onClick={() => setRestoreMode('merge')}
                  className={`p-2.5 rounded-2xl border text-left transition ${
                    restoreMode === 'merge'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">Merge Mode</div>
                  <div className="text-[9px] mt-0.5 opacity-80 leading-tight">
                    Keeps local items &amp; adds missing ones
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode('replace')}
                  className={`p-2.5 rounded-2xl border text-left transition ${
                    restoreMode === 'replace'
                      ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">Replace Mode</div>
                  <div className="text-[9px] mt-0.5 opacity-80 leading-tight">
                    Fresh restore after reinstall / new phone
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
