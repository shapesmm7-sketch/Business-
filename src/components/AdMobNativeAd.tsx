import React, { useEffect } from 'react';
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
    // When running inside Android native application, keep live test native advanced requests active
    if (Capacitor.isNativePlatform() && shouldShow) {
      AdMobService.initNativeAdMob().catch(() => {});
      AdMobService.preloadNativeAdvanced().catch(() => {});
    }
  }, [unitId, variant, context, shouldShow]);

  // Do not render any sample or fake HTML native ad card placeholder
  // Live test ads are handled through the native Google Mobile Ads AdMob SDK
  return null;
};

