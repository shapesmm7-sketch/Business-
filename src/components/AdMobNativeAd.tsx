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

function isElementVisible(el: Element | null): boolean {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * AdMobNativeAd Component
 *
 * 1. ZERO mock HTML ads or sample cards are rendered in DOM / web preview (returns null).
 * 2. On Android native app, requests authentic live Native Advanced ads from Google AdMob SDK
 *    via NativeAdBridge/AdMobService using live AdMob ID ca-app-pub-8582659585800553/6584166086.
 * 3. Measures fixed header & bottom navigation bounds AND hit-tests the slot against all
 *    modals, drawers, popups, and sticky controls so the native ad stays strictly inside
 *    normal page flow and never covers app features or buttons.
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
    const slotEl = slotRef.current;
    const rect = slotEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 1. Determine safe vertical viewport bounds below sticky header and above fixed BottomNav
    let safeTop = 0;
    let safeBottom = window.innerHeight;

    const headerEl = document.querySelector('header');
    if (headerEl && isElementVisible(headerEl)) {
      const hRect = headerEl.getBoundingClientRect();
      if (hRect.top <= 4 && hRect.bottom < window.innerHeight * 0.45) {
        safeTop = Math.max(0, hRect.bottom);
      }
    }

    const bottomNavEl = document.querySelector('nav.fixed.bottom-0');
    if (bottomNavEl && isElementVisible(bottomNavEl)) {
      const nRect = bottomNavEl.getBoundingClientRect();
      if (nRect.top > window.innerHeight * 0.45) {
        safeBottom = Math.min(window.innerHeight, nRect.top);
      }
    }

    // 2. Hide native overlay whenever any modal, drawer, dialog, or backdrop is open in React tree or body
    const overlayCandidates = document.querySelectorAll('.fixed.inset-0, [role="dialog"], [aria-modal="true"]');
    let hasBlockingOverlay = false;
    for (let i = 0; i < overlayCandidates.length; i++) {
      const overlay = overlayCandidates[i];
      if (!overlay.contains(slotEl) && isElementVisible(overlay)) {
        hasBlockingOverlay = true;
        break;
      }
    }

    // 3. Hit-test multiple horizontal points along the slot's visible strip to guarantee no UI feature covers it
    const visibleTop = Math.max(rect.top, safeTop);
    const visibleBottom = Math.min(rect.bottom, safeBottom);
    const visibleHeight = visibleBottom - visibleTop;

    let isOccludedByFeature = false;
    if (!hasBlockingOverlay && visibleHeight > 4 && rect.width > 20) {
      const sampleY = visibleTop + visibleHeight / 2;
      const sampleXs = [
        Math.min(window.innerWidth - 2, Math.max(2, rect.left + 16)),
        Math.min(window.innerWidth - 2, Math.max(2, rect.left + rect.width / 2)),
        Math.min(window.innerWidth - 2, Math.max(2, rect.right - 16)),
      ];

      for (const sx of sampleXs) {
        const hitEl = document.elementFromPoint(sx, sampleY);
        if (hitEl && hitEl !== slotEl && !slotEl.contains(hitEl)) {
          isOccludedByFeature = true;
          break;
        }
      }
    }

    const isVisibleInViewport =
      !hasBlockingOverlay &&
      !isOccludedByFeature &&
      safeBottom > safeTop + 12 &&
      rect.bottom > safeTop + 4 &&
      rect.top < safeBottom - 4 &&
      rect.width > 0 &&
      rect.height > 0;

    NativeAdBridge.updatePosition({
      x: Math.round(rect.left * dpr),
      y: Math.round(rect.top * dpr),
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr),
      clipTop: Math.round(safeTop * dpr),
      clipBottom: Math.round(safeBottom * dpr),
      visible: isVisibleInViewport,
      slotId: slotIdRef.current,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !AdMobService.shouldShowAds()) return;
    const slotId = slotIdRef.current;

    let rafId: number | null = null;
    const scheduleSync = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncSlotPosition();
      });
    };

    // Request/preload live AdMob native advanced ad
    AdMobService.requestNativeAd(unitId).catch(() => {});

    // Sync position as DOM settles
    const t1 = setTimeout(syncSlotPosition, 50);
    const t2 = setTimeout(syncSlotPosition, 160);
    const t3 = setTimeout(syncSlotPosition, 400);
    const t4 = setTimeout(syncSlotPosition, 800);

    // Capture scroll on document as well as window so inner scrollable containers update coordinates
    document.addEventListener('scroll', scheduleSync, { passive: true, capture: true });
    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync, { passive: true });

    // Observers for instant detection when screen transitions, modals open anywhere in React, or layout shifts
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    if (typeof IntersectionObserver !== 'undefined' && slotRef.current) {
      io = new IntersectionObserver(scheduleSync, {
        threshold: [0, 0.25, 0.5, 0.75, 1],
      });
      io.observe(slotRef.current);
    }
    if (typeof ResizeObserver !== 'undefined' && slotRef.current) {
      ro = new ResizeObserver(scheduleSync);
      ro.observe(slotRef.current);
    }
    if (typeof MutationObserver !== 'undefined' && document.body) {
      mo = new MutationObserver(scheduleSync);
      mo.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      document.removeEventListener('scroll', scheduleSync, { capture: true });
      window.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      // Only hide native overlay if this unmounting slot is still the active owner
      NativeAdBridge.hideNativeAd({ slotId }).catch(() => {});
    };
  }, [unitId, syncSlotPosition]);

  // If on web / preview, return null so zero fake cards or HTML placeholders appear
  if (!Capacitor.isNativePlatform() || !AdMobService.shouldShowAds()) {
    return null;
  }

  // Reserve exact inline card height (84px accommodates headline, body & optional star rating with zero bleed)
  return (
    <div
      ref={slotRef}
      data-admob-slot={context}
      className={`w-full h-[84px] my-1 rounded-2xl transition-all ${className}`}
      aria-hidden="true"
    />
  );
};
