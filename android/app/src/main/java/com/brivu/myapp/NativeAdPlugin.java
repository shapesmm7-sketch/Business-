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

    // Last requested slot coordinates for inline positioning
    private int lastX = 0;
    private int lastY = 0;
    private int lastWidth = 0;
    private int lastHeight = 0;
    private boolean targetVisible = false;

    @Override
    public void load() {
        super.load();
        new Handler(Looper.getMainLooper()).post(this::initAdContainer);
    }

    /**
     * Set up the container layout for dynamic inline placement
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

                // Use TOP | START gravity so setX() and setY() place the ad exactly at inline slot coordinates
                if (parentLayout instanceof CoordinatorLayout) {
                    CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    );
                    params.gravity = Gravity.TOP | Gravity.START;
                    params.setMargins(0, 0, 0, 0);
                    adContainer.setLayoutParams(params);
                } else {
                    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    );
                    params.gravity = Gravity.TOP | Gravity.START;
                    params.setMargins(0, 0, 0, 0);
                    adContainer.setLayoutParams(params);
                }

                parentLayout.addView(adContainer);
                Log.i(TAG, "AdMob Native ad container initialized for dynamic inline placement");
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
                    } else {
                        advertiserView.setText("Google AdMob Test Partner");
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
                    closeBtn.setOnClickListener(v -> hideAdContainer());
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

                Log.i(TAG, "AdMob Native Advanced Ad successfully configured in compact view");
            } catch (Exception e) {
                Log.e(TAG, "Error displaying Native Ad view", e);
            }
        });
    }

    private void applyAdPosition(int x, int y, int width, int height, boolean visible) {
        if (adContainer == null) return;
        if (!visible || currentNativeAd == null) {
            adContainer.setVisibility(View.GONE);
            isVisible = false;
            return;
        }

        ViewGroup.LayoutParams lp = adContainer.getLayoutParams();
        if (lp != null) {
            if (width > 0) lp.width = width;
            if (height > 0) lp.height = height;
            adContainer.setLayoutParams(lp);
        }

        adContainer.setX((float) x);
        adContainer.setY((float) y);
        adContainer.setVisibility(View.VISIBLE);
        isVisible = true;
    }

    private void hideAdContainer() {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            targetVisible = false;
            if (adContainer != null) {
                adContainer.setVisibility(View.GONE);
                isVisible = false;
            }
        });
    }

    @PluginMethod
    public void updatePosition(PluginCall call) {
        final int x = call.getInt("x", 0);
        final int y = call.getInt("y", 0);
        final int width = call.getInt("width", 0);
        final int height = call.getInt("height", 0);
        final boolean visible = call.getBoolean("visible", false);

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
                requestAdMobNativeAd(NATIVE_TEST_UNIT_ID, false);
            }
        });

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
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
            if (adContainer != null && currentNativeAd != null && targetVisible) {
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
