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
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.util.Collections;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ADS";
    private static final int MAX_INTERSTITIAL_RETRIES = 2;

    // Live Google AdMob Interstitial Unit ID for Android
    public static final String LIVE_INTERSTITIAL_UNIT_ID = "ca-app-pub-8582659585800553/1676434279";

    public static String getInterstitialAdUnitId() {
        return LIVE_INTERSTITIAL_UNIT_ID;
    }

    private static volatile boolean isMobileAdsInitialized = false;
    private static volatile boolean isMobileAdsInitializing = false;
    private static volatile boolean pendingInterstitialRequest = false;
    private static volatile boolean isInterstitialLoading = false;
    private static int interstitialRetryCount = 0;

    public static boolean isInitialized() {
        return isMobileAdsInitialized;
    }

    private static InterstitialAd mInterstitialAd;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

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

        // Request UMP consent status non-blockingly and initialize MobileAds SDK once at startup
        requestConsentAndInitializeAds();
    }

    private void requestConsentAndInitializeAds() {
        try {
            ConsentInformation consentInformation = UserMessagingPlatform.getConsentInformation(this);
            if (consentInformation.canRequestAds()) {
                initializeMobileAdsOnce();
            }

            ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
            consentInformation.requestConsentInfoUpdate(
                this,
                params,
                () -> {
                    if (isFinishing() || isDestroyed()) return;
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> {
                        if (formError != null) {
                            Log.d(TAG, "UMP consent form note: code=" + formError.getErrorCode() + ", msg=" + formError.getMessage());
                        }
                        if (consentInformation.canRequestAds() && !isMobileAdsInitialized) {
                            initializeMobileAdsOnce();
                        }
                    });
                    if (consentInformation.canRequestAds() && !isMobileAdsInitialized) {
                        initializeMobileAdsOnce();
                    }
                },
                requestConsentError -> {
                    Log.d(TAG, "UMP consent update note: code=" + requestConsentError.getErrorCode() + ", msg=" + requestConsentError.getMessage());
                    if (!isMobileAdsInitialized) {
                        initializeMobileAdsOnce();
                    }
                }
            );
        } catch (Exception e) {
            Log.d(TAG, "Consent flow fallback to direct MobileAds init: " + e.getMessage());
            initializeMobileAdsOnce();
        }
    }

    public synchronized void initializeMobileAdsOnce() {
        if (isMobileAdsInitialized || isMobileAdsInitializing) {
            return;
        }
        isMobileAdsInitializing = true;

        try {
            // Ensure production live requests with zero test device IDs
            RequestConfiguration config = new RequestConfiguration.Builder()
                .setTestDeviceIds(Collections.emptyList())
                .build();
            MobileAds.setRequestConfiguration(config);

            MobileAds.initialize(this, new OnInitializationCompleteListener() {
                @Override
                public void onInitializationComplete(@NonNull InitializationStatus initializationStatus) {
                    isMobileAdsInitialized = true;
                    isMobileAdsInitializing = false;
                    Log.d(TAG, "Google MobileAds SDK initialized (isDebug=false). App ID: ca-app-pub-8582659585800553~8957324812");

                    mainHandler.post(() -> {
                        pendingInterstitialRequest = false;
                        preloadInterstitial();
                        preloadNativeAd();
                    });
                }
            });
        } catch (Exception e) {
            isMobileAdsInitializing = false;
            Log.e(TAG, "MobileAds initialization error: " + e.getMessage(), e);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (isMobileAdsInitialized) {
            if (mInterstitialAd == null && !isInterstitialLoading) {
                preloadInterstitial();
            }
            if (NativeAdPlugin.getInstance() != null) {
                NativeAdPlugin.getInstance().ensureNativeAdLoaded();
            }
        } else if (!isMobileAdsInitializing) {
            initializeMobileAdsOnce();
        }
    }

    /**
     * Request authentic Native Advanced ad after initialization
     */
    public void preloadNativeAd() {
        if (!isMobileAdsInitialized) {
            Log.d(TAG, "Native Ad queued until MobileAds initialization completes.");
            if (NativeAdPlugin.getInstance() != null) {
                NativeAdPlugin.getInstance().requestAdMobNativeAd(NativeAdPlugin.getNativeAdUnitId(), false);
            }
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
            pendingInterstitialRequest = true;
            Log.d(TAG, "Interstitial Ad request queued until MobileAds initialization completes.");
            if (!isMobileAdsInitializing) {
                initializeMobileAdsOnce();
            }
            return;
        }
        if (mInterstitialAd != null || isInterstitialLoading) {
            return;
        }

        final String adUnitId = getInterstitialAdUnitId();
        mainHandler.post(() -> {
            if (isFinishing() || isDestroyed() || mInterstitialAd != null || isInterstitialLoading) {
                return;
            }
            isInterstitialLoading = true;
            try {
                Log.d(TAG, "Requesting Interstitial Ad (isDebug=false). AdUnitId: " + adUnitId);
                AdRequest interstitialRequest = new AdRequest.Builder().build();
                InterstitialAd.load(
                    MainActivity.this,
                    adUnitId,
                    interstitialRequest,
                    new InterstitialAdLoadCallback() {
                        @Override
                        public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                            isInterstitialLoading = false;
                            interstitialRetryCount = 0;
                            mInterstitialAd = interstitialAd;
                            Log.d(TAG, "onAdLoaded: Interstitial Ad loaded successfully (isDebug=false). AdUnitId: " + adUnitId);
                        }

                        @Override
                        public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                            isInterstitialLoading = false;
                            mInterstitialAd = null;
                            Log.d(TAG, "onAdFailedToLoad: Interstitial Ad failed. AdUnitId: " + adUnitId +
                                ", ErrorCode: " + loadAdError.getCode() +
                                ", Domain: " + loadAdError.getDomain() +
                                ", Message: " + loadAdError.getMessage());

                            if (interstitialRetryCount < MAX_INTERSTITIAL_RETRIES) {
                                interstitialRetryCount++;
                                long delayMs = 2500L * interstitialRetryCount;
                                mainHandler.postDelayed(() -> {
                                    if (!isFinishing() && !isDestroyed()) {
                                        preloadInterstitial();
                                    }
                                }, delayMs);
                            }
                        }
                    }
                );
            } catch (Exception e) {
                isInterstitialLoading = false;
                Log.w(TAG, "preloadInterstitial exception: " + e.getMessage());
            }
        });
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
