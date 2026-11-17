import React, { useState } from 'react';
import {
  Crown,
  Sparkles,
  Check,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Layers,
  RefreshCw,
  ArrowLeft,
  Star,
  QrCode,
  Globe2,
  Clock,
  AlertCircle,
  Cloud,
  CloudOff,
  AlertTriangle,
  HardDrive,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import { SubscriptionPlanId, UserSubscription } from '../types';
import { StorageService } from '../services/storage';
import { PlayBillingService } from '../services/playBillingService';

interface UpgradeScreenProps {
  onBack: () => void;
  onSubscriptionChange?: (subscription: UserSubscription | null) => void;
}

interface PlanOption {
  id: SubscriptionPlanId;
  name: string;
  durationLabel: string;
  price: number;
  formattedPrice: string;
  periodLabel: string;
  monthlyEquivalent: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  monthsCount: number;
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: PlanOption[] = [
  {
    id: '1-month',
    name: '1 Month',
    durationLabel: 'Monthly Billing',
    price: 5.6,
    formattedPrice: '$5.6',
    periodLabel: '/ month',
    monthlyEquivalent: '$5.60/mo',
    description: 'Cloud sync & live QR hosting for 1 month. Flexible with zero lock-in.',
    monthsCount: 1,
  },
  {
    id: '6-months',
    name: '6 Months',
    durationLabel: '6-Month Plan',
    price: 30.0,
    formattedPrice: '$30.0',
    periodLabel: '/ 6 months',
    monthlyEquivalent: '$5.00/mo',
    badge: 'SAVE 11%',
    badgeColor: 'bg-emerald-500 text-white',
    description: 'Billed $30.00 every 6 months. Continuous cloud sync & QR link hosting.',
    monthsCount: 6,
  },
  {
    id: '1-year',
    name: '1 Year',
    durationLabel: 'Annual Billing',
    price: 55.9,
    formattedPrice: '$55.9',
    periodLabel: '/ year',
    monthlyEquivalent: '$4.66/mo',
    badge: 'BEST VALUE • SAVE 17%',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-xs',
    description: 'Billed $55.90 annually. 365 days of guaranteed cloud sync, backup & live QR hosting.',
    monthsCount: 12,
    popular: true,
  },
];

export const UpgradeScreen: React.FC<UpgradeScreenProps> = ({
  onBack,
  onSubscriptionChange,
}) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(() =>
    StorageService.getSubscription()
  );
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('1-year');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{ msg: string; success: boolean } | null>(null);

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setRestoreFeedback(null);

    const res = await PlayBillingService.restorePurchases();
    setIsRestoring(false);

    if (res.restored && res.subscription) {
      if (onSubscriptionChange) {
        onSubscriptionChange(res.subscription);
      }
      setSubscription(res.subscription);
      setRestoreFeedback({ msg: res.message, success: true });
    } else {
      setRestoreFeedback({ msg: res.message, success: false });
    }
  };

  const selectedPlan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId) || SUBSCRIPTION_PLANS[2];
  const isCurrentlyActive = subscription && subscription.status === 'active';

  // Calculate days remaining if active
  const daysRemaining = subscription && subscription.expiresAt
    ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleSubscribe = async () => {
    setIsProcessing(true);
    setSuccessToast(null);
    setRestoreFeedback(null);

    try {
      const result = await PlayBillingService.purchaseSubscription(selectedPlan.id);
      setIsProcessing(false);

      if (result.success && result.subscription) {
        StorageService.saveSubscription(result.subscription);
        setSubscription(result.subscription);
        if (onSubscriptionChange) {
          onSubscriptionChange(result.subscription);
        }
        setIsSuccess(true);
        setSuccessToast(`Subscribed to Brivu Pro ${selectedPlan.name} (${selectedPlan.formattedPrice}) via Google Play Billing!`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (!result.userCancelled) {
        setRestoreFeedback({
          msg: result.error || 'Google Play Store connection required. Subscriptions are processed via Google Play Billing.',
          success: false,
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setRestoreFeedback({
        msg: err?.message || 'Google Play Billing product not available. App bundle and subscription products must be configured in Google Play Console.',
        success: false,
      });
    }
  };

  const handleConfirmCancel = () => {
    StorageService.clearSubscription();
    setSubscription(null);
    if (onSubscriptionChange) {
      onSubscriptionChange(null);
    }
    setShowCancelConfirmModal(false);
    setSuccessToast('Subscription has been canceled.');
    setTimeout(() => setSuccessToast(null), 3500);
  };

  return (
    <div className="space-y-5 pb-28 animate-fadeIn max-w-2xl mx-auto px-1 sm:px-0">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700/50 dark:border-slate-300/50 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Navigation Bar with Back Button */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          id="btn-upgrade-back"
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Upgrade to Pro
          </h1>
          {isCurrentlyActive && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white leading-none shadow-xs">
              ACTIVE PRO
            </span>
          )}
        </div>

        <div className="w-16 flex justify-end">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Crown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Success Celebration Card */}
      {isSuccess && (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-2 border-emerald-500/50 shadow-xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-emerald-950 dark:text-emerald-200">
                Brivu Pro Active
              </h2>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {selectedPlan.name} ({selectedPlan.formattedPrice}) activated via Google Play.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Valid Until:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'Active'}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-98 cursor-pointer"
          >
            Return to App
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl border border-amber-500/30 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/30">
                <Crown className="w-4 h-4 fill-slate-950" />
              </div>
              <span className="text-xs font-black tracking-wider uppercase text-amber-400">
                Brivu Pro
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Upgrade Your Subscription
            </h2>
          </div>

          <div className="shrink-0 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center sm:text-right w-full sm:w-auto">
            <span className="text-[10px] text-indigo-200 font-bold block uppercase tracking-wider">
              Starting From
            </span>
            <div className="flex items-baseline justify-center sm:justify-end gap-1">
              <span className="text-2xl font-black text-amber-400">$5.6</span>
              <span className="text-xs text-indigo-200">/ mo</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
              Cancel Anytime
            </span>
          </div>
        </div>

        {/* If user already has an active subscription, display current status badge */}
        {isCurrentlyActive && (
          <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>Active Plan:</strong> {subscription.planName} ({subscription.formattedPrice})
              </span>
            </div>
            <div className="flex items-center gap-3 text-indigo-200 text-[11px]">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{daysRemaining} days remaining</span>
              </span>
              <span>Expires: {new Date(subscription.expiresAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Benefits (3 Concise Points) */}
      <div className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
          What's Included
        </h3>
        <ul className="space-y-2.5">
          <li className="flex items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Remove ads</span>
          </li>
          <li className="flex items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <span>Unlock cloud sync for QR code info, events and business info</span>
          </li>
          <li className="flex items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <span>Unlock Google Drive sync for receipts, invoices and inventory</span>
          </li>
        </ul>
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            For free users, all data is saved locally on your phone. The QR Code section requires a subscription and cloud sync to host your information and open it online.
          </p>
        </div>
      </div>

      {/* Subscription Plans Selection Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Choose a Plan
          </h3>
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg">
            Instant Activation
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <button
                key={plan.id}
                id={`plan-card-${plan.id}`}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/25 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {/* Left: Radio and Plan Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-slate-300 dark:border-slate-600 bg-transparent'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-base text-slate-900 dark:text-white">
                        {plan.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        ({plan.durationLabel})
                      </span>
                      {plan.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            plan.badgeColor || 'bg-amber-500 text-white'
                          }`}
                        >
                          {plan.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Price Display */}
                <div className="sm:text-right shrink-0 pl-8 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {plan.formattedPrice}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {plan.periodLabel}
                      </span>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded sm:bg-transparent sm:p-0">
                      Equiv. {plan.monthlyEquivalent}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subscription Action Button */}
      <div className="space-y-2.5 pt-1">
        <button
          id="btn-page-subscribe"
          type="button"
          disabled={isProcessing}
          onClick={handleSubscribe}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Crown className="w-5 h-5 fill-white" />
              <span>
                {isCurrentlyActive ? 'Switch Plan' : 'Subscribe'} — {selectedPlan.formattedPrice} ({selectedPlan.periodLabel.replace('/ ', '')})
              </span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {isCurrentlyActive && (
          <div className="text-center">
            <button
              id="btn-cancel-subscription"
              type="button"
              onClick={() => setShowCancelConfirmModal(true)}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold underline py-1 transition cursor-pointer"
            >
              Cancel Subscription
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium pt-1 text-center">
          <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Secured by Google Play Billing</span>
        </div>

        {/* Restore Purchases Button */}
        <div className="text-center pt-2">
          <button
            id="btn-restore-purchases"
            type="button"
            disabled={isRestoring}
            onClick={handleRestorePurchases}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 py-2 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isRestoring ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Restoring Purchases...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Previous Subscription</span>
              </>
            )}
          </button>
        </div>

        {restoreFeedback && (
          <div className={`p-3 rounded-2xl text-xs font-medium text-center border animate-fadeIn ${restoreFeedback.success ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'}`}>
            {restoreFeedback.msg}
          </div>
        )}
      </div>

      {/* In-App Cancel Subscription Confirmation Modal */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Cancel Subscription?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to cancel your subscription? Your data will remain stored on your local device and live QR code hosting will be paused.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                id="btn-confirm-cancel-subscription"
                type="button"
                onClick={handleConfirmCancel}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition active:scale-98 cursor-pointer"
              >
                Yes, Cancel Subscription
              </button>
              <button
                id="btn-keep-subscription"
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition active:scale-98 cursor-pointer"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
