import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdOptions,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob';
import { StorageService } from './storage';
import { NativeAdBridge } from './nativeAdBridge';

/**
 * Live Google AdMob Ad Unit IDs for Android
 * App ID: ca-app-pub-8582659585800553~8957324812
 * Interstitial ID: ca-app-pub-8582659585800553/1482159477
 * Native Advanced ID: ca-app-pub-8582659585800553/9630358215
 */
export const ADMOB_LIVE_UNITS = {
  APP_ID: 'ca-app-pub-8582659585800553~8957324812',
  INTERSTITIAL: 'ca-app-pub-8582659585800553/1482159477',
  NATIVE_ADVANCED: 'ca-app-pub-8582659585800553/9630358215',
} as const;

export const ADMOB_UNITS = ADMOB_LIVE_UNITS;

class AdMobManager {
  private isInitialized = false;
  private lastInterstitialTime = 0;
  private userTapCount = 0;

  constructor() {
    this.initNativeAdMob();
  }

  async preloadInterstitial() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await this.initNativeAdMob();
      const adId = ADMOB_UNITS.INTERSTITIAL;
      console.log(`[ADS] Requesting Interstitial Ad. AdUnitId: ${adId}`);
      await NativeAdBridge.prepareInterstitial();
      await AdMob.prepareInterstitial({
        adId,
        isTesting: false,
      });
    } catch (err) {
      console.warn(`[ADS] Interstitial Ad failed to load. AdUnitId: ${ADMOB_UNITS.INTERSTITIAL}, Error:`, err);
    }
  }

  async preloadNativeAdvanced() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      const adUnitId = ADMOB_UNITS.NATIVE_ADVANCED;
      console.log(`[ADS] Requesting Native Ad. AdUnitId: ${adUnitId}`);
      await NativeAdBridge.loadNativeAd({
        adUnitId,
      });
    } catch (err) {
      console.warn(`[ADS] Native Ad failed to load. AdUnitId: ${ADMOB_UNITS.NATIVE_ADVANCED}, Error:`, err);
    }
  }

  async requestNativeAd(unitId: string = ADMOB_UNITS.NATIVE_ADVANCED) {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      console.log(`[ADS] Requesting Native Ad. AdUnitId: ${unitId}`);
      await NativeAdBridge.loadNativeAd({ adUnitId: unitId });
      await NativeAdBridge.showNativeAd();
    } catch (err) {
      console.warn(`[ADS] Native Ad failed to load. AdUnitId: ${unitId}, Error:`, err);
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
        console.log('[ADS] Initializing Google MobileAds SDK');
        await AdMob.initialize({
          initializeForTesting: false,
        });
        this.isInitialized = true;

        try {
          AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
            console.log(`[ADS] Interstitial Ad loaded successfully. AdUnitId: ${ADMOB_UNITS.INTERSTITIAL}`);
          });
          AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
            this.preloadInterstitial().catch(() => {});
          });
          AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
            console.warn(`[ADS] Interstitial Ad failed to load. AdUnitId: ${ADMOB_UNITS.INTERSTITIAL}, Error:`, err);
          });
        } catch (_) {}

        await this.preloadInterstitial();
      } catch (err) {
        console.warn('[ADS] MobileAds initialization failed:', err);
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
        // Try showing native preloaded interstitial ad first
        const nativeRes = await NativeAdBridge.showInterstitial();
        if (nativeRes && nativeRes.success) {
          onClosed?.();
          return true;
        }

        // Fallback to Capacitor AdMob plugin
        await this.initNativeAdMob();
        const options: AdOptions = {
          adId: ADMOB_UNITS.INTERSTITIAL,
          isTesting: false,
        };
        console.log(`[ADS] Showing Interstitial Ad. AdUnitId: ${options.adId}`);
        await AdMob.prepareInterstitial(options);
        await AdMob.showInterstitial();
        onClosed?.();
        setTimeout(() => {
          this.preloadInterstitial().catch(() => {});
        }, 1500);
        return true;
      } catch (err) {
        console.warn('[ADS] Interstitial display error:', err);
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
