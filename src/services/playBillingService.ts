import { registerPlugin, Capacitor } from '@capacitor/core';
import { StorageService } from './storage';
import { SubscriptionPlanId, UserSubscription } from '../types';

/**
 * Google Play Console Product & Base Plan Definitions
 * Configured according to Google Play Billing Library Version 8+ / 9 specs
 */
export interface GooglePlaySubscriptionProduct {
  productId: string;
  basePlanId: string;
  name: string;
  planId: SubscriptionPlanId;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  formattedPrice: string;
  billingPeriod: string; // ISO 8601 (P1M, P6M, P1Y)
  billingPeriodLabel: string;
  description: string;
  monthsCount: number;
  gracePeriodDays: number;
  accountHoldDays: number;
}

export const GOOGLE_PLAY_PRODUCTS: Record<SubscriptionPlanId, GooglePlaySubscriptionProduct> = {
  '1-month': {
    productId: 'brivu_pro_monthly',
    basePlanId: 'brivu-pro-monthly-base',
    name: 'Brivu Pro 1 Month',
    planId: '1-month',
    priceAmountMicros: 5600000,
    priceCurrencyCode: 'USD',
    formattedPrice: '$5.6',
    billingPeriod: 'P1M',
    billingPeriodLabel: '1 Month',
    description: 'Brivu Pro Monthly Plan - Cloud sync, 100% ad-free, online QR hosting & unlimited receipts.',
    monthsCount: 1,
    gracePeriodDays: 7,
    accountHoldDays: 30,
  },
  '6-months': {
    productId: 'brivu_pro_semi_annual_v2',
    basePlanId: 'brivu-pro-6months-base-v2',
    name: 'Brivu Pro 6 Months (Semi-Annual)',
    planId: '6-months',
    priceAmountMicros: 30000000,
    priceCurrencyCode: 'USD',
    formattedPrice: '$30.0',
    billingPeriod: 'P6M',
    billingPeriodLabel: '6 Months',
    description: 'Brivu Pro 6 Months Plan - Cloud sync, 100% ad-free, online QR hosting & unlimited receipts.',
    monthsCount: 6,
    gracePeriodDays: 14,
    accountHoldDays: 30,
  },
  '1-year': {
    productId: 'brivu_pro_yearly',
    basePlanId: 'brivu-pro-yearly-base',
    name: 'Brivu Pro 1 Year',
    planId: '1-year',
    priceAmountMicros: 55900000,
    priceCurrencyCode: 'USD',
    formattedPrice: '$55.9',
    billingPeriod: 'P1Y',
    billingPeriodLabel: '1 Year',
    description: 'Brivu Pro Annual Plan - Best Value. Cloud sync, 100% ad-free, online QR hosting & unlimited receipts.',
    monthsCount: 12,
    gracePeriodDays: 14,
    accountHoldDays: 30,
  },
};

export interface NativePlayBillingProduct {
  productId: string;
  title?: string;
  description?: string;
  basePlanId?: string;
  offerToken?: string;
  formattedPrice?: string;
  priceAmountMicros?: number;
  priceCurrencyCode?: string;
  billingPeriod?: string;
}

export interface NativeBillingFlowResult {
  success: boolean;
  userCancelled?: boolean;
  orderId?: string;
  purchaseToken?: string;
  purchaseTime?: number;
  products?: string[];
  packageName?: string;
  error?: string;
  pending?: boolean;
}

export interface NativePlayBillingPlugin {
  initialize(): Promise<{ connected: boolean }>;
  getProducts(): Promise<{ success: boolean; products?: NativePlayBillingProduct[]; error?: string }>;
  launchBillingFlow(options: { productId: string; basePlanId?: string }): Promise<NativeBillingFlowResult>;
  queryPurchases(): Promise<{ success: boolean; purchases?: any[]; error?: string }>;
  openManageSubscriptions(options?: { sku?: string }): Promise<{ success: boolean }>;
}

const PlayBillingNative = registerPlugin<NativePlayBillingPlugin>('PlayBillingPlugin');

export class PlayBillingService {
  private static isInitialized = false;

  /**
   * Check if running on Android native Capacitor
   */
  public static isAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Initialize Billing Client
   */
  public static async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      if (this.isAndroid()) {
        const res = await PlayBillingNative.initialize();
        this.isInitialized = res.connected;
      } else {
        this.isInitialized = true;
      }
      return this.isInitialized;
    } catch (err) {
      console.warn('Google Play Billing initialization error:', err);
      return false;
    }
  }

  /**
   * Launch native Google Play Billing bottom sheet (Google Pay / card)
   */
  public static async purchaseSubscription(
    planId: SubscriptionPlanId,
    _paymentMethod: 'google_play' | 'card' | 'gpay' | 'momo' = 'google_play'
  ): Promise<{ success: boolean; userCancelled?: boolean; subscription?: UserSubscription; error?: string }> {
    try {
      const product = GOOGLE_PLAY_PRODUCTS[planId];
      if (!product) {
        return { success: false, error: `Unknown product plan: ${planId}` };
      }

      if (!this.isAndroid()) {
        return {
          success: false,
          error: 'Google Play Billing is available directly within the Android mobile app installed from Google Play.',
        };
      }

      await this.initialize();

      // Launch the native Google Play Billing bottom sheet
      const result = await PlayBillingNative.launchBillingFlow({
        productId: product.productId,
        basePlanId: product.basePlanId,
      });

      if (result.userCancelled) {
        return {
          success: false,
          userCancelled: true,
          error: 'Purchase was cancelled in Google Play.',
        };
      }

      if (!result.success) {
        return {
          success: false,
          userCancelled: false,
          error: result.error || 'Failed to complete subscription purchase in Google Play.',
        };
      }

      // ONLY when user actually completed purchase through Google Play bottom sheet:
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + product.monthsCount);

      const subscription: UserSubscription = {
        planId: product.planId,
        planName: product.name,
        status: 'active',
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        amountPaid: product.priceAmountMicros / 1000000,
        currency: product.priceCurrencyCode,
        isGooglePlay: true,
        orderId: result.orderId || `GPA.${Date.now()}`,
      } as any;

      StorageService.saveSubscription(subscription);

      return {
        success: true,
        subscription,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Purchase failed. Please try again.';
      return { success: false, error: msg };
    }
  }

  /**
   * Restore purchases directly from Google Play Store
   */
  public static async restorePurchases(): Promise<{
    restored: boolean;
    subscription: UserSubscription | null;
    message: string;
  }> {
    try {
      if (!this.isAndroid()) {
        return {
          restored: false,
          subscription: null,
          message: 'Purchases can only be restored on Android devices signed into Google Play.',
        };
      }

      await this.initialize();
      const res = await PlayBillingNative.queryPurchases();

      if (res.success && res.purchases && res.purchases.length > 0) {
        const purchase = res.purchases[0];
        const purchasedProductIds: string[] = purchase.products || [];

        // Match against known product definitions
        let matchedPlanKey: SubscriptionPlanId = '1-month';
        if (purchasedProductIds.some((id: string) => id.includes('year') || id.includes('annual'))) {
          matchedPlanKey = '1-year';
        } else if (purchasedProductIds.some((id: string) => id.includes('6month') || id.includes('semi'))) {
          matchedPlanKey = '6-months';
        }

        const product = GOOGLE_PLAY_PRODUCTS[matchedPlanKey];
        const now = new Date();
        const purchaseDate = purchase.purchaseTime ? new Date(purchase.purchaseTime) : now;
        const expiresAt = new Date(purchaseDate);
        expiresAt.setMonth(expiresAt.getMonth() + product.monthsCount);

        const restoredSubscription: UserSubscription = {
          planId: product.planId,
          planName: product.name,
          status: 'active',
          startedAt: purchaseDate.toISOString(),
          expiresAt: expiresAt.toISOString(),
          amountPaid: product.priceAmountMicros / 1000000,
          currency: product.priceCurrencyCode,
          isGooglePlay: true,
          orderId: purchase.orderId,
        } as any;

        StorageService.saveSubscription(restoredSubscription);

        return {
          restored: true,
          subscription: restoredSubscription,
          message: `Active subscription restored from Google Play: ${product.name}!`,
        };
      }

      return {
        restored: false,
        subscription: null,
        message: 'No active Google Play subscription found for this Google account.',
      };
    } catch (err: any) {
      console.warn('Error restoring purchases:', err);
      return {
        restored: false,
        subscription: null,
        message: 'Could not connect to Google Play to verify purchases.',
      };
    }
  }

  /**
   * Open Google Play Subscriptions management deep link
   */
  public static async openManageSubscriptions(): Promise<void> {
    try {
      if (this.isAndroid()) {
        await PlayBillingNative.openManageSubscriptions({ sku: 'brivu_pro_monthly' });
      } else {
        const pkg = 'com.brivu.myapp';
        window.open(`https://play.google.com/store/account/subscriptions?package=${pkg}`, '_blank');
      }
    } catch (_) {
      const pkg = 'com.brivu.myapp';
      window.open(`https://play.google.com/store/account/subscriptions?package=${pkg}`, '_blank');
    }
  }
}
