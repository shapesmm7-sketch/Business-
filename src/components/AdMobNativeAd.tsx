import React, { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_UNITS, AdMobService } from '../services/admobService';
import { NativeAdBridge } from '../services/nativeAdBridge';

export interface AdMobNativeAdProps {
  unitId?: string;
  variant?: 'card' | 'compact' | 'in-feed' | 'banner' | 'bottom';
  context?: 'inventory' | 'receipts' | 'invoices' | 'qr' | 'general' | 'home';
  className?: string;
}

let slotSequence = 0;

/**
 * AdMobNativeAd Component
 *
 * 1. ZERO mock HTML ads or sample cards are rendered in DOM / web preview (returns null).
 * 2. On Android native app, requests authentic live Native Advanced ads from Google AdMob SDK
 *    via NativeAdBridge/AdMobService using live AdMob ID ca-app-pub-8582659585800553/6584166086.
 * 3. Positioned inline within page content via measured slot coordinates and unique slotId ownership
 *    so unmounting slots never hide a newly mounted screen's ad.
 */
export const AdMobNativeAd: React.FC<AdMobNativeAdProps> = ({
  unitId = ADMOB_UNITS.NATIVE_ADVANCED,
  context = 'general',
  className = '',
}) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const slotIdRef = useRef<string>(`native-slot-${++slotSequence}`);

  const syncSlotPosition = useCallback(() => {
    if (!Capacitor.isNativePlatform() || !slotRef.current) return;
    const rect = slotRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Check if slot is within visible viewport area
    const isVisibleInViewport =
      rect.bottom > 10 &&
      rect.top < window.innerHeight - 10 &&
      rect.width > 0 &&
      rect.height > 0;

    NativeAdBridge.updatePosition({
      x: Math.round(rect.left * dpr),
      y: Math.round(rect.top * dpr),
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr),
      visible: isVisibleInViewport,
      slotId: slotIdRef.current,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !AdMobService.shouldShowAds()) return;
    const slotId = slotIdRef.current;

    // Request/preload live AdMob native advanced ad
    AdMobService.requestNativeAd(unitId).catch(() => {});

    // Sync position as DOM settles
    const t1 = setTimeout(syncSlotPosition, 50);
    const t2 = setTimeout(syncSlotPosition, 150);
    const t3 = setTimeout(syncSlotPosition, 400);
    const t4 = setTimeout(syncSlotPosition, 800);

    // Capture scroll on document as well as window so inner scrollable containers update coordinates
    document.addEventListener('scroll', syncSlotPosition, { passive: true, capture: true });
    window.addEventListener('scroll', syncSlotPosition, { passive: true });
    window.addEventListener('resize', syncSlotPosition, { passive: true });

    // Observers for instant detection when screen transitions or layout shifts
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && slotRef.current) {
      io = new IntersectionObserver(() => syncSlotPosition(), {
        threshold: [0, 0.5, 1],
      });
      io.observe(slotRef.current);
    }
    if (typeof ResizeObserver !== 'undefined' && slotRef.current) {
      ro = new ResizeObserver(() => syncSlotPosition());
      ro.observe(slotRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      document.removeEventListener('scroll', syncSlotPosition, { capture: true });
      window.removeEventListener('scroll', syncSlotPosition);
      window.removeEventListener('resize', syncSlotPosition);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      // Only hide native overlay if this unmounting slot is still the active owner
      NativeAdBridge.hideNativeAd({ slotId }).catch(() => {});
    };
  }, [unitId, syncSlotPosition]);

  // If on web / preview, return null so zero fake cards or HTML placeholders appear
  if (!Capacitor.isNativePlatform() || !AdMobService.shouldShowAds()) {
    return null;
  }

  // On Android native app, reserve exact inline card space in content flow
  return (
    <div
      ref={slotRef}
      data-admob-slot={context}
      className={`w-full h-[74px] rounded-2xl pointer-events-none transition-all ${className}`}
      aria-hidden="true"
    />
  );
};
