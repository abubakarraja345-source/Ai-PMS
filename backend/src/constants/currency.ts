/**
 * Single source of truth for supported currencies — every backend
 * module that needs to validate or format a currency code imports
 * from here rather than maintaining its own list (frontend has its
 * own equivalent copy at frontend/lib/currency.ts, since the two
 * codebases don't share a module boundary; keep them in sync by hand
 * when adding a currency).
 *
 * `minorUnit` is the number of digits after the decimal point a
 * currency actually uses (2 for most, 0 for currencies with no
 * fractional unit like JPY/KRW) — never hardcode "divide by 100"
 * anywhere; always look this up.
 */
export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  minorUnit: number;
  symbolPosition: "prefix" | "suffix";
}

export const CURRENCIES: Record<string, CurrencyMeta> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", minorUnit: 2, symbolPosition: "prefix" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", minorUnit: 2, symbolPosition: "prefix" },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", minorUnit: 2, symbolPosition: "prefix" },
  AED: { code: "AED", name: "UAE Dirham", symbol: "د.إ", minorUnit: 2, symbolPosition: "suffix" },
  SAR: { code: "SAR", name: "Saudi Riyal", symbol: "﷼", minorUnit: 2, symbolPosition: "suffix" },
  PKR: { code: "PKR", name: "Pakistani Rupee", symbol: "₨", minorUnit: 2, symbolPosition: "prefix" },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "$", minorUnit: 2, symbolPosition: "prefix" },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "$", minorUnit: 2, symbolPosition: "prefix" },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", minorUnit: 0, symbolPosition: "prefix" },
  KRW: { code: "KRW", name: "South Korean Won", symbol: "₩", minorUnit: 0, symbolPosition: "prefix" },
};

export const SUPPORTED_CURRENCY_CODES = Object.keys(CURRENCIES) as Array<
  keyof typeof CURRENCIES
>;

export const DEFAULT_CURRENCY = "USD";

const FALLBACK_CURRENCY_META: CurrencyMeta = CURRENCIES.USD ?? {
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  minorUnit: 2,
  symbolPosition: "prefix",
};

export function isSupportedCurrency(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function getCurrencyMeta(code: string): CurrencyMeta {
  return CURRENCIES[code] ?? FALLBACK_CURRENCY_META;
}
