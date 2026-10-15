import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdOptions,
  AdOptions,
  BannerAdPluginEvents,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob';
import { StorageService } from './storage';

/**
 * Production Google AdMob Unit IDs
 */
export const ADMOB_UNITS = {
  APP_ID: 'ca-app-pub-8582659585800553~8957324812',
  BANNER: 'ca-app-pub-8582659585800553/3301762743',
  ADAPTIVE_BANNER: 'ca-app-pub-8582659585800553/3301762743',
  INTERSTITIAL: 'ca-app-pub-8582659585800553/1482159477',
  NATIVE_ADVANCED: 'ca-app-pub-8582659585800553/9630358215',
} as const;

export const ADMOB_TEST_UNITS = ADMOB_UNITS;

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
  private isBannerCreated = false;
  private isBannerVisible = false;
  private userTapCount = 0;
  private currentAdState: {
    activeAd: 'interstitial' | null;
    interstitialConfig?: InterstitialAdConfig;
  } = {
    activeAd: null,
  };

  constructor() {
    this.initNativeAdMob();
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.pingAdMobRequests().catch(() => {});
      }, 1000);
      this.startAdMobHeartbeat();
    }
  }

  startAdMobHeartbeat() {
    if (typeof window === 'undefined') return;
    // Periodically keep requests active and units ready on physical device
    setInterval(() => {
      if (Capacitor.isNativePlatform() && this.shouldShowAds()) {
        this.preloadInterstitial().catch(() => {});
      }
    }, 30000);
  }

  async pingAdMobRequests() {
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();
        await this.preloadInterstitial();
      } catch (_) {}
    }
  }

  /**
   * Preload an interstitial ad to ensure ad requests register immediately on Google AdMob
   */
  async preloadInterstitial() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await this.initNativeAdMob();
      await AdMob.prepareInterstitial({
        adId: ADMOB_UNITS.INTERSTITIAL,
        isTesting: false,
      });
      console.info('[AdMob Native] Interstitial ad prepared (AdMob request registered).');
    } catch (err) {
      console.warn('[AdMob Native] Preload interstitial note:', err);
    }
  }

  /**
   * Record a user click or tap interaction.
   * Pops up an interstitial ad every 25 user clicks/taps.
   */
  recordInteraction() {
    if (!this.shouldShowAds()) return;
    this.userTapCount++;
    if (this.userTapCount >= 25) {
      this.userTapCount = 0;
      console.info('[AdMob] 25 user interactions reached, triggering Interstitial Ad.');
      this.showInterstitial('25_taps_milestone');
    }
  }

  /**
   * Current tap count
   */
  getTapCount(): number {
    return this.userTapCount;
  }

  /**
   * Initialize native Google Mobile Ads SDK if running in Android/iOS container
   */
  async initNativeAdMob() {
    if (this.isInitialized) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await AdMob.initialize({
          initializeForTesting: false,
        });
        this.isInitialized = true;
        console.info('[AdMob Native] Initialized successfully with Google AdMob production configuration.');

        // Listen for AdMob banner events
        try {
          AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
            console.info('[AdMob Native] Banner ad loaded successfully.');
            this.isBannerCreated = true;
            this.isBannerVisible = true;
          });
          AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
            console.warn('[AdMob Native] Banner failed to load (will re-request):', err);
            this.isBannerCreated = false;
            this.isBannerVisible = false;
          });
          AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
            console.info('[AdMob Native] Interstitial ad loaded and ready in memory.');
          });
          AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
            console.info('[AdMob Native] Interstitial ad dismissed. Preloading next interstitial ad.');
            this.preloadInterstitial().catch(() => {});
          });
          AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
            console.warn('[AdMob Native] Interstitial failed to load:', err);
          });
        } catch (_) {}

        // Request UMP consent non-blockingly so ad requests are not delayed
        AdMob.requestConsentInfo().then(async (consentInfo) => {
          if (consentInfo.isConsentFormAvailable && consentInfo.status === 'REQUIRED') {
            await AdMob.showConsentForm();
          }
        }).catch((consentErr) => {
          console.warn('[AdMob Native] Consent verification note:', consentErr);
        });

        // Proactively prepare an interstitial to ensure request counts register immediately on Google AdMob
        await this.preloadInterstitial();
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
  async showNativeBanner(position: 'bottom' | 'top' = 'bottom', hasBottomNav = true, customMargin?: number) {
    if (!this.shouldShowAds()) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();

        const calculatedMargin = customMargin !== undefined ? customMargin : (hasBottomNav ? 84 : 16);

        const options: BannerAdOptions = {
          adId: ADMOB_UNITS.BANNER,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: position === 'bottom' ? BannerAdPosition.BOTTOM_CENTER : BannerAdPosition.TOP_CENTER,
          margin: calculatedMargin,
          isTesting: false,
        };

        if (this.isBannerCreated && this.isBannerVisible) {
          try {
            await AdMob.resumeBanner();
            return;
          } catch (_) {}
        }

        try {
          await AdMob.showBanner(options);
          this.isBannerCreated = true;
          this.isBannerVisible = true;
        } catch (showErr: any) {
          try {
            await AdMob.resumeBanner();
            this.isBannerCreated = true;
            this.isBannerVisible = true;
          } catch (resumeErr) {
            console.warn('[AdMob Native] Banner display note:', resumeErr);
          }
        }
      } catch (err: any) {
        console.warn('[AdMob Native] showBanner error:', err);
      }
    }
  }

  /**
   * Hide Native Banner ad
   */
  async hideNativeBanner() {
    if (Capacitor.isNativePlatform() && this.isBannerCreated && this.isBannerVisible) {
      try {
        await AdMob.hideBanner();
        this.isBannerVisible = false;
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

    console.info(`[AdMob] Showing Interstitial Ad for action: ${actionSource} (Live Unit: ${ADMOB_UNITS.INTERSTITIAL})`);

    // If native Android platform, invoke native AdMob
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();
        const options: AdOptions = {
          adId: ADMOB_UNITS.INTERSTITIAL,
          isTesting: false,
        };
        await AdMob.prepareInterstitial(options);
        await AdMob.showInterstitial();
        onClosed?.();
        setTimeout(() => {
          this.preloadInterstitial().catch(() => {});
        }, 1500);
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
