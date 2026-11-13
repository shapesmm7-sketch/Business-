package com.brivu.myapp;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.RatingBar;
import android.widget.TextView;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

@CapacitorPlugin(name = "NativeAdPlugin")
public class NativeAdPlugin extends Plugin {
    private static final String TAG = "ADS";
    private static final int MAX_NATIVE_RETRIES = 2;

    // Live Google AdMob Native Ad Unit ID
    public static final String LIVE_NATIVE_AD_UNIT_ID = "ca-app-pub-8582659585800553/6584166086";

    public static String getNativeAdUnitId() {
        return LIVE_NATIVE_AD_UNIT_ID;
    }

    private static volatile NativeAdPlugin instance;

    public static NativeAdPlugin getInstance() {
        return instance;
    }

    public NativeAdPlugin() {
        super();
        instance = this;
    }

    private FrameLayout adContainer;
    private NativeAd currentNativeAd;
    private boolean isLoading = false;
    private boolean isVisible = false;
    private boolean hasPendingNativeRequest = false;
    private String pendingNativeUnitId = LIVE_NATIVE_AD_UNIT_ID;
    private int nativeRetryCount = 0;

    // Last requested slot coordinates & slot ownership token for inline placement
    private String activeSlotId = null;
    private int lastX = 0;
    private int lastY = 0;
    private int lastWidth = 0;
    private int lastHeight = 0;
    private boolean targetVisible = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        instance = this;
        mainHandler.post(this::initAdContainer);
    }

    /**
     * Set up the overlay container directly on android.R.id.content so setX/setY always layer above WebView
     */
    private void initAdContainer() {
        try {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

            View content = activity.findViewById(android.R.id.content);
            if (!(content instanceof ViewGroup)) return;
            ViewGroup rootContent = (ViewGroup) content;

            if (adContainer == null) {
                adContainer = new FrameLayout(activity);
                adContainer.setId(View.generateViewId());
                adContainer.setVisibility(View.GONE);
                adContainer.setElevation(24f);
                adContainer.setClickable(true);

                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                params.gravity = Gravity.TOP | Gravity.START;
                params.setMargins(0, 0, 0, 0);
                adContainer.setLayoutParams(params);

                rootContent.addView(adContainer);
                adContainer.bringToFront();
                Log.d(TAG, "AdMob Native ad container initialized");
            }

            if (currentNativeAd != null) {
                displayNativeAd(currentNativeAd);
            } else if (hasPendingNativeRequest && MainActivity.isInitialized()) {
                hasPendingNativeRequest = false;
                requestAdMobNativeAd(pendingNativeUnitId, false);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing ad container", e);
        }
    }

    /**
     * Ensures a native ad is loaded if initialized (e.g. from onResume or onInitializationComplete)
     */
    public void ensureNativeAdLoaded() {
        if (!MainActivity.isInitialized()) {
            hasPendingNativeRequest = true;
            return;
        }
        if (currentNativeAd == null && !isLoading) {
            String unitId = (pendingNativeUnitId != null && !pendingNativeUnitId.isEmpty())
                ? pendingNativeUnitId
                : getNativeAdUnitId();
            hasPendingNativeRequest = false;
            requestAdMobNativeAd(unitId, false);
        }
    }

    /**
     * Request authentic Native Advanced ad from Google Mobile Ads SDK
     */
    public void requestAdMobNativeAd(final String adUnitId, final boolean isRetry) {
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

        final String finalUnitId = (adUnitId != null && !adUnitId.isEmpty()) ? adUnitId : getNativeAdUnitId();

        if (!MainActivity.isInitialized()) {
            hasPendingNativeRequest = true;
            pendingNativeUnitId = finalUnitId;
            Log.d(TAG, "Queued Native Ad request until MobileAds initializes (isDebug=false). AdUnitId: " + finalUnitId);
            if (activity instanceof MainActivity) {
                ((MainActivity) activity).initializeMobileAdsOnce();
            }
            return;
        }

        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.isDestroyed()) return;
            if (isLoading) return;
            isLoading = true;
            hasPendingNativeRequest = false;
            if (!isRetry) {
                nativeRetryCount = 0;
            }

            Log.d(TAG, "Requesting Native Ad (isDebug=false). AdUnitId: " + finalUnitId);

            AdLoader adLoader = new AdLoader.Builder(activity, finalUnitId)
                .forNativeAd(new NativeAd.OnNativeAdLoadedListener() {
                    @Override
                    public void onNativeAdLoaded(@NonNull NativeAd nativeAd) {
                        isLoading = false;
                        nativeRetryCount = 0;
                        Log.d(TAG, "onAdLoaded: Native Ad loaded successfully (isDebug=false). AdUnitId: "
                            + finalUnitId + ", Headline: " + nativeAd.getHeadline());

                        if (currentNativeAd != null) {
                            currentNativeAd.destroy();
                        }
                        currentNativeAd = nativeAd;

                        displayNativeAd(nativeAd);
                    }
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        isLoading = false;
                        Log.d(TAG, "onAdFailedToLoad: Native Ad failed. AdUnitId: " + finalUnitId
                            + ", ErrorCode: " + loadAdError.getCode()
                            + ", Domain: " + loadAdError.getDomain()
                            + ", Message: " + loadAdError.getMessage());

                        if (nativeRetryCount < MAX_NATIVE_RETRIES) {
                            nativeRetryCount++;
                            long delayMs = 2500L * nativeRetryCount;
                            mainHandler.postDelayed(() -> {
                                Activity act = getActivity();
                                if (act != null && !act.isFinishing() && !act.isDestroyed() && currentNativeAd == null) {
                                    requestAdMobNativeAd(finalUnitId, true);
                                }
                            }, delayMs);
                        }
                    }

                    @Override
                    public void onAdImpression() {
                        Log.d(TAG, "Native Ad impression recorded. AdUnitId: " + finalUnitId);
                    }

                    @Override
                    public void onAdClicked() {
                        Log.d(TAG, "Native Ad clicked. AdUnitId: " + finalUnitId);
                    }
                })
                .withNativeAdOptions(new NativeAdOptions.Builder().build())
                .build();

            adLoader.loadAd(new AdRequest.Builder().build());
        });
    }

    /**
     * Populate and render real native assets into the NativeAdView
     */
    private void displayNativeAd(final NativeAd nativeAd) {
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

        activity.runOnUiThread(() -> {
            if (adContainer == null) {
                initAdContainer();
            }
            if (adContainer == null) return;

            try {
                adContainer.removeAllViews();

                NativeAdView adView = (NativeAdView) LayoutInflater.from(activity).inflate(
                    R.layout.admob_native_ad_view,
                    adContainer,
                    false
                );

                // 1. Headline
                TextView headlineView = adView.findViewById(R.id.ad_headline);
                if (headlineView != null) {
                    headlineView.setText(nativeAd.getHeadline());
                    adView.setHeadlineView(headlineView);
                }

                // 2. Advertiser
                TextView advertiserView = adView.findViewById(R.id.ad_advertiser);
                if (advertiserView != null) {
                    if (nativeAd.getAdvertiser() != null && !nativeAd.getAdvertiser().isEmpty()) {
                        advertiserView.setText(nativeAd.getAdvertiser());
                    } else {
                        advertiserView.setText("Sponsored");
                    }
                    advertiserView.setVisibility(View.VISIBLE);
                    adView.setAdvertiserView(advertiserView);
                }

                // 3. Body text
                TextView bodyView = adView.findViewById(R.id.ad_body);
                if (bodyView != null) {
                    if (nativeAd.getBody() != null && !nativeAd.getBody().isEmpty()) {
                        bodyView.setText(nativeAd.getBody());
                        bodyView.setVisibility(View.VISIBLE);
                        adView.setBodyView(bodyView);
                    } else {
                        bodyView.setVisibility(View.GONE);
                    }
                }

                // 4. Call to Action Button
                Button ctaButton = adView.findViewById(R.id.ad_call_to_action);
                if (ctaButton != null) {
                    if (nativeAd.getCallToAction() != null && !nativeAd.getCallToAction().isEmpty()) {
                        ctaButton.setText(nativeAd.getCallToAction());
                    } else {
                        ctaButton.setText("Learn More");
                    }
                    ctaButton.setVisibility(View.VISIBLE);
                    adView.setCallToActionView(ctaButton);
                }

                // 5. Compact Icon & Media thumbnail
                ImageView iconView = adView.findViewById(R.id.ad_app_icon);
                MediaView mediaView = adView.findViewById(R.id.ad_media);

                if (iconView != null && nativeAd.getIcon() != null && nativeAd.getIcon().getDrawable() != null) {
                    iconView.setImageDrawable(nativeAd.getIcon().getDrawable());
                    iconView.setVisibility(View.VISIBLE);
                    adView.setIconView(iconView);
                    if (mediaView != null) mediaView.setVisibility(View.GONE);
                } else if (mediaView != null && nativeAd.getMediaContent() != null) {
                    mediaView.setMediaContent(nativeAd.getMediaContent());
                    mediaView.setVisibility(View.VISIBLE);
                    adView.setMediaView(mediaView);
                    if (iconView != null) iconView.setVisibility(View.GONE);
                } else if (iconView != null) {
                    iconView.setVisibility(View.GONE);
                }

                // 6. Star rating (optional)
                RatingBar ratingBar = adView.findViewById(R.id.ad_stars);
                if (ratingBar != null) {
                    if (nativeAd.getStarRating() != null && nativeAd.getStarRating() > 0) {
                        ratingBar.setRating(nativeAd.getStarRating().floatValue());
                        ratingBar.setVisibility(View.VISIBLE);
                        adView.setStarRatingView(ratingBar);
                    } else {
                        ratingBar.setVisibility(View.GONE);
                    }
                }

                // 7. Price & Store (optional)
                TextView priceView = adView.findViewById(R.id.ad_price);
                if (priceView != null) {
                    if (nativeAd.getPrice() != null && !nativeAd.getPrice().isEmpty()) {
                        priceView.setText(nativeAd.getPrice());
                        priceView.setVisibility(View.VISIBLE);
                        adView.setPriceView(priceView);
                    } else {
                        priceView.setVisibility(View.GONE);
                    }
                }

                TextView storeView = adView.findViewById(R.id.ad_store);
                if (storeView != null) {
                    if (nativeAd.getStore() != null && !nativeAd.getStore().isEmpty()) {
                        storeView.setText(nativeAd.getStore());
                        storeView.setVisibility(View.VISIBLE);
                        adView.setStoreView(storeView);
                    } else {
                        storeView.setVisibility(View.GONE);
                    }
                }

                // 8. Close button
                View closeBtn = adView.findViewById(R.id.ad_close_btn);
                if (closeBtn != null) {
                    closeBtn.setOnClickListener(v -> hideAdContainer(null));
                }

                // CRITICAL: Call setNativeAd to bind all views to AdMob SDK
                adView.setNativeAd(nativeAd);

                adContainer.addView(adView);

                // Apply target placement if one was already requested
                if (targetVisible && lastWidth > 0) {
                    applyAdPosition(lastX, lastY, lastWidth, lastHeight, true);
                } else {
                    adContainer.setVisibility(View.GONE);
                    isVisible = false;
                }

                Log.i(TAG, "AdMob Native Advanced Ad successfully configured in inline view");
            } catch (Exception e) {
                Log.e(TAG, "Error displaying Native Ad view", e);
            }
        });
    }

    private void applyAdPosition(int x, int y, int width, int height, boolean visible) {
        if (adContainer == null) {
            initAdContainer();
        }
        if (adContainer == null) return;

        if (!visible || currentNativeAd == null || width <= 0 || height <= 0) {
            adContainer.setVisibility(View.GONE);
            isVisible = false;
            return;
        }

        // Map WebView DOM coordinates (viewport px) accurately onto android.R.id.content
        int offsetX = 0;
        int offsetY = 0;
        try {
            View webView = getBridge() != null ? getBridge().getWebView() : null;
            View parent = adContainer.getParent() instanceof View ? (View) adContainer.getParent() : null;
            if (webView != null && parent != null) {
                int[] webLoc = new int[2];
                int[] parentLoc = new int[2];
                webView.getLocationInWindow(webLoc);
                parent.getLocationInWindow(parentLoc);
                offsetX = webLoc[0] - parentLoc[0];
                offsetY = webLoc[1] - parentLoc[1];
            }
        } catch (Exception ignored) {}

        ViewGroup.LayoutParams lp = adContainer.getLayoutParams();
        if (lp != null) {
            lp.width = width;
            lp.height = height;
            adContainer.setLayoutParams(lp);
        }

        adContainer.setX((float) (x + offsetX));
        adContainer.setY((float) (y + offsetY));
        adContainer.bringToFront();
        adContainer.setVisibility(View.VISIBLE);
        adContainer.requestLayout();
        isVisible = true;
    }

    private void hideAdContainer(String slotId) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            // Only hide if caller didn't specify a slotId or caller owns the currently active slot
            if (slotId != null && activeSlotId != null && !slotId.equals(activeSlotId)) {
                return;
            }
            targetVisible = false;
            if (adContainer != null) {
                adContainer.setVisibility(View.GONE);
                isVisible = false;
            }
        });
    }

    @PluginMethod
    public void initializeAds(PluginCall call) {
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).initializeMobileAdsOnce();
        }
        JSObject ret = new JSObject();
        ret.put("initialized", MainActivity.isInitialized());
        call.resolve(ret);
    }

    @PluginMethod
    public void updatePosition(PluginCall call) {
        final int x = call.getInt("x", 0);
        final int y = call.getInt("y", 0);
        final int width = call.getInt("width", 0);
        final int height = call.getInt("height", 0);
        final boolean visible = call.getBoolean("visible", false);
        final String slotId = call.getString("slotId");

        if (visible && slotId != null && !slotId.isEmpty()) {
            activeSlotId = slotId;
        }

        // Ignore stale visibility=false updates from an inactive slot
        if (slotId != null && activeSlotId != null && !slotId.equals(activeSlotId)) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            return;
        }

        lastX = x;
        lastY = y;
        lastWidth = width;
        lastHeight = height;
        targetVisible = visible;

        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> {
            applyAdPosition(x, y, width, height, visible);
            if (visible && currentNativeAd == null && !isLoading) {
                requestAdMobNativeAd(getNativeAdUnitId(), false);
            }
        });

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void loadNativeAd(PluginCall call) {
        String unitId = call.getString("adUnitId", getNativeAdUnitId());
        requestAdMobNativeAd(unitId, false);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showNativeAd(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        activity.runOnUiThread(() -> {
            if (adContainer != null && currentNativeAd != null && targetVisible && lastWidth > 0) {
                applyAdPosition(lastX, lastY, lastWidth, lastHeight, true);
            } else if (currentNativeAd == null && !isLoading) {
                requestAdMobNativeAd(getNativeAdUnitId(), false);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void hideNativeAd(PluginCall call) {
        String slotId = call.getString("slotId");
        hideAdContainer(slotId);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isAdLoaded(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("loaded", currentNativeAd != null);
        ret.put("visible", isVisible);
        call.resolve(ret);
    }

    @PluginMethod
    public void prepareInterstitial(PluginCall call) {
        Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).preloadInterstitial();
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        activity.runOnUiThread(() -> {
            final com.google.android.gms.ads.interstitial.InterstitialAd interstitialAd = MainActivity.getInterstitialAd();
            final String interstitialId = MainActivity.getInterstitialAdUnitId();
            if (interstitialAd != null) {
                Log.d(TAG, "Showing Interstitial Ad (isDebug=false). AdUnitId: " + interstitialId);
                interstitialAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override
                    public void onAdShowedFullScreenContent() {
                        Log.d(TAG, "Interstitial Ad showed full screen content. AdUnitId: " + interstitialId);
                    }

                    @Override
                    public void onAdImpression() {
                        Log.d(TAG, "Interstitial Ad impression recorded. AdUnitId: " + interstitialId);
                    }

                    @Override
                    public void onAdDismissedFullScreenContent() {
                        Log.d(TAG, "Interstitial Ad dismissed. Preloading next ad. AdUnitId: " + interstitialId);
                        MainActivity.clearInterstitialAd();
                        if (activity instanceof MainActivity && !activity.isFinishing() && !activity.isDestroyed()) {
                            ((MainActivity) activity).preloadInterstitial();
                        }
                    }

                    @Override
                    public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                        Log.d(TAG, "Interstitial Ad failed to show. AdUnitId: " + interstitialId +
                            ", Code: " + adError.getCode() + ", Message: " + adError.getMessage());
                        MainActivity.clearInterstitialAd();
                        if (activity instanceof MainActivity && !activity.isFinishing() && !activity.isDestroyed()) {
                            ((MainActivity) activity).preloadInterstitial();
                        }
                    }
                });
                MainActivity.clearInterstitialAd();
                interstitialAd.show(activity);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } else {
                Log.d(TAG, "No preloaded Interstitial Ad ready (isDebug=false). AdUnitId: " + interstitialId + ". Requesting preload.");
                if (activity instanceof MainActivity) {
                    ((MainActivity) activity).preloadInterstitial();
                }
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("message", "Ad loading in background");
                call.resolve(ret);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        if (currentNativeAd != null) {
            currentNativeAd.destroy();
            currentNativeAd = null;
        }
        super.handleOnDestroy();
    }
}
