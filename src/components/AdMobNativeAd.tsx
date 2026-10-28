import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_UNITS, AdMobService } from '../services/admobService';

export interface AdMobNativeAdProps {
  unitId?: string;
  variant?: 'card' | 'compact' | 'in-feed' | 'banner' | 'bottom';
  context?: 'inventory' | 'receipts' | 'invoices' | 'qr' | 'general' | 'home';
  className?: string;
}

/**
 * AdMobNativeAd Component
 * 
 * In compliance with user requirements:
 * 1. ZERO mock HTML ads or sample cards are rendered in DOM / web preview (returns null).
 * 2. On Android native app, requests real test Native Advanced ads from Google AdMob SDK
 *    via AdMobService using official Google AdMob test IDs, exactly mirroring interstitial ads.
 */
export const AdMobNativeAd: React.FC<AdMobNativeAdProps> = ({
  unitId = ADMOB_UNITS.NATIVE_ADVANCED,
}) => {
  useEffect(() => {
    // When running inside Android native application, request real AdMob test native ad
    if (Capacitor.isNativePlatform() && AdMobService.shouldShowAds()) {
      AdMobService.requestNativeAd(unitId).catch(() => {});
    }
  }, [unitId]);

  // Return null so no mock HTML boxes or fake samples appear in preview or DOM
  return null;
};
