import React, { useState, useEffect } from 'react';
import {
  Download,
  RefreshCw,
  Sparkles,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  PlayUpdateInfo,
  PlayUpdateService,
  PlayUpdateStateEvent,
  PLAY_INSTALL_STATUS,
} from '../services/playUpdateService';

interface AppUpdatePromptModalProps {
  isOpen: boolean;
  updateInfo: PlayUpdateInfo | null;
  updateState: PlayUpdateStateEvent | null;
  currentVersionName?: string;
  onDismiss: () => void;
  onStartUpdate: () => Promise<void>;
  onCompleteUpdate: () => Promise<void>;
  onOpenPlayStore: () => Promise<void>;
  isLaunching?: boolean;
  errorMessage?: string | null;
}

export const AppUpdatePromptModal: React.FC<AppUpdatePromptModalProps> = ({
  isOpen,
  updateInfo,
  updateState,
  currentVersionName = '1.8.0',
  onDismiss,
  onStartUpdate,
  onCompleteUpdate,
  onOpenPlayStore,
  isLaunching = false,
  errorMessage = null,
}) => {
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsRestarting(false);
    }
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const isMandatory = PlayUpdateService.isMandatoryOrImmediate(updateInfo);
  const isDownloaded = Boolean(
    updateState?.downloaded ||
      updateState?.installStatus === PLAY_INSTALL_STATUS.DOWNLOADED ||
      updateInfo.downloaded ||
      updateInfo.installStatus === PLAY_INSTALL_STATUS.DOWNLOADED
  );
  const isDownloading = Boolean(
    !isDownloaded &&
      (updateState?.downloading ||
        updateState?.installStatus === PLAY_INSTALL_STATUS.DOWNLOADING ||
        updateState?.installStatus === PLAY_INSTALL_STATUS.PENDING)
  );
  const isInstalling = Boolean(
    updateState?.installing ||
      updateState?.installStatus === PLAY_INSTALL_STATUS.INSTALLING
  );

  const bytesDownloaded = updateState?.bytesDownloaded ?? updateInfo.bytesDownloaded ?? 0;
  const totalBytes = updateState?.totalBytesToDownload ?? updateInfo.totalBytesToDownload ?? 0;
  const progressPercent =
    totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : 0;

  const formatMb = (bytes: number) => {
    if (!bytes || bytes <= 0) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  };

  const sizeLabel = formatMb(totalBytes);

  const handleRestartInstall = async () => {
    setIsRestarting(true);
    try {
      await onCompleteUpdate();
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div
      id="modal-play-app-update"
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Accent Header */}
        <div className="p-5 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/15 blur-xl pointer-events-none" />

          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 shadow-sm">
                {isDownloaded ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : isDownloading || isInstalling ? (
                  <RefreshCw className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Sparkles className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white border border-white/20 mb-1">
                  {isDownloaded
                    ? 'Ready to Install'
                    : isMandatory
                    ? 'Required Update'
                    : 'Google Play Update'}
                </span>
                <h2 className="text-base font-black leading-tight">
                  {isDownloaded
                    ? 'Update Downloaded!'
                    : isDownloading
                    ? 'Downloading Update...'
                    : 'New Update Available'}
                </h2>
              </div>
            </div>

            {!isMandatory && !isInstalling && (
              <button
                id="btn-close-update-modal"
                type="button"
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer shrink-0"
                aria-label="Later"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              {isDownloaded
                ? 'The latest version of Brivu has been downloaded from Google Play. Restart the app now to complete the installation.'
                : isDownloading
                ? 'Brivu is downloading the newest improvements in the background. You can continue working while the download finishes.'
                : 'A newer version of Brivu is available on Google Play with the latest fixes, performance improvements, and features. Please update your app for the best experience.'}
            </p>

            {/* Version & Size Details */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Installed: v{currentVersionName}
              </span>
              {updateInfo.availableVersionCode ? (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Play Build #{updateInfo.availableVersionCode}
                </span>
              ) : null}
              {sizeLabel ? (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {sizeLabel}
                </span>
              ) : null}
            </div>
          </div>

          {/* Download Progress Bar */}
          {(isDownloading || isInstalling) && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  {isInstalling ? 'Installing update...' : 'Downloading from Google Play'}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {totalBytes > 0 ? `${progressPercent}%` : '...'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${totalBytes > 0 ? progressPercent : 35}%` }}
                />
              </div>
              {totalBytes > 0 && (
                <div className="text-[10px] text-slate-400 font-mono text-right">
                  {formatMb(bytesDownloaded)} / {formatMb(totalBytes)}
                </div>
              )}
            </div>
          )}

          {/* Error Notice + Fallback Note */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {isDownloaded ? (
              <button
                id="btn-complete-play-update"
                type="button"
                disabled={isRestarting}
                onClick={handleRestartInstall}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isRestarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{isRestarting ? 'Restarting to Install...' : 'Restart & Install Update'}</span>
              </button>
            ) : !isDownloading && !isInstalling ? (
              <button
                id="btn-start-play-update"
                type="button"
                disabled={isLaunching}
                onClick={onStartUpdate}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLaunching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isLaunching ? 'Opening Google Play...' : 'Update App Now'}</span>
              </button>
            ) : null}

            {errorMessage && (
              <button
                id="btn-open-play-store-fallback"
                type="button"
                onClick={onOpenPlayStore}
                className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Google Play Store</span>
              </button>
            )}

            {!isMandatory && !isInstalling && (
              <button
                id="btn-later-play-update"
                type="button"
                onClick={onDismiss}
                className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                {isDownloading ? 'Continue in Background' : 'Remind Me Later'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
