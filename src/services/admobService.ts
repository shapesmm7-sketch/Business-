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
 * Interstitial ID: ca-app-pub-8582659585800553/1676434279
 * Native Advanced ID: ca-app-pub-8582659585800553/6584166086
 */
export const ADMOB_LIVE_UNITS = {
  APP_ID: 'ca-app-pub-8582659585800553~8957324812',
  INTERSTITIAL: 'ca-app-pub-8582659585800553/1676434279',
  NATIVE_ADVANCED: 'ca-app-pub-8582659585800553/6584166086',
} as const;

export const ADMOB_UNITS = ADMOB_LIVE_UNITS;

class AdMobManager {
  private isInitialized = false;
  private isPluginAdMobInitialized = false;
  private initPromise: Promise<void> | null = null;
  private lastInterstitialTime = 0;
  private userTapCount = 0;

  async preloadInterstitial() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await this.initNativeAdMob();
      const adId = ADMOB_UNITS.INTERSTITIAL;
      console.log(`[ADS] Requesting Interstitial Ad (isDebug=false). AdUnitId: ${adId}`);
      await NativeAdBridge.prepareInterstitial();
    } catch (err) {
      console.warn(`[ADS] Interstitial Ad failed to load. AdUnitId: ${ADMOB_UNITS.INTERSTITIAL}, Error:`, err);
    }
  }

  async preloadNativeAdvanced() {
    if (!Capacitor.isNativePlatform() || !this.shouldShowAds()) return;
    try {
      await this.initNativeAdMob();
      const adUnitId = ADMOB_UNITS.NATIVE_ADVANCED;
      console.log(`[ADS] Requesting Native Ad (isDebug=false). AdUnitId: ${adUnitId}`);
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
      await this.initNativeAdMob();
      console.log(`[ADS] Requesting Native Ad (isDebug=false). AdUnitId: ${unitId}`);
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

  async initNativeAdMob(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (!Capacitor.isNativePlatform()) {
        this.isInitialized = true;
        return;
      }
      try {
        console.log('[ADS] Ensuring native Google MobileAds SDK initialized (isDebug=false)');
        await NativeAdBridge.initializeAds();
        this.isInitialized = true;
      } catch (err) {
        console.warn('[ADS] Native MobileAds init note:', err);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async ensurePluginAdMobFallbackReady(): Promise<void> {
    if (this.isPluginAdMobInitialized || !Capacitor.isNativePlatform()) return;
    await AdMob.initialize({
      initializeForTesting: false,
    });
    this.isPluginAdMobInitialized = true;
    try {
      AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        console.log(`[ADS] Fallback Interstitial Ad loaded successfully (isDebug=false). AdUnitId: ${ADMOB_UNITS.INTERSTITIAL}`);
      });
      AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        this.preloadInterstitial().catch(() => {});
      });
      AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
        console.warn(`[ADS] Fallback Interstitial Ad failed to load. AdUnitId: ${ADMOB_UNITS.INTERSTITIAL}, Error:`, err);
      });
    } catch (_) {}
  }

  shouldShowAds(): boolean {
    const isSubscribed = StorageService.isSubscribed();
    return !isSubscribed;
  }

  async showInterstitial(_actionSource = 'save', onClosed?: () => void): Promise<boolean> {
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
        // Primary path: native MainActivity preloaded Interstitial (single SDK instance, live unit ID)
        const nativeRes = await NativeAdBridge.showInterstitial();
        if (nativeRes && nativeRes.success) {
          onClosed?.();
          return true;
        }

        // Secondary fallback via @capacitor-community/admob only if native interstitial wasn't ready yet
        await this.ensurePluginAdMobFallbackReady();
        const options: AdOptions = {
          adId: ADMOB_UNITS.INTERSTITIAL,
          isTesting: false,
        };
        console.log(`[ADS] Showing Fallback Interstitial Ad (isDebug=false). AdUnitId: ${options.adId}`);
        await AdMob.prepareInterstitial(options);
        await AdMob.showInterstitial();
        onClosed?.();
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
