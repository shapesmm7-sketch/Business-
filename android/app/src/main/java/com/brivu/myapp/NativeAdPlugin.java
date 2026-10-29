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
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

@CapacitorPlugin(name = "NativeAdPlugin")
public class NativeAdPlugin extends Plugin {
    private static final String TAG = "AdMobNativeAdvanced";

    // Official Google AdMob Native Test Ad Unit ID specified in requirements
    public static final String NATIVE_TEST_UNIT_ID = "ca-app-pub-3940256099942544/2247696110";
    // Standard Google Demo fallback ID in case of network rejection
    public static final String NATIVE_DEMO_FALLBACK_ID = "ca-app-pub-394025609942544/2247696110";

    private FrameLayout adContainer;
    private NativeAd currentNativeAd;
    private boolean isLoading = false;
    private boolean isVisible = false;

    @Override
    public void load() {
        super.load();
        new Handler(Looper.getMainLooper()).post(this::initAdContainer);
    }

    /**
     * Set up the container layout above the bottom navigation bar
     */
    private void initAdContainer() {
        try {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

            View content = activity.findViewById(android.R.id.content);
            if (!(content instanceof ViewGroup)) return;

            ViewGroup parentLayout = null;
            if (((ViewGroup) content).getChildCount() > 0 && ((ViewGroup) content).getChildAt(0) instanceof ViewGroup) {
                parentLayout = (ViewGroup) ((ViewGroup) content).getChildAt(0);
            } else {
                parentLayout = (ViewGroup) content;
            }

            if (adContainer == null) {
                adContainer = new FrameLayout(activity);
                adContainer.setId(View.generateViewId());
                adContainer.setVisibility(View.GONE);

                float density = activity.getResources().getDisplayMetrics().density;
                int bottomMargin = (int) (62 * density); // Above 5-tab bottom navigation
                int horizontalMargin = (int) (10 * density);

                if (parentLayout instanceof CoordinatorLayout) {
                    CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(
                        CoordinatorLayout.LayoutParams.MATCH_PARENT,
                        CoordinatorLayout.LayoutParams.WRAP_CONTENT
                    );
                    params.gravity = Gravity.BOTTOM;
                    params.setMargins(horizontalMargin, 0, horizontalMargin, bottomMargin);
                    adContainer.setLayoutParams(params);
                } else {
                    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT
                    );
                    params.gravity = Gravity.BOTTOM;
                    params.setMargins(horizontalMargin, 0, horizontalMargin, bottomMargin);
                    adContainer.setLayoutParams(params);
                }

                parentLayout.addView(adContainer);
                Log.i(TAG, "AdMob Native ad container initialized successfully");
            }

            // Begin loading ad
            requestAdMobNativeAd(NATIVE_TEST_UNIT_ID, false);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing ad container", e);
        }
    }

    /**
     * Request authentic Native Advanced ad from Google Mobile Ads SDK
     */
    public void requestAdMobNativeAd(final String adUnitId, final boolean isRetry) {
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

        activity.runOnUiThread(() -> {
            if (isLoading) return;
            isLoading = true;

            Log.i(TAG, "Requesting Real AdMob Native Advanced Test Ad with Unit ID: " + adUnitId);

            AdLoader adLoader = new AdLoader.Builder(activity, adUnitId)
                .forNativeAd(new NativeAd.OnNativeAdLoadedListener() {
                    @Override
                    public void onNativeAdLoaded(@NonNull NativeAd nativeAd) {
                        isLoading = false;
                        Log.i(TAG, "AdMob Native Advanced Ad loaded successfully! Headline: " + nativeAd.getHeadline());

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
                        Log.e(TAG, "AdMob Native Advanced Ad FAILED TO LOAD: Code=" + loadAdError.getCode()
                            + ", Message=" + loadAdError.getMessage()
                            + ", Domain=" + loadAdError.getDomain());

                        // If primary test ID failed, attempt standard demo unit ID once
                        if (!isRetry && !adUnitId.equals(NATIVE_DEMO_FALLBACK_ID)) {
                            Log.i(TAG, "Retrying AdMob Native Ad with standard demo unit ID: " + NATIVE_DEMO_FALLBACK_ID);
                            requestAdMobNativeAd(NATIVE_DEMO_FALLBACK_ID, true);
                        }
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
        if (activity == null || activity.isFinishing() || activity.isDestroyed() || adContainer == null) return;

        activity.runOnUiThread(() -> {
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
                        advertiserView.setVisibility(View.VISIBLE);
                    } else {
                        advertiserView.setText("Google AdMob Test Partner");
                        advertiserView.setVisibility(View.VISIBLE);
                    }
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
                        ctaButton.setVisibility(View.VISIBLE);
                        adView.setCallToActionView(ctaButton);
                    } else {
                        ctaButton.setText("Learn More");
                        ctaButton.setVisibility(View.VISIBLE);
                        adView.setCallToActionView(ctaButton);
                    }
                }

                // 5. Icon
                ImageView iconView = adView.findViewById(R.id.ad_app_icon);
                if (iconView != null) {
                    if (nativeAd.getIcon() != null && nativeAd.getIcon().getDrawable() != null) {
                        iconView.setImageDrawable(nativeAd.getIcon().getDrawable());
                        iconView.setVisibility(View.VISIBLE);
                        adView.setIconView(iconView);
                    } else {
                        iconView.setVisibility(View.GONE);
                    }
                }

                // 6. Media View
                MediaView mediaView = adView.findViewById(R.id.ad_media);
                if (mediaView != null) {
                    if (nativeAd.getMediaContent() != null) {
                        mediaView.setMediaContent(nativeAd.getMediaContent());
                        mediaView.setVisibility(View.VISIBLE);
                        adView.setMediaView(mediaView);
                    } else {
                        mediaView.setVisibility(View.GONE);
                    }
                }

                // 7. Star rating
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

                // 8. Price & Store
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

                // 9. Close button
                View closeBtn = adView.findViewById(R.id.ad_close_btn);
                if (closeBtn != null) {
                    closeBtn.setOnClickListener(v -> hideAdContainer());
                }

                // CRITICAL: Call setNativeAd to bind all views to AdMob SDK
                adView.setNativeAd(nativeAd);

                adContainer.addView(adView);
                adContainer.setVisibility(View.VISIBLE);
                isVisible = true;

                Log.i(TAG, "AdMob Native Advanced Ad successfully attached to view hierarchy!");
            } catch (Exception e) {
                Log.e(TAG, "Error displaying Native Ad view", e);
            }
        });
    }

    private void hideAdContainer() {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            if (adContainer != null) {
                adContainer.setVisibility(View.GONE);
                isVisible = false;
            }
        });
    }

    @PluginMethod
    public void loadNativeAd(PluginCall call) {
        String unitId = call.getString("adUnitId", NATIVE_TEST_UNIT_ID);
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
            if (adContainer != null && currentNativeAd != null) {
                adContainer.setVisibility(View.VISIBLE);
                isVisible = true;
            } else if (currentNativeAd == null && !isLoading) {
                requestAdMobNativeAd(NATIVE_TEST_UNIT_ID, false);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void hideNativeAd(PluginCall call) {
        hideAdContainer();
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

    @Override
    protected void handleOnDestroy() {
        if (currentNativeAd != null) {
            currentNativeAd.destroy();
            currentNativeAd = null;
        }
        super.handleOnDestroy();
    }
}
