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
  /** Validation message shown below the field in a danger state. */
  error?: string;
  className?: string;
}

/**
 * A currency-aware money input: rejects keystrokes that would
 * produce more decimal places than the currency actually supports
 * (0 for JPY/KRW, 2 for most others — see lib/currency.ts) and
 * rejects non-numeric input, optionally negative values. Shows the
 * ISO code as a fixed prefix chip (rather than the raw glyph as a
 * prefix/suffix) so right-to-left symbols like AED's "د.إ" never
 * fight the input's text direction.
 */
export default function MoneyInput({
  id,
  value,
  currency,
  onChange,
  disabled,
  placeholder,
  allowNegative = false,
  error,
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
    <div className={className}>
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border bg-card transition focus-within:ring-4 ${
          error
            ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
            : "border-border focus-within:border-primary focus-within:ring-slate-900/5"
        } ${disabled ? "bg-muted" : ""}`}
      >
        <span className="flex min-w-[3.5rem] shrink-0 items-center justify-center border-r border-border bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground">
          {meta.code}
        </span>

        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={placeholder ?? defaultPlaceholder}
          onChange={(event) => handleChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold tabular-nums text-foreground outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
        />

        <span
          aria-hidden="true"
          className="flex shrink-0 items-center pr-3 text-sm text-muted-foreground/50"
        >
          {meta.symbol}
        </span>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
