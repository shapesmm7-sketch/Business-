import React, { useState } from 'react';
import {
  Globe,
  Coins,
  ChevronDown,
  Check,
  Search,
  X,
  ArrowRight,
  Sparkles,
  Store,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { BusinessProfile } from '../types';
import { SUPPORTED_CURRENCIES, getCurrencyFlag } from '../utils/currencies';
import { COUNTRY_CODES, getCurrencyForCountry, CountryCodeItem } from '../data/countryCodes';
import { getLanguageByCode, WORLD_LANGUAGES } from '../data/languages';
import { LanguageSelectorModal } from './LanguageSelectorModal';
import { StorageService } from '../services/storage';
import { t } from '../utils/i18n';

interface OnboardingPreferencesScreenProps {
  initialProfile: BusinessProfile;
  onNext: (updatedProfile: BusinessProfile) => void;
}

export const OnboardingPreferencesScreen: React.FC<OnboardingPreferencesScreenProps> = ({
  initialProfile,
  onNext,
}) => {
  // Start country and currency as empty/none so the user must select them
  const [profile, setProfile] = useState<BusinessProfile>(() => ({
    ...initialProfile,
    country: initialProfile.country || '',
    currency: initialProfile.country ? (initialProfile.currency || '') : '',
  }));
  const [nameError, setNameError] = useState<string | null>(null);

  // Country modal & search
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  // Currency modal & search
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');

  // Language modal
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // Auto notice state
  const [autoNotice, setAutoNotice] = useState<string | null>(null);

  const selectedCountryObj = profile.country
    ? COUNTRY_CODES.find(
        (c) =>
          c.name.toLowerCase() === profile.country!.toLowerCase() ||
          c.code.toLowerCase() === profile.country!.toLowerCase()
      ) || null
    : null;

  const selectedCurrencyObj = profile.currency
    ? SUPPORTED_CURRENCIES.find(
        (c) => c.code.toUpperCase() === profile.currency!.toUpperCase()
      ) || null
    : null;

  const selectedLanguageObj = getLanguageByCode(profile.language || 'en');

  const filteredCountries = COUNTRY_CODES.filter((c) => {
    const q = countrySearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.toLowerCase().includes(q) ||
      (c.flag && c.flag.includes(q))
    );
  });

  const filteredCurrencies = SUPPORTED_CURRENCIES.filter((c) => {
    const q = currencySearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      (c.flag && c.flag.includes(q))
    );
  });

  const handleSelectCountry = (countryItem: CountryCodeItem) => {
    const autoCurrCode =
      getCurrencyForCountry(countryItem.code) || getCurrencyForCountry(countryItem.name) || 'USD';

    const updated: BusinessProfile = {
      ...profile,
      country: countryItem.name,
      countryCode: countryItem.code,
      dialCode: countryItem.dialCode,
      currency: autoCurrCode,
    };

    if (countryItem.dialCode) {
      StorageService.setDefaultDialCode(countryItem.dialCode);
    }

    setAutoNotice(
      `Selected ${countryItem.name}: Currency set to ${autoCurrCode} & country code set to ${countryItem.dialCode} by default`
    );
    setTimeout(() => setAutoNotice(null), 5000);

    setProfile(updated);
    setIsCountryModalOpen(false);
    setCountrySearchQuery('');
  };

  const isNameFilled = Boolean(profile.name && profile.name.trim().length > 0);
  const isCountryChosen = Boolean(profile.country && profile.country.trim().length > 0);
  const isCurrencyChosen = Boolean(profile.currency && profile.currency.trim().length > 0);
  const isFormValid = isNameFilled && isCountryChosen && isCurrencyChosen;

  const handleNext = () => {
    if (!isFormValid) {
      if (!isNameFilled) {
        setNameError('Please enter your Business / Store Name before continuing.');
        const inputEl = document.getElementById('input-onboarding-business-name');
        if (inputEl) inputEl.focus();
      }
      return;
    }
    setNameError(null);

    // Save preferences and profile
    if (profile.dialCode) {
      StorageService.setDefaultDialCode(profile.dialCode);
    }
    StorageService.saveProfile(profile);
    const settings = StorageService.getSettings();
    StorageService.saveSettings({ ...settings, currency: profile.currency });
    window.dispatchEvent(new CustomEvent('brivu_data_refreshed'));
    onNext(profile);
  };

  return (
    <div className="space-y-5 pb-28 animate-fadeIn max-w-xl mx-auto">
      {/* Step Header Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl space-y-3 relative overflow-hidden border border-emerald-400/30">
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-black uppercase tracking-wider backdrop-blur-md border border-white/20">
            {t('step_1_of_2', profile.language) || 'Step 1 of 2: Store, Region & Language'}
          </span>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Store className="w-4 h-4 text-white" />
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
          Setup Your Business Name & Region
        </h1>

        <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
          Please enter your business name and select your country, currency, and language below to get started.
        </p>

        <div className="pt-2 flex items-center gap-2 text-[11px] text-emerald-200 font-semibold border-t border-white/20">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>Compulsory setup • All 3 fields are required to proceed</span>
        </div>
      </div>

      {/* Main Options Form Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
        {/* 1. Business / Store Name (Top Box) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Store className="w-4 h-4 text-emerald-500" />
              <span>1. {t('business_shop_name', profile.language) || 'Business / Store Name'} *</span>
            </label>
            {isNameFilled ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Ready</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                Required
              </span>
            )}
          </div>
          <input
            id="input-onboarding-business-name"
            type="text"
            value={profile.name || ''}
            onChange={(e) => {
              const val = e.target.value;
              setProfile((prev) => ({ ...prev, name: val }));
              if (val.trim()) setNameError(null);
            }}
            placeholder="e.g. Kampala Fresh Mart, Elite Boutique, Brivu Store"
            className={`w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 text-sm font-bold text-slate-900 dark:text-white transition focus:outline-hidden ${
              nameError
                ? 'border-rose-500 ring-2 ring-rose-500/30'
                : isNameFilled
                ? 'border-emerald-500/50 dark:border-emerald-500/40 focus:border-emerald-500'
                : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
            }`}
            autoFocus
          />
          {nameError ? (
            <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5 pt-0.5 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{nameError}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 pl-1">
              Your business name will appear at the top of all receipts, invoices, and QR pages.
            </p>
          )}
        </div>

        {/* 2. Country Selection */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>2. {t('country_select', profile.language) || 'Business Country'} *</span>
            </label>
            {isCountryChosen ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Selected</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                Required
              </span>
            )}
          </div>
          <button
            id="btn-onboarding-country"
            type="button"
            onClick={() => setIsCountryModalOpen(true)}
            className={`w-full p-3.5 rounded-2xl border-2 transition flex items-center justify-between gap-3 cursor-pointer shadow-xs active:scale-[0.99] ${
              selectedCountryObj
                ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-900 dark:text-white'
                : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-dashed border-emerald-300 dark:border-emerald-700/80 hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedCountryObj ? (
                <span className="text-3xl leading-none shrink-0">{selectedCountryObj.flag}</span>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
              )}
              <div className="text-left min-w-0">
                {selectedCountryObj ? (
                  <>
                    <div className="font-black text-sm text-slate-900 dark:text-white truncate flex items-center gap-2">
                      <span>{selectedCountryObj.name}</span>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {selectedCountryObj.dialCode} • Dialing Code
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                      Choose Country...
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tap to select your country & auto-set currency
                    </div>
                  </>
                )}
              </div>
            </div>
            <div
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold ${
                selectedCountryObj
                  ? 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-emerald-600 text-white shadow-xs'
              }`}
            >
              <span>{selectedCountryObj ? 'Change' : 'Select'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </button>
          <p className="text-[11px] text-slate-400 pl-1">
            {t('country_desc', profile.language) ||
              'Selecting your country automatically configures your default currency.'}
          </p>

          {autoNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{autoNotice}</span>
            </div>
          )}
        </div>

        {/* 3. Default Currency */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>3. {t('default_currency', profile.language) || 'Default Currency'} *</span>
            </label>
            {isCurrencyChosen ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Selected</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                Required
              </span>
            )}
          </div>
          <button
            id="btn-onboarding-currency"
            type="button"
            onClick={() => setIsCurrencyModalOpen(true)}
            className={`w-full p-3.5 rounded-2xl border-2 transition flex items-center justify-between gap-3 cursor-pointer shadow-xs active:scale-[0.99] ${
              selectedCurrencyObj
                ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-900 dark:text-white'
                : 'bg-amber-50/40 dark:bg-amber-950/20 border-dashed border-amber-300 dark:border-amber-700/80 hover:border-amber-500'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedCurrencyObj ? (
                <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                  {selectedCurrencyObj.flag || getCurrencyFlag(selectedCurrencyObj.code)}
                </span>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
              )}
              <div className="text-left min-w-0">
                {selectedCurrencyObj ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-black text-xs">
                        {selectedCurrencyObj.code}
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {selectedCurrencyObj.name}
                      </span>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Symbol:{' '}
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {selectedCurrencyObj.symbol}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-sm text-amber-700 dark:text-amber-300">
                      Choose Currency...
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auto-fills when country is chosen or tap to pick
                    </div>
                  </>
                )}
              </div>
            </div>
            <div
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold ${
                selectedCurrencyObj
                  ? 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-amber-600 text-white shadow-xs'
              }`}
            >
              <span>{selectedCurrencyObj ? 'Change' : 'Select'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </button>
          <p className="text-[11px] text-slate-400 pl-1">
            All receipt prices, totals, and sales statistics will be calculated in this currency.
          </p>
        </div>

        {/* 4. App & Business Language */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Globe className="w-4 h-4 text-indigo-500" />
            <span>4. {t('language', profile.language) || 'Business & App Language'} *</span>
          </label>
          <button
            id="btn-onboarding-language"
            type="button"
            onClick={() => setIsLanguageModalOpen(true)}
            className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white hover:border-indigo-500 transition flex items-center justify-between gap-3 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl leading-none shrink-0">{selectedLanguageObj.flag}</span>
              <div className="text-left min-w-0">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {selectedLanguageObj.name}
                </div>
                <div className="text-[11px] text-slate-400 font-semibold">
                  {selectedLanguageObj.nativeName} ({selectedLanguageObj.country})
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold">
              <span>Change</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </button>
          <p className="text-[11px] text-slate-400 pl-1">
            Choose your preferred international language. Entire app UI and generated documents will update.
          </p>
        </div>
      </div>

      {/* Checklist / Requirements Status Indicator if not valid */}
      {!isFormValid && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Complete all required fields to activate Next button:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div
              className={`flex items-center gap-1.5 font-bold ${
                isNameFilled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isNameFilled ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">
                  1
                </span>
              )}
              <span>Store Name</span>
            </div>
            <div
              className={`flex items-center gap-1.5 font-bold ${
                isCountryChosen
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isCountryChosen ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">
                  2
                </span>
              )}
              <span>Choose Country</span>
            </div>
            <div
              className={`flex items-center gap-1.5 font-bold ${
                isCurrencyChosen
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isCurrencyChosen ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">
                  3
                </span>
              )}
              <span>Choose Currency</span>
            </div>
          </div>
        </div>
      )}

      {/* Next Button - Muted and unclickable until all required fields are set */}
      <button
        id="btn-onboarding-next"
        type="button"
        disabled={!isFormValid}
        onClick={handleNext}
        className={`w-full py-4 rounded-2xl font-black text-base transition flex items-center justify-center gap-2 ${
          isFormValid
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xl active:scale-[0.99] border border-emerald-500/40'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-75 border border-slate-300/50 dark:border-slate-700/50'
        }`}
      >
        <span>{t('next_business_details', profile.language) || 'Next: Continue to Business Details'}</span>
        <ArrowRight className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Country Selection Modal */}
      {isCountryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full h-[88vh] max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    {t('select_country_modal_title', profile.language) || 'Select Business Country'}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Currency will update automatically according to your country
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCountryModalOpen(false);
                  setCountrySearchQuery('');
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={
                    t('search_country_placeholder', profile.language) ||
                    'Search country by name, code or flag...'
                  }
                  value={countrySearchQuery}
                  onChange={(e) => setCountrySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-2 flex-1 overflow-y-auto space-y-1">
              {filteredCountries.map((c) => {
                const isSelected =
                  Boolean(profile.country) &&
                  (profile.country!.toLowerCase() === c.name.toLowerCase() ||
                    profile.country!.toLowerCase() === c.code.toLowerCase());
                const matchedCurrency =
                  getCurrencyForCountry(c.code) || getCurrencyForCountry(c.name);

                return (
                  <button
                    key={c.code + c.name}
                    type="button"
                    onClick={() => handleSelectCountry(c)}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-2.5 text-xs ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl leading-none shrink-0" aria-hidden="true">
                        {c.flag}
                      </span>
                      <div className="min-w-0 truncate">
                        <div className="truncate text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.popular && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {c.dialCode} • Auto Currency: {matchedCurrency || 'USD'}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}

              {filteredCountries.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No country matching "{countrySearchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Currency Selection Modal */}
      {isCurrencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full h-[88vh] max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Select Currency
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Search and pick your business currency
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCurrencyModalOpen(false);
                  setCurrencySearchQuery('');
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code, e.g. USD, EUR, UGX..."
                  value={currencySearchQuery}
                  onChange={(e) => setCurrencySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-2 flex-1 overflow-y-auto space-y-1">
              {filteredCurrencies.map((c) => {
                const isSelected =
                  Boolean(profile.currency) && profile.currency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setProfile((prev) => ({ ...prev, currency: c.code }));
                      setIsCurrencyModalOpen(false);
                      setCurrencySearchQuery('');
                    }}
                    className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between gap-2.5 text-xs ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl leading-none shrink-0" aria-hidden="true">
                        {c.flag || getCurrencyFlag(c.code)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300 shrink-0">
                        {c.code}
                      </span>
                      <span className="truncate text-xs">{c.name}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-xs shrink-0">
                        ({c.symbol})
                      </span>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}

              {filteredCurrencies.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No currency matching "{currencySearchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Language Selector Modal */}
      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        currentLanguageCode={profile.language || 'en'}
        onSelectLanguage={(lang) => {
          const updated = { ...profile, language: lang.code };
          setProfile(updated);
          StorageService.saveProfile(updated);
          window.dispatchEvent(new CustomEvent('brivu_data_refreshed'));
          setIsLanguageModalOpen(false);
        }}
        onClose={() => setIsLanguageModalOpen(false)}
      />
    </div>
  );
};
