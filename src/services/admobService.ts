import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdOptions,
  AdOptions,
} from '@capacitor-community/admob';
import { StorageService } from './storage';

/**
 * Required Google AdMob Test Unit IDs for our App
 * Source: Google AdMob Documentation (developers.google.com/admob/android/test-ads)
 */
export const ADMOB_TEST_UNITS = {
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  APP_ID: 'ca-app-pub-3940256099942544~3347511713',
} as const;

export interface InterstitialAdConfig {
  unitId: string;
  actionSource?: string;
  onClosed?: () => void;
}

type AdListener = (state: {
  activeAd: 'interstitial' | null;
  interstitialConfig?: InterstitialAdConfig;
}) => void;

class AdMobManager {
  private isInitialized = false;
  private listeners: Set<AdListener> = new Set();
  private lastInterstitialTime = 0;
  private nativeBannerActive = false;
  private currentAdState: {
    activeAd: 'interstitial' | null;
    interstitialConfig?: InterstitialAdConfig;
  } = {
    activeAd: null,
  };

  constructor() {
    this.initNativeAdMob();
  }

  /**
   * Initialize native Google Mobile Ads SDK if running in Android/iOS container
   */
  async initNativeAdMob() {
    if (this.isInitialized) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await AdMob.initialize({
          initializeForTesting: true,
        });
        this.isInitialized = true;
        console.info('[AdMob Native] Initialized successfully with Google AdMob test configuration.');
      } catch (err) {
        console.warn('[AdMob Native] Initialization note (normal in web preview):', err);
      }
    }
  }

  /**
   * Check if ads should be displayed.
   * Pro active subscribers enjoy an ad-free experience, while non-subscribers see ads.
   */
  shouldShowAds(): boolean {
    const isSubscribed = StorageService.isSubscribed();
    return !isSubscribed;
  }

  /**
   * Show Native Banner ad on Android if running natively
   */
  async showNativeBanner(position: 'bottom' | 'top' = 'bottom', hasBottomNav = true) {
    if (!this.shouldShowAds()) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();
        const options: BannerAdOptions = {
          adId: ADMOB_TEST_UNITS.ADAPTIVE_BANNER,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: position === 'bottom' ? BannerAdPosition.BOTTOM_CENTER : BannerAdPosition.TOP_CENTER,
          margin: hasBottomNav ? 64 : 0,
          isTesting: true,
        };
        await AdMob.showBanner(options);
        this.nativeBannerActive = true;
      } catch (err) {
        console.warn('[AdMob Native] showBanner error:', err);
      }
    }
  }

  /**
   * Hide Native Banner ad
   */
  async hideNativeBanner() {
    if (Capacitor.isNativePlatform() && this.nativeBannerActive) {
      try {
        await AdMob.hideBanner();
        this.nativeBannerActive = false;
      } catch (err) {
        console.warn('[AdMob Native] hideBanner error:', err);
      }
    }
  }

  /**
   * Subscribe to ad modal state changes
   */
  subscribe(listener: AdListener): () => void {
    this.listeners.add(listener);
    listener(this.currentAdState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentAdState);
      } catch (err) {
        console.warn('[AdMob] Notification listener error:', err);
      }
    });
  }

  /**
   * Show full-screen Google AdMob Interstitial ad immediately
   * triggered on save, download, done, or record.
   */
  async showInterstitial(actionSource = 'save', onClosed?: () => void): Promise<boolean> {
    if (!this.shouldShowAds()) {
      onClosed?.();
      return false;
    }

    // Small debounce to prevent double popups within 1.5 seconds
    const now = Date.now();
    if (now - this.lastInterstitialTime < 1500) {
      onClosed?.();
      return false;
    }
    this.lastInterstitialTime = now;

    console.info(`[AdMob] Showing Interstitial Ad for action: ${actionSource} (Live Test Unit: ${ADMOB_TEST_UNITS.INTERSTITIAL})`);

    // If native Android platform, invoke native AdMob
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();
        const options: AdOptions = {
          adId: ADMOB_TEST_UNITS.INTERSTITIAL,
          isTesting: true,
        };
        await AdMob.prepareInterstitial(options);
        await AdMob.showInterstitial();
        onClosed?.();
        return true;
      } catch (err) {
        console.warn('[AdMob Native] Fallback to overlay interstitial:', err);
      }
    }

    // Web / Overlay presentation
    this.currentAdState = {
      activeAd: 'interstitial',
      interstitialConfig: {
        unitId: ADMOB_TEST_UNITS.INTERSTITIAL,
        actionSource,
        onClosed,
      },
    };
    this.notify();
    return true;
  }

  /**
   * Close any currently active modal ad
   */
  closeAd() {
    const prevConfig = this.currentAdState.interstitialConfig;

    this.currentAdState = {
      activeAd: null,
    };
    this.notify();

    if (prevConfig?.onClosed) {
      try {
        prevConfig.onClosed();
      } catch (err) {
        console.warn('[AdMob] Interstitial onClosed error:', err);
      }
    }
  }
}

export const AdMobService = new AdMobManager();
