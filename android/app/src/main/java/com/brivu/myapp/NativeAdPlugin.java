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
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

@CapacitorPlugin(name = "NativeAdPlugin")
public class NativeAdPlugin extends Plugin {
    private static final String TAG = "ADS";
    private static final int MAX_NATIVE_RETRIES = 2;
    private static final int MAX_AD_POOL_SIZE = 2;
    private static final int MAX_HOLDER_COUNT = 6;

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

    private static class AdSlotHolder {
        final String slotId;
        FrameLayout container;
        NativeAd nativeAd;
        int x;
        int y;
        int width;
        int height;
        int clipTop;
        int clipBottom;
        int jsScrollX;
        int jsScrollY;
        int docX;
        int docY;
        boolean visible;
        int appliedWidth = -1;
        int appliedHeight = -1;
        long lastActiveAt = System.currentTimeMillis();

        AdSlotHolder(String slotId) {
            this.slotId = slotId;
        }
    }

    private FrameLayout viewportClipContainer;
    private final Map<String, AdSlotHolder> slotHolders = new LinkedHashMap<>();
    private final Deque<NativeAd> preloadedAdPool = new ArrayDeque<>();

    private boolean isLoading = false;
    private boolean hasPendingNativeRequest = false;
    private String pendingNativeUnitId = LIVE_NATIVE_AD_UNIT_ID;
    private int nativeRetryCount = 0;

    // Cached clip container geometry to avoid triggering requestLayout on every scroll frame
    private int appliedClipOffsetX = Integer.MIN_VALUE;
    private int appliedClipOffsetY = Integer.MIN_VALUE;
    private int appliedClipWidth = -1;
    private int appliedClipHeight = -1;
    private int lastEffectiveClipTop = 0;
    private int lastEffectiveClipBottom = 0;
    private boolean scrollListenerAttached = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        instance = this;
        mainHandler.post(this::initAdContainer);
    }

    /**
     * Set up a clipped viewport container on android.R.id.content and lock native scroll tracking
     * directly to WebView's UI-thread scroll callback so ads never shake or jitter during scroll.
     */
    private void initAdContainer() {
        try {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

            View content = activity.findViewById(android.R.id.content);
            if (!(content instanceof ViewGroup)) return;
            ViewGroup rootContent = (ViewGroup) content;

            if (viewportClipContainer == null) {
                viewportClipContainer = new FrameLayout(activity);
                viewportClipContainer.setId(View.generateViewId());
                viewportClipContainer.setVisibility(View.GONE);
                viewportClipContainer.setClipChildren(true);
                viewportClipContainer.setClipToPadding(true);
                viewportClipContainer.setOutlineProvider(android.view.ViewOutlineProvider.BOUNDS);
                viewportClipContainer.setClipToOutline(true);

                FrameLayout.LayoutParams clipParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                );
                clipParams.gravity = Gravity.TOP | Gravity.START;
                clipParams.setMargins(0, 0, 0, 0);
                viewportClipContainer.setLayoutParams(clipParams);

                rootContent.addView(viewportClipContainer);
                viewportClipContainer.bringToFront();
                Log.d(TAG, "AdMob Native ad clipped container initialized");
            }

            if (!scrollListenerAttached && getBridge() != null && getBridge().getWebView() != null) {
                View webView = getBridge().getWebView();
                webView.setOnScrollChangeListener((v, scrollX, scrollY, oldScrollX, oldScrollY) ->
                    syncVisibleSlotsToNativeScroll(scrollX, scrollY)
                );
                scrollListenerAttached = true;
            }

            if (hasPendingNativeRequest && MainActivity.isInitialized()) {
                hasPendingNativeRequest = false;
                requestAdMobNativeAd(pendingNativeUnitId, false);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing ad container", e);
        }
    }

    /**
     * Ensures at least one native ad is preloaded in pool when initialized.
     */
    public void ensureNativeAdLoaded() {
        if (!MainActivity.isInitialized()) {
            hasPendingNativeRequest = true;
            return;
        }
        if (preloadedAdPool.isEmpty() && !isLoading) {
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
            if (preloadedAdPool.size() >= MAX_AD_POOL_SIZE && !hasUnfilledVisibleHolder()) {
                return;
            }
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

                        if (activity.isFinishing() || activity.isDestroyed()) {
                            nativeAd.destroy();
                            return;
                        }

                        // Assign immediately to any visible holder waiting for an ad
                        AdSlotHolder target = findNextUnfilledHolder();
                        if (target != null) {
                            bindNativeAdToHolder(target, nativeAd);
                            applySlotPosition(target);
                        } else {
                            // Keep in preloaded pool for instant attachment to upcoming slots
                            while (preloadedAdPool.size() >= MAX_AD_POOL_SIZE) {
                                NativeAd oldest = preloadedAdPool.pollFirst();
                                if (oldest != null) oldest.destroy();
                            }
                            preloadedAdPool.offerLast(nativeAd);
                        }

                        // Warm one extra ad in pool if another unfilled visible slot needs one
                        if (hasUnfilledVisibleHolder() && preloadedAdPool.isEmpty()) {
                            requestAdMobNativeAd(finalUnitId, false);
                        }
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
                                if (act != null && !act.isFinishing() && !act.isDestroyed()
                                    && (preloadedAdPool.isEmpty() || hasUnfilledVisibleHolder())) {
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

    private boolean hasUnfilledVisibleHolder() {
        for (AdSlotHolder h : slotHolders.values()) {
            if (h.visible && h.nativeAd == null) {
                return true;
            }
        }
        return false;
    }

    private AdSlotHolder findNextUnfilledHolder() {
        for (AdSlotHolder h : slotHolders.values()) {
            if (h.visible && h.nativeAd == null) {
                return h;
            }
        }
        return null;
    }

    private void evictOldestHiddenHolderIfNeeded() {
        if (slotHolders.size() < MAX_HOLDER_COUNT) return;
        AdSlotHolder oldestHidden = null;
        for (AdSlotHolder h : slotHolders.values()) {
            if (!h.visible) {
                if (oldestHidden == null || h.lastActiveAt < oldestHidden.lastActiveAt) {
                    oldestHidden = h;
                }
            }
        }
        if (oldestHidden != null) {
            removeAndDestroyHolder(oldestHidden.slotId);
        }
    }

    private void removeAndDestroyHolder(String slotId) {
        AdSlotHolder holder = slotHolders.remove(slotId);
        if (holder == null) return;
        if (holder.container != null) {
            holder.container.removeAllViews();
            if (viewportClipContainer != null) {
                viewportClipContainer.removeView(holder.container);
            }
        }
        if (holder.nativeAd != null) {
            holder.nativeAd.destroy();
            holder.nativeAd = null;
        }
    }

    private AdSlotHolder getOrCreateHolder(String slotId) {
        AdSlotHolder holder = slotHolders.get(slotId);
        if (holder != null) {
            return holder;
        }
        evictOldestHiddenHolderIfNeeded();

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return null;

        if (viewportClipContainer == null) {
            initAdContainer();
        }
        if (viewportClipContainer == null) return null;

        holder = new AdSlotHolder(slotId);
        holder.container = new FrameLayout(activity);
        holder.container.setId(View.generateViewId());
        holder.container.setVisibility(View.GONE);
        holder.container.setClickable(true);
        holder.container.setClipChildren(true);
        holder.container.setOutlineProvider(android.view.ViewOutlineProvider.BOUNDS);
        holder.container.setClipToOutline(true);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.setMargins(0, 0, 0, 0);
        holder.container.setLayoutParams(params);

        viewportClipContainer.addView(holder.container);
        slotHolders.put(slotId, holder);

        // Immediately attach a preloaded NativeAd if available in pool
        NativeAd pooled = preloadedAdPool.pollFirst();
        if (pooled != null) {
            bindNativeAdToHolder(holder, pooled);
            if (preloadedAdPool.isEmpty() && !isLoading) {
                requestAdMobNativeAd(getNativeAdUnitId(), false);
            }
        } else if (!isLoading) {
            requestAdMobNativeAd(getNativeAdUnitId(), false);
        }

        return holder;
    }

    /**
     * Populate and bind real native assets into a slot holder's NativeAdView
     */
    private void bindNativeAdToHolder(final AdSlotHolder holder, final NativeAd nativeAd) {
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed() || holder.container == null) {
            nativeAd.destroy();
            return;
        }

        try {
            holder.container.removeAllViews();
            if (holder.nativeAd != null && holder.nativeAd != nativeAd) {
                holder.nativeAd.destroy();
            }
            holder.nativeAd = nativeAd;

            NativeAdView adView = (NativeAdView) LayoutInflater.from(activity).inflate(
                R.layout.admob_native_ad_view,
                holder.container,
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

            // 8. Close button hides only this slot
            View closeBtn = adView.findViewById(R.id.ad_close_btn);
            if (closeBtn != null) {
                closeBtn.setOnClickListener(v -> hideSlot(holder.slotId, false));
            }

            // CRITICAL: Call setNativeAd to bind all views to AdMob SDK
            adView.setNativeAd(nativeAd);
            holder.container.addView(adView);

            Log.i(TAG, "AdMob Native Advanced Ad bound to slot " + holder.slotId);
        } catch (Exception e) {
            Log.e(TAG, "Error displaying Native Ad view for slot " + holder.slotId, e);
        }
    }

    private void updateClipContainerGeometry(int clipTop, int clipBottom) {
        if (viewportClipContainer == null) return;

        int offsetX = 0;
        int offsetY = 0;
        int webViewWidth = 0;
        int webViewHeight = 0;
        try {
            View webView = getBridge() != null ? getBridge().getWebView() : null;
            View root = viewportClipContainer.getParent() instanceof View ? (View) viewportClipContainer.getParent() : null;
            if (webView != null && root != null) {
                int[] webLoc = new int[2];
                int[] rootLoc = new int[2];
                webView.getLocationInWindow(webLoc);
                root.getLocationInWindow(rootLoc);
                offsetX = webLoc[0] - rootLoc[0];
                offsetY = webLoc[1] - rootLoc[1];
                webViewWidth = webView.getWidth();
                webViewHeight = webView.getHeight();
            }
        } catch (Exception ignored) {}

        int effectiveClipTop = Math.max(0, clipTop);
        int effectiveClipBottom = (clipBottom > effectiveClipTop)
            ? clipBottom
            : (webViewHeight > 0 ? webViewHeight : Integer.MAX_VALUE);

        lastEffectiveClipTop = effectiveClipTop;
        lastEffectiveClipBottom = effectiveClipBottom;

        boolean hasAnyVisibleSlot = false;
        for (AdSlotHolder h : slotHolders.values()) {
            if (h.visible && h.nativeAd != null && h.width > 0 && h.height > 0) {
                hasAnyVisibleSlot = true;
                break;
            }
        }

        if (!hasAnyVisibleSlot || effectiveClipBottom <= effectiveClipTop) {
            if (viewportClipContainer.getVisibility() != View.GONE) {
                viewportClipContainer.setVisibility(View.GONE);
            }
            return;
        }

        int targetClipWidth = webViewWidth > 0 ? webViewWidth : ViewGroup.LayoutParams.MATCH_PARENT;
        int targetClipHeight = effectiveClipBottom - effectiveClipTop;

        if (appliedClipWidth != targetClipWidth || appliedClipHeight != targetClipHeight) {
            ViewGroup.LayoutParams clipLp = viewportClipContainer.getLayoutParams();
            if (clipLp != null) {
                clipLp.width = targetClipWidth;
                clipLp.height = targetClipHeight;
                viewportClipContainer.setLayoutParams(clipLp);
            }
            appliedClipWidth = targetClipWidth;
            appliedClipHeight = targetClipHeight;
        }

        int targetClipX = offsetX;
        int targetClipY = offsetY + effectiveClipTop;
        if (appliedClipOffsetX != targetClipX) {
            viewportClipContainer.setX((float) targetClipX);
            appliedClipOffsetX = targetClipX;
        }
        if (appliedClipOffsetY != targetClipY) {
            viewportClipContainer.setY((float) targetClipY);
            appliedClipOffsetY = targetClipY;
        }

        if (viewportClipContainer.getVisibility() != View.VISIBLE) {
            viewportClipContainer.bringToFront();
            viewportClipContainer.setVisibility(View.VISIBLE);
        }
    }

    private float computeRenderY(AdSlotHolder holder, int curWebScrollY) {
        int rawViewportY;
        float density = 3.0f;
        try {
            if (getContext() != null) {
                density = getContext().getResources().getDisplayMetrics().density;
            }
        } catch (Exception ignored) {}

        // Use real-time WebView UI-thread scroll offset when within normal momentum range
        int maxDelta = (int) (320 * density);
        if (Math.abs(curWebScrollY - holder.jsScrollY) <= maxDelta) {
            rawViewportY = holder.docY - curWebScrollY;
        } else {
            rawViewportY = holder.y;
        }
        return (float) (rawViewportY - lastEffectiveClipTop);
    }

    private void applySlotPosition(AdSlotHolder holder) {
        if (viewportClipContainer == null) {
            initAdContainer();
        }
        if (viewportClipContainer == null || holder == null || holder.container == null) return;

        updateClipContainerGeometry(holder.clipTop, holder.clipBottom);

        if (!holder.visible || holder.nativeAd == null || holder.width <= 0 || holder.height <= 0) {
            if (holder.container.getVisibility() != View.GONE) {
                holder.container.setVisibility(View.GONE);
            }
            return;
        }

        // Only call setLayoutParams if width or height actually changed (prevents scroll layout thrash)
        if (holder.appliedWidth != holder.width || holder.appliedHeight != holder.height) {
            ViewGroup.LayoutParams lp = holder.container.getLayoutParams();
            if (lp != null) {
                lp.width = holder.width;
                lp.height = holder.height;
                holder.container.setLayoutParams(lp);
            }
            holder.appliedWidth = holder.width;
            holder.appliedHeight = holder.height;
        }

        int curWebScrollY = 0;
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                curWebScrollY = getBridge().getWebView().getScrollY();
            }
        } catch (Exception ignored) {}

        float renderY = computeRenderY(holder, curWebScrollY);
        holder.container.setX((float) holder.x);
        holder.container.setY(renderY);

        int clipHeight = Math.max(0, lastEffectiveClipBottom - lastEffectiveClipTop);
        boolean withinClip = (renderY + holder.height) > 0 && renderY < clipHeight;
        int desiredVis = withinClip ? View.VISIBLE : View.INVISIBLE;
        if (holder.container.getVisibility() != desiredVis) {
            holder.container.setVisibility(desiredVis);
        }
    }

    /**
     * Synchronous Android UI-thread scroll update: moves every active native ad container in the
     * exact same vsync frame as the WebView scroll with zero layout passes or bridge lag.
     */
    private void syncVisibleSlotsToNativeScroll(int scrollX, int scrollY) {
        if (viewportClipContainer == null || slotHolders.isEmpty()) return;
        int clipHeight = Math.max(0, lastEffectiveClipBottom - lastEffectiveClipTop);
        if (clipHeight <= 0) return;

        for (AdSlotHolder holder : slotHolders.values()) {
            if (!holder.visible || holder.nativeAd == null || holder.container == null) continue;
            float renderY = computeRenderY(holder, scrollY);
            holder.container.setY(renderY);

            boolean withinClip = (renderY + holder.height) > 0 && renderY < clipHeight;
            int desiredVis = withinClip ? View.VISIBLE : View.INVISIBLE;
            if (holder.container.getVisibility() != desiredVis) {
                holder.container.setVisibility(desiredVis);
            }
        }
    }

    private void hideSlot(String slotId, boolean remove) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            if (slotId == null || slotId.isEmpty()) {
                for (AdSlotHolder h : slotHolders.values()) {
                    h.visible = false;
                    if (h.container != null) h.container.setVisibility(View.GONE);
                }
                if (viewportClipContainer != null) {
                    viewportClipContainer.setVisibility(View.GONE);
                }
                return;
            }

            if (remove) {
                removeAndDestroyHolder(slotId);
            } else {
                AdSlotHolder h = slotHolders.get(slotId);
                if (h != null) {
                    h.visible = false;
                    if (h.container != null) h.container.setVisibility(View.GONE);
                }
            }

            // Keep viewportClipContainer visible only if another slot is still visible
            boolean anyVisible = false;
            for (AdSlotHolder h : slotHolders.values()) {
                if (h.visible && h.nativeAd != null) {
                    anyVisible = true;
                    break;
                }
            }
            if (!anyVisible && viewportClipContainer != null) {
                viewportClipContainer.setVisibility(View.GONE);
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
        final int clipTop = call.getInt("clipTop", 0);
        final int clipBottom = call.getInt("clipBottom", 0);
        final int scrollX = call.getInt("scrollX", 0);
        final int scrollY = call.getInt("scrollY", 0);
        final boolean visible = call.getBoolean("visible", false);
        final String slotId = call.getString("slotId", "default-slot");

        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> {
            if (!visible) {
                AdSlotHolder existing = slotHolders.get(slotId);
                if (existing != null) {
                    existing.visible = false;
                    existing.x = x;
                    existing.y = y;
                    existing.jsScrollX = scrollX;
                    existing.jsScrollY = scrollY;
                    existing.docX = x + scrollX;
                    existing.docY = y + scrollY;
                    applySlotPosition(existing);
                }
                return;
            }

            AdSlotHolder holder = getOrCreateHolder(slotId);
            if (holder == null) return;

            holder.x = x;
            holder.y = y;
            holder.width = width;
            holder.height = height;
            holder.clipTop = clipTop;
            holder.clipBottom = clipBottom;
            holder.jsScrollX = scrollX;
            holder.jsScrollY = scrollY;
            holder.docX = x + scrollX;
            holder.docY = y + scrollY;
            holder.visible = true;
            holder.lastActiveAt = System.currentTimeMillis();

            applySlotPosition(holder);
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
            for (AdSlotHolder h : slotHolders.values()) {
                if (h.visible) {
                    applySlotPosition(h);
                }
            }
            if (preloadedAdPool.isEmpty() && !isLoading) {
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
        boolean remove = call.getBoolean("remove", false);
        hideSlot(slotId, remove);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isAdLoaded(PluginCall call) {
        boolean hasLoaded = !preloadedAdPool.isEmpty();
        boolean anyVisible = false;
        for (AdSlotHolder h : slotHolders.values()) {
            if (h.nativeAd != null) hasLoaded = true;
            if (h.visible && h.nativeAd != null) anyVisible = true;
        }
        JSObject ret = new JSObject();
        ret.put("loaded", hasLoaded);
        ret.put("visible", anyVisible);
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
        Iterator<AdSlotHolder> it = slotHolders.values().iterator();
        while (it.hasNext()) {
            AdSlotHolder h = it.next();
            if (h.nativeAd != null) {
                h.nativeAd.destroy();
                h.nativeAd = null;
            }
            it.remove();
        }
        while (!preloadedAdPool.isEmpty()) {
            NativeAd ad = preloadedAdPool.pollFirst();
            if (ad != null) ad.destroy();
        }
        super.handleOnDestroy();
    }
}
