import React, { useEffect, useRef, useCallback, useState } from 'react';
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

function isFixedOrStickyElement(el: Element | null): boolean {
  let curr: Element | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const pos = window.getComputedStyle(curr).position;
    if (pos === 'fixed' || pos === 'sticky') {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

/**
 * AdMobNativeAd Component
 *
 * 1. ZERO mock HTML ads or sample cards are rendered in DOM / web preview (returns null).
 * 2. On Android native app, requests authentic live Native Advanced ads from Google AdMob SDK
 *    via NativeAdBridge/AdMobService using live AdMob ID ca-app-pub-8582659585800553/6584166086.
 * 3. Measures fixed header & bottom navigation bounds, ignores non-blocking pointer-events-none toasts,
 *    and sends document-locked scroll coordinates so each ad slot stays rock-solid in place
 *    without disappearing or shaking during scroll.
 */
export const AdMobNativeAd: React.FC<AdMobNativeAdProps> = ({
  unitId = ADMOB_UNITS.NATIVE_ADVANCED,
  context = 'general',
  className = '',
}) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const slotIdRef = useRef<string>(`native-slot-${++slotSequence}`);
  const lastPayloadRef = useRef<string>('');
  const [adsAllowed, setAdsAllowed] = useState<boolean>(() => AdMobService.shouldShowAds());

  useEffect(() => {
    const syncAllowed = () => {
      const next = AdMobService.shouldShowAds();
      setAdsAllowed(next);
      if (!next && Capacitor.isNativePlatform()) {
        NativeAdBridge.hideNativeAd({ slotId: slotIdRef.current, remove: true }).catch(() => {});
      }
    };
    syncAllowed();
    window.addEventListener('brivu_subscription_changed', syncAllowed);
    window.addEventListener('brivu_data_refreshed', syncAllowed);
    window.addEventListener('brivu_data_restored', syncAllowed);
    window.addEventListener('storage', syncAllowed);
    return () => {
      window.removeEventListener('brivu_subscription_changed', syncAllowed);
      window.removeEventListener('brivu_data_refreshed', syncAllowed);
      window.removeEventListener('brivu_data_restored', syncAllowed);
      window.removeEventListener('storage', syncAllowed);
    };
  }, []);

  const syncSlotPosition = useCallback((force = false) => {
    if (!Capacitor.isNativePlatform() || !slotRef.current) return;
    if (!AdMobService.shouldShowAds()) {
      NativeAdBridge.hideNativeAd({ slotId: slotIdRef.current, remove: true }).catch(() => {});
      return;
    }
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

    // 2. Hide native overlay whenever any interactive blocking modal, drawer, or dialog is open
    // Ignore pointer-events-none wrappers (such as centered toast notifications)
    const overlayCandidates = document.querySelectorAll('.fixed.inset-0, [role="dialog"], [aria-modal="true"]');
    let hasBlockingOverlay = false;
    for (let i = 0; i < overlayCandidates.length; i++) {
      const overlay = overlayCandidates[i];
      if (!overlay.contains(slotEl) && isElementVisible(overlay)) {
        const style = window.getComputedStyle(overlay);
        if (style.pointerEvents !== 'none') {
          hasBlockingOverlay = true;
          break;
        }
      }
    }

    // 3. Only treat fixed/sticky overlays at the slot center as occluding (prevents false hides on scroll)
    const visibleTop = Math.max(rect.top, safeTop);
    const visibleBottom = Math.min(rect.bottom, safeBottom);
    const visibleHeight = visibleBottom - visibleTop;

    let isOccludedByFeature = false;
    if (!hasBlockingOverlay && visibleHeight > 6 && rect.width > 20) {
      const sampleY = visibleTop + visibleHeight / 2;
      const sampleX = Math.min(window.innerWidth - 2, Math.max(2, rect.left + rect.width / 2));
      const hitEl = document.elementFromPoint(sampleX, sampleY);
      if (
        hitEl &&
        hitEl !== slotEl &&
        !slotEl.contains(hitEl) &&
        !hitEl.contains(slotEl) &&
        isFixedOrStickyElement(hitEl)
      ) {
        isOccludedByFeature = true;
      }
    }

    const isVisibleInViewport =
      !hasBlockingOverlay &&
      !isOccludedByFeature &&
      safeBottom > safeTop + 12 &&
      rect.bottom > safeTop + 2 &&
      rect.top < safeBottom - 2 &&
      rect.width > 0 &&
      rect.height > 0;

    const payload = {
      x: Math.round(rect.left * dpr),
      y: Math.round(rect.top * dpr),
      width: Math.round(rect.width * dpr),
      height: Math.round(rect.height * dpr),
      clipTop: Math.round(safeTop * dpr),
      clipBottom: Math.round(safeBottom * dpr),
      scrollX: Math.round(window.scrollX * dpr),
      scrollY: Math.round(window.scrollY * dpr),
      visible: isVisibleInViewport,
      slotId: slotIdRef.current,
    };

    const payloadKey = `${payload.x}:${payload.y}:${payload.width}:${payload.height}:${payload.clipTop}:${payload.clipBottom}:${payload.scrollY}:${payload.visible ? 1 : 0}`;
    if (!force && lastPayloadRef.current === payloadKey) {
      return;
    }
    lastPayloadRef.current = payloadKey;

    NativeAdBridge.updatePosition(payload).catch(() => {});
  }, []);

  useEffect(() => {
    const slotId = slotIdRef.current;
    if (!Capacitor.isNativePlatform()) return;
    if (!adsAllowed || !AdMobService.shouldShowAds()) {
      NativeAdBridge.hideNativeAd({ slotId, remove: true }).catch(() => {});
      return;
    }

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

    // Sync position promptly as DOM and route animations settle
    const initialRaf = window.requestAnimationFrame(() => syncSlotPosition(true));
    const t1 = setTimeout(() => syncSlotPosition(), 80);
    const t2 = setTimeout(() => syncSlotPosition(), 240);
    const t3 = setTimeout(() => syncSlotPosition(), 600);
    const t4 = setTimeout(() => syncSlotPosition(true), 1200);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSlotPosition(true);
      }
    };
    const handlePageShow = () => syncSlotPosition(true);

    // Sync when scroll finishes, DOM resizes, or CSS route transitions end
    document.addEventListener('scroll', scheduleSync, { passive: true, capture: true });
    document.addEventListener('animationend', scheduleSync, { passive: true, capture: true });
    document.addEventListener('transitionend', scheduleSync, { passive: true, capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow, { passive: true });
    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync, { passive: true });

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
    // Watch only childList mutations on document.body (portals/modals) and main container to avoid scroll jitter
    if (typeof MutationObserver !== 'undefined' && document.body) {
      mo = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes.length > 0 || mutations[i].removedNodes.length > 0) {
            scheduleSync();
            return;
          }
        }
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.cancelAnimationFrame(initialRaf);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      document.removeEventListener('scroll', scheduleSync, { capture: true });
      document.removeEventListener('animationend', scheduleSync, { capture: true });
      document.removeEventListener('transitionend', scheduleSync, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      lastPayloadRef.current = '';
      NativeAdBridge.hideNativeAd({ slotId, remove: true }).catch(() => {});
    };
  }, [unitId, syncSlotPosition, adsAllowed]);

  // If on web / preview, or user is subscribed (Ad-Free Pro), return null so zero ads appear
  if (!Capacitor.isNativePlatform() || !adsAllowed || !AdMobService.shouldShowAds()) {
    return null;
  }

  // Reserve exact inline card height (84px accommodates headline, body & optional star rating with zero bleed)
  return (
    <div
      ref={slotRef}
      data-admob-slot={context}
      className={`w-full h-[84px] my-1 rounded-2xl ${className}`}
      aria-hidden="true"
    />
  );
};
