package com.brivu.myapp;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.community.admob.AdMob;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "AdMobNative";
    // Official Google AdMob Test Ad Units for Android
    // https://developers.google.com/admob/android/test-ads
    private static final String INTERSTITIAL_UNIT_ID = "ca-app-pub-394025609942544/1033173712";
    private static final String NATIVE_ADVANCED_UNIT_ID = "ca-app-pub-394025609942544/2247696110";

    private Handler adHandler;
    private Runnable adPingRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdMob.class);
        super.onCreate(savedInstanceState);

        adHandler = new Handler(Looper.getMainLooper());

        // Native Android MobileAds initialization immediately on launch
        try {
            MobileAds.initialize(this, new OnInitializationCompleteListener() {
                @Override
                public void onInitializationComplete(@NonNull InitializationStatus initializationStatus) {
                    Log.i(TAG, "Google MobileAds initialized. Requesting live AdMob test ads...");
                    sendAdMobRequests();
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
        sendAdMobRequests();
    }

    /**
     * Request test ads directly from Google AdMob servers for Native Advanced and Interstitial
     */
    private void sendAdMobRequests() {
        try {
            // 1. Request Google AdMob Native Advanced Test Ad via AdLoader
            AdLoader adLoader = new AdLoader.Builder(this, NATIVE_ADVANCED_UNIT_ID)
                .forNativeAd(new NativeAd.OnNativeAdLoadedListener() {
                    @Override
                    public void onNativeAdLoaded(@NonNull NativeAd nativeAd) {
                        Log.i(TAG, "AdMob Real Test Native Advanced Ad Loaded Successfully: " + nativeAd.getHeadline());
                    }
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        Log.w(TAG, "AdMob Native Advanced Ad load status: " + loadAdError.getMessage() + " (Code: " + loadAdError.getCode() + ")");
                    }
                })
                .withNativeAdOptions(new NativeAdOptions.Builder().build())
                .build();

            adLoader.loadAd(new AdRequest.Builder().build());

            // 2. Request Google AdMob Interstitial Test Ad
            AdRequest interstitialRequest = new AdRequest.Builder().build();
            InterstitialAd.load(
                this,
                INTERSTITIAL_UNIT_ID,
                interstitialRequest,
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                        Log.i(TAG, "AdMob Real Test Interstitial Ad Loaded Successfully from Google Servers!");
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        Log.w(TAG, "AdMob Interstitial Ad load status: " + loadAdError.getMessage() + " (Code: " + loadAdError.getCode() + ")");
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "sendAdMobRequests note: " + e.getMessage());
        }
    }

    private void startPeriodicAdPings() {
        if (adHandler == null) return;
        adPingRunnable = new Runnable() {
            @Override
            public void run() {
                sendAdMobRequests();
                adHandler.postDelayed(this, 30000); // Check ad requests every 30 seconds
            }
        };
        adHandler.postDelayed(adPingRunnable, 30000);
    }

    @Override
    public void onDestroy() {
        if (adHandler != null && adPingRunnable != null) {
            adHandler.removeCallbacks(adPingRunnable);
        }
        super.onDestroy();
    }
}
