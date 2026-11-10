import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  Folder,
  FileText,
  Package,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  Trash2,
  ShieldCheck,
  HardDrive,
  LogOut,
  Info,
} from 'lucide-react';
import { GoogleDriveService, DriveBackupFile } from '../services/googleDriveService';
import { StorageService } from '../services/storage';
import { User } from 'firebase/auth';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFetchingBackups, setIsFetchingBackups] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [customFilename, setCustomFilename] = useState(
    `brivu_text_backup_${new Date().toISOString().split('T')[0]}.json`
  );
  const [backupsList, setBackupsList] = useState<DriveBackupFile[]>([]);
  const [selectedBackupForImport, setSelectedBackupForImport] = useState<DriveBackupFile | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize Auth Listener on mount
  useEffect(() => {
    if (!isOpen) return;

    const token = GoogleDriveService.getCachedToken();
    const user = GoogleDriveService.getCurrentUser();
    if (token && user) {
      setAccessToken(token);
      setCurrentUser(user);
      fetchBackups(token);
    }

    const unsubscribe = GoogleDriveService.initAuthListener(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        fetchBackups(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setBackupsList([]);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await GoogleDriveService.signInWithGoogle();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        showToast('success', `Signed in as ${res.user.email}`);
        fetchBackups(res.accessToken);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Google Drive sign in failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await GoogleDriveService.logout();
    setCurrentUser(null);
    setAccessToken(null);
    setBackupsList([]);
    showToast('success', 'Signed out of Google Drive');
  };

  const fetchBackups = async (tokenToUse?: string) => {
    const activeToken = tokenToUse || accessToken;
    if (!activeToken) return;

    setIsFetchingBackups(true);
    try {
      const files = await GoogleDriveService.listBackupsFromDrive(activeToken);
      setBackupsList(files);
    } catch (err) {
      console.warn('Failed listing backups:', err);
    } finally {
      setIsFetchingBackups(false);
    }
  };

  const handleExportToDrive = async () => {
    if (!accessToken) {
      handleSignIn();
      return;
    }

    setIsExporting(true);
    try {
      const res = await GoogleDriveService.exportBackupToDrive(accessToken, customFilename);
      if (res.success) {
        showToast('success', `Successfully backed up to Google Drive: ${res.fileName}`);
        fetchBackups(accessToken);
      } else {
        showToast('error', res.error || 'Export to Google Drive failed');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error creating Google Drive backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    if (!accessToken || !selectedBackupForImport) return;

    setIsImporting(true);
    try {
      const res = await GoogleDriveService.importBackupFromDrive(
        accessToken,
        selectedBackupForImport.id,
        mergeMode
      );

      if (res.success) {
        showToast('success', 'Data successfully restored from Google Drive!');
        setSelectedBackupForImport(null);
        if (onDataRestored) onDataRestored();
      } else {
        showToast('error', res.error || 'Failed to import backup file');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error restoring data from Google Drive');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  // Local data statistics
  const allReceipts = StorageService.getReceipts();
  const receiptsCount = allReceipts.filter((r) => (r.documentType || 'receipt') === 'receipt').length;
  const invoicesCount = allReceipts.filter((r) => r.documentType === 'invoice').length;
  const productsCount = StorageService.getInventoryProducts().length;
  const customersCount = StorageService.getCustomers().length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-sky-100 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Google Drive Data Sync</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold uppercase">
                  Text Only
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Export & restore business data as lightweight text JSON files</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Notification Toast */}
          {toastMessage && (
            <div
              className={`p-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="flex-1">{toastMessage.text}</span>
            </div>
          )}

          {/* User Auth Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
            {currentUser && accessToken ? (
              <div className="flex items-center gap-3 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google Account'}
                    className="w-10 h-10 rounded-full border-2 border-indigo-500 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center shrink-0">
                    {currentUser.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {currentUser.displayName || 'Google Account Connected'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Drive Permission Granted</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Connect Google Drive
                </div>
                <div className="text-[11px] text-slate-400">
                  Sign in to export and restore your receipts, invoices, and inventory text data.
                </div>
              </div>
            )}

            <div>
              {currentUser && accessToken ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="gsi-material-button px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Storage Architecture Note */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl p-3 border border-indigo-100 dark:border-indigo-900/60 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-indigo-900 dark:text-indigo-200 leading-snug">
              <strong className="font-bold">Text-Only Backup:</strong> PDF files and images are never uploaded to Drive to keep your storage footprint practically zero (&lt; 50 KB). Receipts and invoices are re-generated on-demand whenever needed.
            </p>
          </div>

          {/* SECTION 1: EXPORT / BACKUP TO DRIVE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-sky-100 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <CloudUpload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-white">
                1. Backup Data to Google Drive
              </h3>
            </div>

            {/* Current Data Summary Badges */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <FileText className="w-3.5 h-3.5 mx-auto text-emerald-600 mb-0.5" />
                <div className="text-xs font-black text-slate-900 dark:text-white">{receiptsCount}</div>
                <div className="text-[9px] font-bold text-slate-400">Receipts</div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <FileText className="w-3.5 h-3.5 mx-auto text-indigo-600 mb-0.5" />
                <div className="text-xs font-black text-slate-900 dark:text-white">{invoicesCount}</div>
                <div className="text-[9px] font-bold text-slate-400">Invoices</div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Package className="w-3.5 h-3.5 mx-auto text-amber-600 mb-0.5" />
                <div className="text-xs font-black text-slate-900 dark:text-white">{productsCount}</div>
                <div className="text-[9px] font-bold text-slate-400">Products</div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Users className="w-3.5 h-3.5 mx-auto text-sky-600 mb-0.5" />
                <div className="text-xs font-black text-slate-900 dark:text-white">{customersCount}</div>
                <div className="text-[9px] font-bold text-slate-400">Clients</div>
              </div>
            </div>

            {/* Custom Filename */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Backup Filename (.json)
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleExportToDrive}
              disabled={isExporting}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading to Google Drive...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>Backup Text Data to Drive</span>
                </>
              )}
            </button>
          </div>

          {/* SECTION 2: IMPORT / RESTORE FROM DRIVE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-sky-100 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <CloudDownload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-white">
                  2. Restore Data from Google Drive
                </h3>
              </div>

              {accessToken && (
                <button
                  type="button"
                  onClick={() => fetchBackups(accessToken)}
                  disabled={isFetchingBackups}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition"
                  title="Refresh Backups List"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBackups ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {!accessToken ? (
              <div className="text-center py-4 text-xs text-slate-400">
                Sign in with Google above to view your saved Google Drive backups.
              </div>
            ) : isFetchingBackups ? (
              <div className="flex items-center justify-center py-6 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Checking your Brivu Business Data folder...</span>
              </div>
            ) : backupsList.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 space-y-1">
                <Folder className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                <p>No backup files found in your Google Drive yet.</p>
                <p className="text-[10px] text-slate-500">Click "Backup Text Data to Drive" above to create your first backup.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {backupsList.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 hover:border-indigo-300 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
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
                      onClick={() => setSelectedBackupForImport(file)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-xs active:scale-95 transition shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Restore Confirmation Dialog Modal */}
        {selectedBackupForImport && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full border border-sky-100 dark:border-slate-800 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Confirm Data Restoration
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You are about to restore business records from{' '}
                <strong className="font-bold text-slate-900 dark:text-white">{selectedBackupForImport.name}</strong>.
              </p>

              {/* Merge Strategy Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Restoration Mode
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMergeMode('merge')}
                    className={`p-3 rounded-xl border text-left transition ${
                      mergeMode === 'merge'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-black">Merge Mode</div>
                    <div className="text-[10px] mt-0.5 opacity-80">Combines missing items, preserves existing records</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMergeMode('replace')}
                    className={`p-3 rounded-xl border text-left transition ${
                      mergeMode === 'replace'
                        ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-black">Replace Mode</div>
                    <div className="text-[10px] mt-0.5 opacity-80">Replaces current records with backup file data</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBackupForImport(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleImportBackup}
                  disabled={isImporting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Restoring...</span>
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
    </div>,
    document.body
  );
};
