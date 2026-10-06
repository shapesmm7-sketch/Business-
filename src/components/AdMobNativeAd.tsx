import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_UNITS, AdMobService } from '../services/admobService';

interface AdMobNativeAdProps {
  unitId?: string;
  variant?: 'card' | 'compact' | 'in-feed' | 'banner';
  context?: 'inventory' | 'receipts' | 'invoices' | 'qr' | 'general';
  className?: string;
}

export const AdMobNativeAd: React.FC<AdMobNativeAdProps> = ({
  unitId = ADMOB_UNITS.NATIVE_ADVANCED,
  variant = 'in-feed',
  context = 'general',
  className = '',
}) => {
  useEffect(() => {
    // When running inside Android native application, invoke Google AdMob native/in-feed ads
    if (Capacitor.isNativePlatform() && AdMobService.shouldShowAds()) {
      AdMobService.showNativeBanner('bottom', true, 16);
    }
  }, [unitId, variant, context]);

  // Do not render mock/sample HTML ad placeholders in web preview.
  // Real live ads are handled natively by the Google Mobile Ads SDK on Android.
  return null;
};
