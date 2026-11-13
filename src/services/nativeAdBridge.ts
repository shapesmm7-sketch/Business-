import { registerPlugin } from '@capacitor/core';

export interface NativeAdPluginInterface {
  initializeAds(): Promise<{ initialized: boolean }>;
  loadNativeAd(options?: { adUnitId?: string }): Promise<{ success: boolean }>;
  showNativeAd(options?: { marginBottom?: number }): Promise<{ success: boolean }>;
  hideNativeAd(options?: { slotId?: string }): Promise<{ success: boolean }>;
  isAdLoaded(): Promise<{ loaded: boolean; visible: boolean }>;
  updatePosition(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    clipTop?: number;
    clipBottom?: number;
    visible: boolean;
    slotId?: string;
  }): Promise<{ success: boolean }>;
  prepareInterstitial(): Promise<{ success: boolean }>;
  showInterstitial(): Promise<{ success: boolean; message?: string }>;
}

/**
 * NativeAdBridge:
 * Connects React UI to the Android NativeAdPlugin.
 * On web / preview, methods safely resolve without creating any fake HTML/CSS cards.
 */
export const NativeAdBridge = registerPlugin<NativeAdPluginInterface>('NativeAdPlugin', {
  web: () => ({
    initializeAds: async () => ({ initialized: false }),
    loadNativeAd: async () => ({ success: false }),
    showNativeAd: async () => ({ success: false }),
    hideNativeAd: async () => ({ success: false }),
    isAdLoaded: async () => ({ loaded: false, visible: false }),
    updatePosition: async () => ({ success: false }),
    prepareInterstitial: async () => ({ success: false }),
    showInterstitial: async () => ({ success: false }),
  }),
});
