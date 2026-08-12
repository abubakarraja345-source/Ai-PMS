/**
 * Single source of truth for supported currencies on the frontend —
 * every component that needs to format, validate, or list currencies
 * imports from here. Mirrors backend/src/constants/currency.ts
 * exactly; the two are hand-kept in sync since frontend and backend
 * don't share a module boundary in this repo. Backend validation is
 * still authoritative — this list existing here is for UI purposes
 * only, never trusted as the source of truth for what the server will
 * accept.
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

export const SUPPORTED_CURRENCY_CODES = Object.keys(CURRENCIES);

export const DEFAULT_CURRENCY = "USD";

export function isSupportedCurrency(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function getCurrencyMeta(code: string | null | undefined): CurrencyMeta {
  if (code && CURRENCIES[code]) {
    return CURRENCIES[code];
  }

  return CURRENCIES[DEFAULT_CURRENCY] as CurrencyMeta;
}

/**
 * amountMajorUnits is a plain "whole currency" number (125.5 for
 * $125.50) — this app's existing reservation financial fields
 * (total_amount/cleaning_fee/taxes) are stored this way already (see
 * Phase 5's currency-support audit: they're Postgres NUMERIC, exact
 * decimal, not integer minor units), so the formatter accepts the
 * same shape the rest of the app already produces rather than
 * requiring every call site to convert first.
 *
 * Internally rounds to the currency's actual minor-unit precision
 * (0 for JPY/KRW, 2 for most others) before formatting, so a
 * zero-decimal currency never shows "¥15,000.00".
 */
export function formatMoney(
  amountMajorUnits: number | null | undefined,
  currencyCode: string | null | undefined,
  options?: { locale?: string }
): string {
  if (amountMajorUnits === null || amountMajorUnits === undefined) {
    return "—";
  }

  const meta = getCurrencyMeta(currencyCode);

  try {
    return new Intl.NumberFormat(options?.locale ?? "en-US", {
      style: "currency",
      currency: meta.code,
      minimumFractionDigits: meta.minorUnit,
      maximumFractionDigits: meta.minorUnit,
    }).format(amountMajorUnits);
  } catch {
    // Intl.NumberFormat throws on a currency code it doesn't
    // recognize (shouldn't happen for anything in CURRENCIES, but an
    // unexpected value from the API shouldn't crash the page) — fall
    // back to a manual symbol + number rendering.
    const rounded = amountMajorUnits.toFixed(meta.minorUnit);
    return meta.symbolPosition === "suffix"
      ? `${rounded} ${meta.symbol}`
      : `${meta.symbol}${rounded}`;
  }
}

/**
 * Converts a minor-units integer (12550) into a major-units number
 * (125.5) for display/editing — used by the money input component,
 * which is the one place in this app that deliberately works in
 * minor units internally to avoid floating-point drift while a user
 * is actively typing a decimal amount.
 */
export function minorToMajor(amountMinorUnits: number, currencyCode: string): number {
  const meta = getCurrencyMeta(currencyCode);
  return amountMinorUnits / Math.pow(10, meta.minorUnit);
}

export function majorToMinor(amountMajorUnits: number, currencyCode: string): number {
  const meta = getCurrencyMeta(currencyCode);
  return Math.round(amountMajorUnits * Math.pow(10, meta.minorUnit));
}
