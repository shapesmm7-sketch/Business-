import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_TEST_UNITS, AdMobService } from '../services/admobService';

interface AdMobBannerProps {
  placement?: 'bottom_sticky' | 'bottom_page' | 'inline';
  unitId?: string;
  hasBottomNav?: boolean;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  placement = 'bottom_page',
  unitId = ADMOB_TEST_UNITS.ADAPTIVE_BANNER,
  hasBottomNav = false,
}) => {
  // Hook into native Android AdMob banner when running on an Android device
  useEffect(() => {
    if (Capacitor.isNativePlatform() && placement === 'bottom_sticky') {
      AdMobService.showNativeBanner('bottom', hasBottomNav);
      return () => {
        AdMobService.hideNativeBanner();
      };
    }
  }, [placement, hasBottomNav, unitId]);

  // Do not render any custom HTML ads in web preview.
  // Ads will only be rendered natively by Google Mobile Ads SDK on Android.
  return null;
};
