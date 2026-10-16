package com.brivu.myapp;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.community.admob.AdMob;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "AdMobNative";
    private static final String INTERSTITIAL_UNIT_ID = "ca-app-pub-8582659585800553/1482159477";
    private static final String BANNER_UNIT_ID = "ca-app-pub-8582659585800553/3301762743";
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
                    Log.i(TAG, "Google MobileAds initialized successfully. Sending live AdRequests...");
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

    private void sendAdMobRequests() {
        try {
            // 1. Send live Interstitial AdRequest
            AdRequest interstitialRequest = new AdRequest.Builder().build();
            InterstitialAd.load(
                this,
                INTERSTITIAL_UNIT_ID,
                interstitialRequest,
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                        Log.i(TAG, "AdMob Live Interstitial Ad Request SUCCESSFUL!");
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        Log.w(TAG, "AdMob Interstitial Ad Request registered, response code: " + loadAdError.getCode() + ", message: " + loadAdError.getMessage());
                    }
                }
            );

            // 2. Send live Banner AdRequest
            AdView bannerView = new AdView(this);
            bannerView.setAdUnitId(BANNER_UNIT_ID);
            bannerView.setAdSize(AdSize.BANNER);
            bannerView.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    Log.i(TAG, "AdMob Live Banner Ad Request SUCCESSFUL!");
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    Log.w(TAG, "AdMob Banner Ad Request registered, response code: " + loadAdError.getCode() + ", message: " + loadAdError.getMessage());
                }
            });
            bannerView.loadAd(new AdRequest.Builder().build());
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
                adHandler.postDelayed(this, 30000); // Send ad requests every 30 seconds while app is active
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
