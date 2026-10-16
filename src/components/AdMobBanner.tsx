import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_UNITS, AdMobService } from '../services/admobService';

interface AdMobBannerProps {
  placement?: 'bottom_sticky' | 'bottom_page' | 'inline';
  unitId?: string;
  hasBottomNav?: boolean;
  bottomMargin?: number;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  placement = 'bottom_page',
  unitId = ADMOB_UNITS.ADAPTIVE_BANNER,
  hasBottomNav = false,
  bottomMargin,
}) => {
  // Hook into native Android AdMob banner when running on an Android device
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AdMobService.showNativeBanner('bottom', hasBottomNav, bottomMargin);
    }
  }, [hasBottomNav, bottomMargin]);

  // Ads are rendered natively by Google Mobile Ads SDK on Android.
  return null;
};
