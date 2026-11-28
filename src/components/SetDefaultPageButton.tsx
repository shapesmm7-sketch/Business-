import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pin, CheckCircle2, X } from 'lucide-react';
import { DefaultStartPageConfig } from '../types';
import { StorageService } from '../services/storage';

interface SetDefaultPageButtonProps {
  config: DefaultStartPageConfig;
  variant?: 'light' | 'blue-header';
  compact?: boolean;
  onFeedback?: (message: string) => void;
}

export const isSameDefaultPage = (
  current: DefaultStartPageConfig,
  saved: DefaultStartPageConfig | null
): boolean => {
  if (!saved) {
    return current.screen === 'home';
  }
  if (current.screen !== saved.screen) return false;

  if (
    current.screen === 'create-receipt' ||
    current.screen === 'create-invoice' ||
    current.screen === 'create-quotation'
  ) {
    return (current.docTab || 'create') === (saved.docTab || 'create');
  }

  if (current.screen === 'inventory') {
    const curCat = current.inventoryCategory ?? null;
    const savCat = saved.inventoryCategory ?? null;
    if (curCat !== savCat) return false;
    if (curCat !== null) {
      return current.inventoryTab === saved.inventoryTab;
    }
    return true;
  }

  if (current.screen === 'qr-hosting') {
    return (current.qrCategory ?? null) === (saved.qrCategory ?? null);
  }

  return true;
};

export const SetDefaultPageButton: React.FC<SetDefaultPageButtonProps> = ({
  config,
  variant = 'light',
  compact = false,
  onFeedback,
}) => {
  const [savedDefault, setSavedDefault] = useState<DefaultStartPageConfig | null>(() =>
    StorageService.getDefaultStartPage()
  );
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [localToast, setLocalToast] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setSavedDefault(StorageService.getDefaultStartPage());
    };
    window.addEventListener('brivu_default_page_changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('brivu_default_page_changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isDefault = isSameDefaultPage(config, savedDefault);

  const showToast = (msg: string) => {
    if (onFeedback) {
      onFeedback(msg);
      return;
    }
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handleConfirmOk = () => {
    if (isDefault) {
      if (config.screen === 'home') {
        setIsConfirmModalOpen(false);
        return;
      }
      StorageService.setDefaultStartPage(null);
      setIsConfirmModalOpen(false);
      showToast('Default start page reset to Home');
    } else {
      StorageService.setDefaultStartPage(config);
      setIsConfirmModalOpen(false);
      showToast(
        config.screen === 'home'
          ? 'Home set as default start page'
          : `${config.label} set as default start page`
      );
    }
  };

  const buttonClasses =
    variant === 'blue-header'
      ? isDefault
        ? 'bg-white text-sky-700 border-white shadow-xs'
        : 'bg-white/15 hover:bg-white/25 text-white border-white/25'
      : isDefault
      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs'
      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmModalOpen(true)}
        title={
          isDefault
            ? `${config.label} is your default start page`
            : `Set ${config.label} as default start page`
        }
        aria-pressed={isDefault}
        className={`inline-flex items-center gap-1 rounded-xl border font-bold transition active:scale-95 cursor-pointer shrink-0 ${
          compact ? 'px-2 py-1.5 text-[11px]' : 'px-2.5 py-1 text-[11px]'
        } ${buttonClasses}`}
      >
        <Pin className={`w-3 h-3 shrink-0 ${isDefault ? 'fill-current' : ''}`} />
        <span className={compact ? 'hidden sm:inline' : ''}>
          {isDefault ? 'Default' : 'Set Default'}
        </span>
      </button>

      {isConfirmModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setIsConfirmModalOpen(false)}
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                      isDefault
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <Pin className={`w-4 h-4 ${isDefault ? '' : 'fill-current'}`} />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                    {isDefault
                      ? `Remove "${config.label}" as Default?`
                      : `Set "${config.label}" as Default Page?`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/70 dark:border-slate-700/60">
                {isDefault ? (
                  <>
                    <p>
                      Currently, the app opens straight to{' '}
                      <strong className="text-slate-900 dark:text-white">{config.label}</strong>{' '}
                      every time you launch it.
                    </p>
                    <p>
                      Click <strong>OK</strong> if you want the app to go back to opening on the{' '}
                      <strong className="text-slate-900 dark:text-white">Home</strong> page by default.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Setting a default page makes the app open directly to{' '}
                      <strong className="text-slate-900 dark:text-white">{config.label}</strong>{' '}
                      every time you launch it, so you do not have to switch pages each time.
                    </p>
                    <p>
                      You can still move to Home or any other page anytime, and you can change or remove this default whenever you want.
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOk}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm shadow-emerald-600/20 transition active:scale-98 cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {localToast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none px-4">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white text-xs font-bold shadow-2xl border border-emerald-500/40 flex items-center gap-2 whitespace-nowrap backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{localToast}</span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
