import { formatCurrency, getCurrencyConfig, roundMoney } from '../utils/currencies';

export interface UsdExchangeRatesSnapshot {
  base: 'USD';
  rates: Record<string, number>;
  updatedAt: number;
  source: 'live' | 'cache' | 'fallback';
  provider?: string;
}

const RATES_STORAGE_KEY = 'brivu_usd_exchange_rates_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // Refresh every 30 minutes

// Baseline fallback rates (1 USD -> target currency) only used if completely offline on first run
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  UGX: 3700,
  KES: 129,
  TZS: 2650,
  RWF: 1380,
  BIF: 2950,
  SSP: 1300,
  CDF: 2850,
  ETB: 125,
  NGN: 1600,
  GHS: 15.5,
  ZAR: 18.2,
  EGP: 49.5,
  MAD: 9.9,
  ZMW: 27.5,
  MWK: 1735,
  MZN: 63.9,
  BWP: 13.6,
  NAD: 18.2,
  SZL: 18.2,
  LSL: 18.2,
  XOF: 605,
  XAF: 605,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.4,
  AUD: 1.54,
  NZD: 1.68,
  CHF: 0.88,
  JPY: 154,
  CNY: 7.24,
  INR: 84.4,
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.385,
  JOD: 0.709,
  TRY: 34.5,
  BRL: 5.8,
  MXN: 20.2,
  SGD: 1.34,
  MYR: 4.46,
  THB: 34.6,
  IDR: 15850,
  PHP: 58.8,
  PKR: 278,
  BDT: 119.5,
  LKR: 292,
  NPR: 135,
  KRW: 1395,
  VND: 25400,
  SEK: 10.9,
  NOK: 11.0,
  PLN: 4.08,
};

let inflightFetch: Promise<UsdExchangeRatesSnapshot> | null = null;

function readCachedSnapshot(): UsdExchangeRatesSnapshot | null {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.rates && typeof parsed.rates === 'object') {
      return {
        base: 'USD',
        rates: { ...FALLBACK_USD_RATES, ...parsed.rates, USD: 1 },
        updatedAt: Number(parsed.updatedAt) || 0,
        source: 'cache',
        provider: parsed.provider,
      };
    }
  } catch {}
  return null;
}

function saveSnapshot(snapshot: UsdExchangeRatesSnapshot): void {
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export const ExchangeRateService = {
  getCachedOrFallbackRates(): UsdExchangeRatesSnapshot {
    const cached = readCachedSnapshot();
    if (cached) return cached;
    return {
      base: 'USD',
      rates: { ...FALLBACK_USD_RATES },
      updatedAt: 0,
      source: 'fallback',
    };
  },

  async fetchLiveUsdRates(forceRefresh = false): Promise<UsdExchangeRatesSnapshot> {
    const cached = readCachedSnapshot();
    if (!forceRefresh && cached && cached.updatedAt > 0 && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return cached;
    }

    if (inflightFetch && !forceRefresh) {
      return inflightFetch;
    }

    inflightFetch = (async () => {
      // Provider 1: open.er-api.com (no API key, CORS enabled, supports 160+ currencies including UGX/KES/TZS/RWF)
      try {
        const res = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', 6000);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.result === 'success' && data.rates && typeof data.rates === 'object') {
            const normalized: Record<string, number> = { ...FALLBACK_USD_RATES };
            for (const [k, v] of Object.entries(data.rates)) {
              const num = Number(v);
              if (Number.isFinite(num) && num > 0) {
                normalized[k.toUpperCase()] = num;
              }
            }
            normalized.USD = 1;
            const snap: UsdExchangeRatesSnapshot = {
              base: 'USD',
              rates: normalized,
              updatedAt: Date.now(),
              source: 'live',
              provider: 'open.er-api.com',
            };
            saveSnapshot(snap);
            return snap;
          }
        }
      } catch {}

      // Provider 2: jsdelivr currency-api mirror
      try {
        const res = await fetchWithTimeout(
          'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
          6000
        );
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.usd && typeof data.usd === 'object') {
            const normalized: Record<string, number> = { ...FALLBACK_USD_RATES };
            for (const [k, v] of Object.entries(data.usd)) {
              const num = Number(v);
              if (Number.isFinite(num) && num > 0) {
                normalized[k.toUpperCase()] = num;
              }
            }
            normalized.USD = 1;
            const snap: UsdExchangeRatesSnapshot = {
              base: 'USD',
              rates: normalized,
              updatedAt: Date.now(),
              source: 'live',
              provider: 'currency-api',
            };
            saveSnapshot(snap);
            return snap;
          }
        }
      } catch {}

      return cached || {
        base: 'USD',
        rates: { ...FALLBACK_USD_RATES },
        updatedAt: 0,
        source: 'fallback',
      };
    })();

    try {
      return await inflightFetch;
    } finally {
      inflightFetch = null;
    }
  },

  convertFromUsd(
    usdAmount: number,
    targetCurrencyCode: string,
    rates: Record<string, number>
  ): {
    currencyCode: string;
    rate: number;
    convertedAmount: number;
    formatted: string;
    hasRate: boolean;
  } {
    const code = (targetCurrencyCode || 'USD').trim().toUpperCase();
    if (code === 'USD') {
      return {
        currencyCode: 'USD',
        rate: 1,
        convertedAmount: usdAmount,
        formatted: formatCurrency(usdAmount, 'USD'),
        hasRate: true,
      };
    }

    const rate = Number(rates[code] || FALLBACK_USD_RATES[code] || 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      return {
        currencyCode: 'USD',
        rate: 1,
        convertedAmount: usdAmount,
        formatted: formatCurrency(usdAmount, 'USD'),
        hasRate: false,
      };
    }

    const config = getCurrencyConfig(code);
    const rawConverted = usdAmount * rate;
    const rounded = roundMoney(rawConverted, config.decimalPlaces);

    return {
      currencyCode: code,
      rate,
      convertedAmount: rounded,
      formatted: formatCurrency(rounded, code),
      hasRate: true,
    };
  },

  formatUsdRateLabel(targetCurrencyCode: string, rates: Record<string, number>): string | null {
    const code = (targetCurrencyCode || 'USD').trim().toUpperCase();
    if (code === 'USD') return null;
    const rate = Number(rates[code] || FALLBACK_USD_RATES[code] || 0);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return `1 USD = ${formatCurrency(rate, code)}`;
  },
};
