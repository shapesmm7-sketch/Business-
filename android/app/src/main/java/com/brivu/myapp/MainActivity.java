package com.brivu.myapp;

import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ADS";

    // Live Google AdMob Interstitial Unit ID for Android
    public static final String LIVE_INTERSTITIAL_UNIT_ID = "ca-app-pub-8582659585800553/1482159477";

    public static String getInterstitialAdUnitId() {
        return LIVE_INTERSTITIAL_UNIT_ID;
    }

    private static volatile boolean isMobileAdsInitialized = false;

    public static boolean isInitialized() {
        return isMobileAdsInitialized;
    }

    private static InterstitialAd mInterstitialAd;

    public static InterstitialAd getInterstitialAd() {
        return mInterstitialAd;
    }

    public static void clearInterstitialAd() {
        mInterstitialAd = null;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom NativeAd, PlayBilling, MediaStore, and GoogleDrive plugins with Capacitor Bridge
        registerPlugin(NativeAdPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(MediaStorePlugin.class);
        registerPlugin(GoogleDrivePlugin.class);

        super.onCreate(savedInstanceState);

        // Initialize Google MobileAds SDK once at app start BEFORE any ad is loaded
        try {
            MobileAds.initialize(this, new OnInitializationCompleteListener() {
                @Override
                public void onInitializationComplete(@NonNull InitializationStatus initializationStatus) {
                    isMobileAdsInitialized = true;
                    Log.d(TAG, "Google MobileAds SDK initialized successfully at app start. App ID: ca-app-pub-8582659585800553~8957324812");
                    preloadInterstitial();
                    preloadNativeAd();
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "MobileAds initialization error: " + e.getMessage(), e);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (isMobileAdsInitialized) {
            preloadInterstitial();
            preloadNativeAd();
        }
    }

    /**
     * Request authentic Native Advanced ad after initialization
     */
    public void preloadNativeAd() {
        if (!isMobileAdsInitialized) {
            Log.d(TAG, "Cannot load Native Ad yet: MobileAds not initialized.");
            return;
        }
        try {
            if (NativeAdPlugin.getInstance() != null) {
                String nativeUnitId = NativeAdPlugin.getNativeAdUnitId();
                NativeAdPlugin.getInstance().requestAdMobNativeAd(nativeUnitId, false);
            }
        } catch (Exception e) {
            Log.w(TAG, "preloadNativeAd note: " + e.getMessage());
        }
    }

    /**
     * Preload real AdMob Interstitial ad after initialization
     */
    public void preloadInterstitial() {
        if (!isMobileAdsInitialized) {
            Log.d(TAG, "Cannot load Interstitial Ad yet: MobileAds not initialized.");
            return;
        }
        final String adUnitId = getInterstitialAdUnitId();
        try {
            Log.d(TAG, "Requesting Interstitial Ad. AdUnitId: " + adUnitId);
            AdRequest interstitialRequest = new AdRequest.Builder().build();
            InterstitialAd.load(
                this,
                adUnitId,
                interstitialRequest,
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                        mInterstitialAd = interstitialAd;
                        Log.d(TAG, "Interstitial Ad loaded successfully. AdUnitId: " + adUnitId);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        mInterstitialAd = null;
                        Log.d(TAG, "Interstitial Ad failed to load. AdUnitId: " + adUnitId +
                            ", ErrorCode: " + loadAdError.getCode() +
                            ", Message: " + loadAdError.getMessage());
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "preloadInterstitial note: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }
}
