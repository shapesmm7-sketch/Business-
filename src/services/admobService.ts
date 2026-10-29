import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdOptions,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob';
import { StorageService } from './storage';
import { NativeAdBridge } from './nativeAdBridge';

/**
 * Official Google AdMob Test Ad Unit IDs for Android
 * As specified in user requirements:
 * Native Advanced Demo ID: ca-app-pub-3940256099942544/2247696110
 * Interstitial Demo ID: ca-app-pub-394025609942544/1033173712
 */
export const ADMOB_TEST_UNITS = {
  APP_ID: 'ca-app-pub-394025609942544~3347511713',
  INTERSTITIAL: 'ca-app-pub-394025609942544/1033173712',
  NATIVE_ADVANCED: 'ca-app-pub-3940256099942544/2247696110',
} as const;

export const ADMOB_UNITS = ADMOB_TEST_UNITS;

class AdMobManager {
  private isInitialized = false;
  private lastInterstitialTime = 0;
  private userTapCount = 0;

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
    setInterval(() => {
      if (Capacitor.isNativePlatform() && this.shouldShowAds()) {
        this.preloadInterstitial().catch(() => {});
        this.preloadNativeAdvanced().catch(() => {});
      }
    }, 30000);
  }

  async pingAdMobRequests() {
    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();
        await this.preloadInterstitial();
        await this.preloadNativeAdvanced();
      } catch (_) {}
    }
  }

  async preloadInterstitial() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await this.initNativeAdMob();
      await AdMob.prepareInterstitial({
        adId: ADMOB_UNITS.INTERSTITIAL,
        isTesting: true,
      });
    } catch (err) {
      console.warn('[AdMob Native] Preload interstitial note:', err);
    }
  }

  async preloadNativeAdvanced() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await NativeAdBridge.loadNativeAd({
        adUnitId: ADMOB_UNITS.NATIVE_ADVANCED,
      });
      console.info(`[AdMob Native] Real AdMob Native Advanced Test Ad Unit registered: ${ADMOB_UNITS.NATIVE_ADVANCED}`);
    } catch (err) {
      console.warn('[AdMob Native] Preload native advanced note:', err);
    }
  }

  async requestNativeAd(unitId: string = ADMOB_UNITS.NATIVE_ADVANCED) {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await NativeAdBridge.showNativeAd();
      console.info(`[AdMob Native] Real AdMob Native Advanced ad requested via NativeAdBridge: ${unitId}`);
    } catch (err) {
      console.warn('[AdMob Native] Native ad request note:', err);
    }
  }

  recordInteraction() {
    if (!this.shouldShowAds()) return;
    this.userTapCount++;
    if (this.userTapCount >= 25) {
      this.userTapCount = 0;
      this.showInterstitial('25_taps_milestone');
    }
  }

  getTapCount(): number {
    return this.userTapCount;
  }

  async initNativeAdMob() {
    if (this.isInitialized) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await AdMob.initialize({
          initializeForTesting: true,
        });
        this.isInitialized = true;

        try {
          AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
            console.info('[AdMob Native] Real Test Interstitial Ad loaded from Google AdMob servers');
          });
          AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
            this.preloadInterstitial().catch(() => {});
          });
          AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
            console.warn('[AdMob Native] Interstitial load status:', err);
          });
        } catch (_) {}

        await this.preloadInterstitial();
      } catch (err) {
        console.warn('[AdMob Native] Initialization note:', err);
      }
    }
  }

  shouldShowAds(): boolean {
    const isSubscribed = StorageService.isSubscribed();
    return !isSubscribed;
  }

  async showInterstitial(actionSource = 'save', onClosed?: () => void): Promise<boolean> {
    if (!this.shouldShowAds()) {
      onClosed?.();
      return false;
    }

    const now = Date.now();
    if (now - this.lastInterstitialTime < 1500) {
      onClosed?.();
      return false;
    }
    this.lastInterstitialTime = now;

    if (Capacitor.isNativePlatform()) {
      try {
        await this.initNativeAdMob();
        const options: AdOptions = {
          adId: ADMOB_UNITS.INTERSTITIAL,
          isTesting: true,
        };
        await AdMob.prepareInterstitial(options);
        await AdMob.showInterstitial();
        onClosed?.();
        setTimeout(() => {
          this.preloadInterstitial().catch(() => {});
        }, 1500);
        return true;
      } catch (err) {
        console.warn('[AdMob Native] Interstitial display note:', err);
      }
    }

    // On web / preview, execute callback directly without any mock HTML overlay
    onClosed?.();
    return true;
  }

  closeAd() {
    // No-op for web preview since no mock overlays exist
  }
}

export const AdMobService = new AdMobManager();
