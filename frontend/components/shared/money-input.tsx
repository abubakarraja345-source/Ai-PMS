"use client";

import { getCurrencyMeta } from "@/lib/currency";

interface MoneyInputProps {
  id?: string;
  /** Major-units string as typed, e.g. "150" or "150.5" or "" —
   * matches the existing reservation form fields' own string-based
   * number inputs (see reservations/page.tsx's form state), so this
   * is a drop-in replacement rather than requiring every call site to
   * convert to/from minor units. */
  value: string;
  currency: string | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowNegative?: boolean;
  className?: string;
}

/**
 * A currency-aware money input: rejects keystrokes that would
 * produce more decimal places than the currency actually supports
 * (0 for JPY/KRW, 2 for most others — see lib/currency.ts), rejects
 * non-numeric input, and optionally rejects negative values. Positions
 * the currency symbol as a prefix or suffix per the currency's own
 * convention (AED/SAR display after the number) instead of always
 * assuming a leading "$".
 */
export default function MoneyInput({
  id,
  value,
  currency,
  onChange,
  disabled,
  placeholder,
  allowNegative = false,
  className,
}: MoneyInputProps) {
  const meta = getCurrencyMeta(currency);

  function handleChange(raw: string) {
    if (raw === "" || raw === "-") {
      onChange(raw === "-" && !allowNegative ? "" : raw);
      return;
    }

    const negPart = allowNegative ? "-?" : "";
    const decimalPart =
      meta.minorUnit > 0 ? `(\\.\\d{0,${meta.minorUnit}})?` : "";
    const pattern = new RegExp(`^${negPart}\\d*${decimalPart}$`);

    if (!pattern.test(raw)) {
      return;
    }

    onChange(raw);
  }

  const defaultPlaceholder =
    meta.minorUnit > 0 ? `0.${"0".repeat(meta.minorUnit)}` : "0";

  return (
    <div className={`relative ${className ?? ""}`}>
      {meta.symbolPosition === "prefix" && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
          {meta.symbol}
        </span>
      )}

      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? defaultPlaceholder}
        onChange={(event) => handleChange(event.target.value)}
        className={`w-full rounded-lg border border-slate-200 py-2.5 text-sm outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
          meta.symbolPosition === "prefix" ? "pl-7 pr-3" : "pl-3 pr-10"
        }`}
      />

      {meta.symbolPosition === "suffix" && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
          {meta.symbol}
        </span>
      )}
    </div>
  );
}
