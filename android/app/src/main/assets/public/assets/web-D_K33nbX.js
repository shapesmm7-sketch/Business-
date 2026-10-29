import { W as WebPlugin, A as AdmobConsentStatus } from "./index-D1wK3lJ2.js";
var PrivacyOptionsRequirementStatus;
(function(PrivacyOptionsRequirementStatus2) {
  PrivacyOptionsRequirementStatus2["NOT_REQUIRED"] = "NOT_REQUIRED";
  PrivacyOptionsRequirementStatus2["REQUIRED"] = "REQUIRED";
  PrivacyOptionsRequirementStatus2["UNKNOWN"] = "UNKNOWN";
})(PrivacyOptionsRequirementStatus || (PrivacyOptionsRequirementStatus = {}));
class AdMobWeb extends WebPlugin {
  async initialize() {
    console.log("initialize");
  }
  async requestTrackingAuthorization() {
    console.log("requestTrackingAuthorization");
  }
  async trackingAuthorizationStatus() {
    return {
      status: "authorized"
    };
  }
  async requestConsentInfo(options) {
    console.log("requestConsentInfo", options);
    return {
      status: AdmobConsentStatus.REQUIRED,
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: PrivacyOptionsRequirementStatus.REQUIRED
    };
  }
  async showPrivacyOptionsForm() {
    console.log("showPrivacyOptionsForm");
  }
  async showConsentForm() {
    console.log("showConsentForm");
    return {
      status: AdmobConsentStatus.REQUIRED,
      canRequestAds: true,
      privacyOptionsRequirementStatus: PrivacyOptionsRequirementStatus.REQUIRED
    };
  }
  async resetConsentInfo() {
    console.log("resetConsentInfo");
  }
  async setApplicationMuted(options) {
    console.log("setApplicationMuted", options);
  }
  async setApplicationVolume(options) {
    console.log("setApplicationVolume", options);
  }
  async showBanner(options) {
    console.log("showBanner", options);
  }
  async hideBanner() {
    console.log("hideBanner");
  }
  async resumeBanner() {
    console.log("resumeBanner");
  }
  async removeBanner() {
    console.log("removeBanner");
  }
  async prepareInterstitial(options) {
    console.log("prepareInterstitial", options);
    return {
      adUnitId: options.adId
    };
  }
  async showInterstitial(options) {
    console.log("showInterstitial", options);
  }
  async prepareRewardVideoAd(options) {
    console.log("prepareRewardVideoAd", options);
    return {
      adUnitId: options.adId
    };
  }
  async showRewardVideoAd(options) {
    console.log("showRewardVideoAd", options);
    return {
      type: "",
      amount: 0
    };
  }
  async prepareRewardInterstitialAd(options) {
    console.log("prepareRewardInterstitialAd", options);
    return {
      adUnitId: options.adId
    };
  }
  async showRewardInterstitialAd(options) {
    console.log("showRewardInterstitialAd", options);
    return {
      type: "",
      amount: 0
    };
  }
  async loadAppOpen(options) {
    console.log("loadAppOpen", options);
    return {
      adUnitId: options.adId
    };
  }
  async showAppOpen(options) {
    console.log("showAppOpen", options);
  }
  async isAppOpenLoaded() {
    return { value: false };
  }
  addListener(eventName, listenerFunc) {
    console.log("addListener", eventName);
    return Promise.resolve({ remove: () => Promise.resolve() });
  }
}
export {
  AdMobWeb
};
