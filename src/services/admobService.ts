import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdOptions,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob';
import { StorageService } from './storage';

/**
 * Google AdMob Ad Unit IDs (Live & Test IDs)
 */
export const ADMOB_TEST_UNITS = {
  APP_ID: 'ca-app-pub-394025609942544~3347511713',
  INTERSTITIAL: 'ca-app-pub-394025609942544/1033173712',
  NATIVE_ADVANCED: 'ca-app-pub-394025609942544/2247696110',
} as const;

export const ADMOB_UNITS = ADMOB_TEST_UNITS;

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
      await this.initNativeAdMob();
      console.info(`[AdMob Native] Live Test Native Advanced Ad Registered: ${ADMOB_UNITS.NATIVE_ADVANCED}`);
    } catch (err) {
      console.warn('[AdMob Native] Preload native advanced note:', err);
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
          AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {});
          AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
            this.preloadInterstitial().catch(() => {});
          });
          AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
            console.warn('[AdMob Native] Interstitial failed to load:', err);
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
        console.warn('[AdMob Native] Fallback to overlay interstitial:', err);
      }
    }

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
