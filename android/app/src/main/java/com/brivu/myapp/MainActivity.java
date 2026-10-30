package com.brivu.myapp;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
    private static final String TAG = "AdMobNative";
    // Live Google AdMob Interstitial Unit ID for Android
    private static final String INTERSTITIAL_UNIT_ID = "ca-app-pub-8582659585800553/1482159477";

    private Handler adHandler;
    private Runnable adPingRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom NativeAd plugin with Capacitor Bridge
        // Note: @capacitor-community/admob is auto-registered by Capacitor
        registerPlugin(NativeAdPlugin.class);

        super.onCreate(savedInstanceState);

        adHandler = new Handler(Looper.getMainLooper());

        // Native Android MobileAds initialization immediately on launch
        try {
            MobileAds.initialize(this, new OnInitializationCompleteListener() {
                @Override
                public void onInitializationComplete(@NonNull InitializationStatus initializationStatus) {
                    Log.i(TAG, "Google MobileAds initialized successfully on Android. Ready for Interstitial and Native Advanced ads.");
                    preloadInterstitial();
                    preloadNativeAd();
                    startPeriodicAdPings();
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "MobileAds initialization error", e);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        preloadInterstitial();
        preloadNativeAd();
    }

    /**
     * Request authentic Native Advanced ad on startup
     */
    private void preloadNativeAd() {
        try {
            if (NativeAdPlugin.getInstance() != null) {
                NativeAdPlugin.getInstance().requestAdMobNativeAd(NativeAdPlugin.NATIVE_AD_UNIT_ID, false);
                Log.i(TAG, "Native Advanced ad requested on startup from MainActivity.");
            }
        } catch (Exception e) {
            Log.w(TAG, "preloadNativeAd note: " + e.getMessage());
        }
    }

    /**
     * Preload real AdMob Interstitial test ad
     */
    private void preloadInterstitial() {
        try {
            AdRequest interstitialRequest = new AdRequest.Builder().build();
            InterstitialAd.load(
                this,
                INTERSTITIAL_UNIT_ID,
                interstitialRequest,
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                        Log.i(TAG, "AdMob Real Test Interstitial Ad Preloaded Successfully from Google Servers!");
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        Log.w(TAG, "AdMob Interstitial Ad load status: " + loadAdError.getMessage() + " (Code: " + loadAdError.getCode() + ")");
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "preloadInterstitial note: " + e.getMessage());
        }
    }

    private void startPeriodicAdPings() {
        if (adHandler == null) return;
        adPingRunnable = new Runnable() {
            @Override
            public void run() {
                preloadInterstitial();
                preloadNativeAd();
                adHandler.postDelayed(this, 60000); // Check interstitial & native status every 60s
            }
        };
        adHandler.postDelayed(adPingRunnable, 60000);
    }

    @Override
    public void onDestroy() {
        if (adHandler != null && adPingRunnable != null) {
            adHandler.removeCallbacks(adPingRunnable);
        }
        super.onDestroy();
    }
}
