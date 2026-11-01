package com.brivu.myapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "PlayBillingPlugin")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener, BillingClientStateListener {
    private static final String TAG = "PlayBillingPlugin";

    // Known candidate subscription product IDs configured in Google Play Console
    public static final String[] CANDIDATE_PRODUCT_IDS = new String[] {
        // Monthly candidates
        "brivu_pro_monthly",
        "brivu_monthly",
        "brivu_pro_1month",
        "brivu_1_month",
        // 6-Month candidates
        "brivu_pro_semi_annual_v2",
        "brivu_pro_semi_annual",
        "brivu_pro_6months",
        "brivu_semi_annual",
        "brivu_6months",
        // 1-Year candidates
        "brivu_pro_yearly",
        "brivu_pro_annual",
        "brivu_pro_1year",
        "brivu_yearly",
        "brivu_annual",
        "brivu_1year"
    };

    private BillingClient billingClient;
    private boolean isConnected = false;
    private final Map<String, ProductDetails> cachedProductDetails = new HashMap<>();
    private PluginCall pendingPurchaseCall = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        initBillingClient();
    }

    private synchronized void initBillingClient() {
        if (billingClient != null) {
            return;
        }
        try {
            PendingPurchasesParams pendingParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .enablePrepaidPlans()
                .build();

            billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(pendingParams)
                .build();

            startBillingConnection(null);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing BillingClient", e);
        }
    }

    private void startBillingConnection(@Nullable Runnable onConnected) {
        if (billingClient == null) return;
        if (isConnected) {
            if (onConnected != null) onConnected.run();
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    isConnected = true;
                    Log.i(TAG, "Google Play Billing setup completed successfully.");
                    preloadProductDetails();
                    if (onConnected != null) {
                        mainHandler.post(onConnected);
                    }
                } else {
                    isConnected = false;
                    Log.w(TAG, "Google Play Billing setup failed: " + billingResult.getDebugMessage() + " (Code " + billingResult.getResponseCode() + ")");
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                isConnected = false;
                Log.w(TAG, "Google Play Billing service disconnected.");
            }
        });
    }

    private void preloadProductDetails() {
        if (billingClient == null || !isConnected) return;

        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        for (String id : CANDIDATE_PRODUCT_IDS) {
            productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            );
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build();

        billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
            @Override
            public void onProductDetailsResponse(@NonNull BillingResult billingResult, @NonNull QueryProductDetailsResult queryProductDetailsResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    List<ProductDetails> list = queryProductDetailsResult.getProductDetailsList();
                    synchronized (cachedProductDetails) {
                        cachedProductDetails.clear();
                        for (ProductDetails pd : list) {
                            cachedProductDetails.put(pd.getProductId(), pd);
                            Log.i(TAG, "Loaded subscription product: " + pd.getProductId() + " - " + pd.getTitle());
                        }
                    }
                } else {
                    Log.w(TAG, "Query product details failed: " + billingResult.getDebugMessage());
                }
            }
        });
    }

    @Override
    public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
        isConnected = (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK);
    }

    @Override
    public void onBillingServiceDisconnected() {
        isConnected = false;
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (isConnected) {
            JSObject ret = new JSObject();
            ret.put("connected", true);
            call.resolve(ret);
            return;
        }

        startBillingConnection(() -> {
            JSObject ret = new JSObject();
            ret.put("connected", isConnected);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        Runnable doQuery = () -> {
            List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
            for (String id : CANDIDATE_PRODUCT_IDS) {
                productList.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                );
            }

            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

            billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
                @Override
                public void onProductDetailsResponse(@NonNull BillingResult billingResult, @NonNull QueryProductDetailsResult queryProductDetailsResult) {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        List<ProductDetails> list = queryProductDetailsResult.getProductDetailsList();
                        JSArray prods = new JSArray();
                        synchronized (cachedProductDetails) {
                            for (ProductDetails pd : list) {
                                cachedProductDetails.put(pd.getProductId(), pd);
                                JSObject item = new JSObject();
                                item.put("productId", pd.getProductId());
                                item.put("title", pd.getTitle());
                                item.put("description", pd.getDescription());

                                List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
                                if (offers != null && !offers.isEmpty()) {
                                    ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                                    item.put("basePlanId", offer.getBasePlanId());
                                    item.put("offerToken", offer.getOfferToken());
                                    if (!offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                                        ProductDetails.PricingPhase phase = offer.getPricingPhases().getPricingPhaseList().get(0);
                                        item.put("formattedPrice", phase.getFormattedPrice());
                                        item.put("priceAmountMicros", phase.getPriceAmountMicros());
                                        item.put("priceCurrencyCode", phase.getPriceCurrencyCode());
                                        item.put("billingPeriod", phase.getBillingPeriod());
                                    }
                                }
                                prods.put(item);
                            }
                        }
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("products", prods);
                        call.resolve(ret);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", billingResult.getDebugMessage());
                        call.resolve(ret);
                    }
                }
            });
        };

        if (isConnected) {
            doQuery.run();
        } else {
            startBillingConnection(doQuery);
        }
    }

    /**
     * Launches the native Google Play bottom sheet billing flow
     */
    @PluginMethod
    public void launchBillingFlow(PluginCall call) {
        String requestedProductId = call.getString("productId");
        String requestedBasePlanId = call.getString("basePlanId");

        if (requestedProductId == null || requestedProductId.isEmpty()) {
            call.reject("Product ID is required");
            return;
        }

        this.pendingPurchaseCall = call;

        Runnable executeFlow = () -> {
            ProductDetails targetProduct = null;
            synchronized (cachedProductDetails) {
                targetProduct = cachedProductDetails.get(requestedProductId);
                if (targetProduct == null) {
                    // Try to match partial or alias
                    for (Map.Entry<String, ProductDetails> entry : cachedProductDetails.entrySet()) {
                        String key = entry.getKey().toLowerCase();
                        String req = requestedProductId.toLowerCase();
                        if (key.contains(req) || req.contains(key)) {
                            targetProduct = entry.getValue();
                            break;
                        }
                    }
                }
            }

            if (targetProduct != null) {
                launchFlowWithProduct(targetProduct, requestedBasePlanId);
            } else {
                // Not in cache, query it specifically now
                List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
                productList.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(requestedProductId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                );

                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(productList)
                    .build();

                billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
                    @Override
                    public void onProductDetailsResponse(@NonNull BillingResult billingResult, @NonNull QueryProductDetailsResult queryProductDetailsResult) {
                        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && !queryProductDetailsResult.getProductDetailsList().isEmpty()) {
                            ProductDetails pd = queryProductDetailsResult.getProductDetailsList().get(0);
                            synchronized (cachedProductDetails) {
                                cachedProductDetails.put(pd.getProductId(), pd);
                            }
                            launchFlowWithProduct(pd, requestedBasePlanId);
                        } else {
                            if (pendingPurchaseCall != null) {
                                JSObject ret = new JSObject();
                                ret.put("success", false);
                                ret.put("userCancelled", false);
                                ret.put("error", "Subscription product not found in Google Play Console: " + requestedProductId + ". Make sure the product ID matches what is created in Play Console.");
                                pendingPurchaseCall.resolve(ret);
                                pendingPurchaseCall = null;
                            }
                        }
                    }
                });
            }
        };

        if (isConnected) {
            executeFlow.run();
        } else {
            startBillingConnection(executeFlow);
        }
    }

    private void launchFlowWithProduct(@NonNull ProductDetails productDetails, @Nullable String basePlanId) {
        List<ProductDetails.SubscriptionOfferDetails> offerDetailsList = productDetails.getSubscriptionOfferDetails();
        if (offerDetailsList == null || offerDetailsList.isEmpty()) {
            if (pendingPurchaseCall != null) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("userCancelled", false);
                ret.put("error", "No subscription offer details or base plans configured for: " + productDetails.getProductId());
                pendingPurchaseCall.resolve(ret);
                pendingPurchaseCall = null;
            }
            return;
        }

        // Find matching base plan or use first offer
        String selectedOfferToken = offerDetailsList.get(0).getOfferToken();
        if (basePlanId != null && !basePlanId.isEmpty()) {
            for (ProductDetails.SubscriptionOfferDetails offer : offerDetailsList) {
                if (basePlanId.equalsIgnoreCase(offer.getBasePlanId())) {
                    selectedOfferToken = offer.getOfferToken();
                    break;
                }
            }
        }

        List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
        productDetailsParamsList.add(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(selectedOfferToken)
                .build()
        );

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build();

        mainHandler.post(() -> {
            Activity activity = getActivity();
            if (activity == null || activity.isFinishing()) {
                if (pendingPurchaseCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("error", "Activity not available");
                    pendingPurchaseCall.resolve(ret);
                    pendingPurchaseCall = null;
                }
                return;
            }

            BillingResult result = billingClient.launchBillingFlow(activity, billingFlowParams);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                if (pendingPurchaseCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("userCancelled", false);
                    ret.put("error", "Failed to open Google Play Billing: " + result.getDebugMessage() + " (Code " + result.getResponseCode() + ")");
                    pendingPurchaseCall.resolve(ret);
                    pendingPurchaseCall = null;
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        int responseCode = billingResult.getResponseCode();

        if (responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                handlePurchase(purchase);
            }
        } else if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            Log.i(TAG, "User cancelled Google Play purchase.");
            if (pendingPurchaseCall != null) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("userCancelled", true);
                ret.put("error", "User cancelled Google Play subscription.");
                pendingPurchaseCall.resolve(ret);
                pendingPurchaseCall = null;
            }
        } else {
            Log.w(TAG, "Purchase failed: " + billingResult.getDebugMessage() + " (Code " + responseCode + ")");
            if (pendingPurchaseCall != null) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("userCancelled", false);
                ret.put("error", "Google Play Billing error: " + billingResult.getDebugMessage() + " (Code " + responseCode + ")");
                pendingPurchaseCall.resolve(ret);
                pendingPurchaseCall = null;
            }
        }
    }

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams acknowledgePurchaseParams =
                    AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();

                billingClient.acknowledgePurchase(acknowledgePurchaseParams, new AcknowledgePurchaseResponseListener() {
                    @Override
                    public void onAcknowledgePurchaseResponse(@NonNull BillingResult billingResult) {
                        Log.i(TAG, "Acknowledge purchase result: " + billingResult.getResponseCode());
                    }
                });
            }

            if (pendingPurchaseCall != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("userCancelled", false);
                ret.put("orderId", purchase.getOrderId());
                ret.put("purchaseToken", purchase.getPurchaseToken());
                ret.put("purchaseTime", purchase.getPurchaseTime());
                ret.put("packageName", purchase.getPackageName());

                JSArray prods = new JSArray();
                for (String p : purchase.getProducts()) {
                    prods.put(p);
                }
                ret.put("products", prods);
                pendingPurchaseCall.resolve(ret);
                pendingPurchaseCall = null;
            }
        } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            if (pendingPurchaseCall != null) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("pending", true);
                ret.put("error", "Payment is pending approval in Google Play. Your subscription will activate once approved.");
                pendingPurchaseCall.resolve(ret);
                pendingPurchaseCall = null;
            }
        }
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        Runnable doQuery = () -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();

            billingClient.queryPurchasesAsync(params, new PurchasesResponseListener() {
                @Override
                public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchaseList) {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        JSArray activePurchases = new JSArray();
                        for (Purchase purchase : purchaseList) {
                            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                JSObject item = new JSObject();
                                item.put("orderId", purchase.getOrderId());
                                item.put("purchaseToken", purchase.getPurchaseToken());
                                item.put("purchaseTime", purchase.getPurchaseTime());
                                item.put("isAcknowledged", purchase.isAcknowledged());
                                item.put("isAutoRenewing", purchase.isAutoRenewing());
                                JSArray prods = new JSArray();
                                for (String p : purchase.getProducts()) {
                                    prods.put(p);
                                }
                                item.put("products", prods);
                                activePurchases.put(item);
                            }
                        }
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("purchases", activePurchases);
                        call.resolve(ret);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", billingResult.getDebugMessage());
                        call.resolve(ret);
                    }
                }
            });
        };

        if (isConnected) {
            doQuery.run();
        } else {
            startBillingConnection(doQuery);
        }
    }

    @PluginMethod
    public void openManageSubscriptions(PluginCall call) {
        try {
            String pkg = getContext().getPackageName();
            String sku = call.getString("sku");
            String url = "https://play.google.com/store/account/subscriptions?package=" + pkg;
            if (sku != null && !sku.isEmpty()) {
                url += "&sku=" + sku;
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open subscriptions management: " + e.getMessage());
        }
    }
}
