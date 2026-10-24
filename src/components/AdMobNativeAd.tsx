import React, { useEffect } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_UNITS, AdMobService } from '../services/admobService';

interface AdMobNativeAdProps {
  unitId?: string;
  variant?: 'card' | 'compact' | 'in-feed' | 'banner' | 'bottom';
  context?: 'inventory' | 'receipts' | 'invoices' | 'qr' | 'general' | 'home';
  className?: string;
}

export const AdMobNativeAd: React.FC<AdMobNativeAdProps> = ({
  unitId = ADMOB_UNITS.NATIVE_ADVANCED,
  variant = 'in-feed',
  context = 'general',
  className = '',
}) => {
  const shouldShow = AdMobService.shouldShowAds();

  useEffect(() => {
    // When running inside Android native application, keep requests active
    if (Capacitor.isNativePlatform() && shouldShow) {
      AdMobService.initNativeAdMob().catch(() => {});
    }
  }, [unitId, variant, context, shouldShow]);

  if (!shouldShow || !Capacitor.isNativePlatform()) return null;

  const isBottom = variant === 'bottom';
  const isCompact = variant === 'compact';

  return (
    <div
      className={`w-full overflow-hidden transition-all duration-200 ${
        isBottom
          ? 'my-3 pt-1'
          : isCompact
          ? 'my-2'
          : 'my-3'
      } ${className}`}
      data-ad-unit={unitId}
      data-ad-type="native-advanced"
    >
      <div className="bg-gradient-to-r from-slate-50 via-white to-sky-50/40 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-800/80 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-2.5">
        {/* Top Header Row with Ad attribution */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase">
              Ad
            </span>
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              Google AdMob Native Advanced
            </span>
          </div>
          <span className="text-[9px] font-mono font-medium text-slate-400 dark:text-slate-500 truncate max-w-[170px]">
            {unitId}
          </span>
        </div>

        {/* Content Body */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                Official Google Mobile Ads Test Unit
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Test Native Advanced ad serving correctly
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              AdMobService.recordInteraction();
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] shadow-xs flex items-center gap-1 transition active:scale-95"
          >
            <span>Learn More</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
