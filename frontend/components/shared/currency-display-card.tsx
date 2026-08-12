"use client";

import { formatMoney, getCurrencyMeta } from "@/lib/currency";

interface CurrencyDisplayCardProps {
  code: string | null | undefined;
  /** e.g. "Organization default", "Property override", "Fixed for this reservation" */
  sourceLabel: string;
  /** Controls the source pill's color — inherited (slate), override (blue), fixed (amber). */
  sourceTone?: "inherited" | "override" | "fixed";
  /** Small uppercase label above the currency, e.g. "EFFECTIVE CURRENCY". */
  eyebrow?: string;
  helperText?: string;
  /** Shows a representative formatted amount (1,000 units) so the currency's
   * real-world shape is obvious at a glance. On by default. */
  showExample?: boolean;
  className?: string;
}

const SOURCE_TONE_STYLES: Record<
  NonNullable<CurrencyDisplayCardProps["sourceTone"]>,
  string
> = {
  inherited: "border-slate-200 bg-white text-slate-600",
  override: "border-blue-200 bg-blue-50 text-blue-700",
  fixed: "border-amber-200 bg-amber-50 text-amber-700",
};

/**
 * The recurring "here is the currency that actually applies" card used
 * across settings, property forms, and reservation forms — always shows
 * the same symbol/code/name/source shape so users learn it once.
 */
export default function CurrencyDisplayCard({
  code,
  sourceLabel,
  sourceTone = "inherited",
  eyebrow,
  helperText,
  showExample = true,
  className,
}: CurrencyDisplayCardProps) {
  const meta = getCurrencyMeta(code);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-50/40 p-5 ${className ?? ""}`}
    >
      {eyebrow && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {eyebrow}
        </p>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-900 shadow-sm">
          {meta.symbol}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight text-slate-900">
            {meta.code}
          </p>
          <p className="text-sm text-slate-500">{meta.name}</p>

          <span
            className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${SOURCE_TONE_STYLES[sourceTone]}`}
          >
            {sourceLabel}
          </span>
        </div>
      </div>

      {showExample && (
        <div className="mt-4 border-t border-slate-200/70 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Example
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
            {formatMoney(1250, meta.code)}
          </p>
        </div>
      )}

      {helperText && (
        <p className="mt-3 text-xs leading-5 text-slate-400">{helperText}</p>
      )}
    </div>
  );
}
