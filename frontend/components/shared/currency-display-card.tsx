"use client";

import { getCurrencyMeta } from "@/lib/currency";

interface CurrencyDisplayCardProps {
  code: string | null | undefined;
  /** e.g. "Organization default", "Property override", "Fixed for this reservation" */
  sourceLabel: string;
  helperText?: string;
  className?: string;
}

/**
 * The recurring "here is the currency that actually applies" card used
 * across settings, property forms, and reservation forms — always shows
 * the same symbol/code/name/source shape so users learn it once.
 */
export default function CurrencyDisplayCard({
  code,
  sourceLabel,
  helperText,
  className,
}: CurrencyDisplayCardProps) {
  const meta = getCurrencyMeta(code);

  return (
    <div
      className={`flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 ${className ?? ""}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-900">
        {meta.symbol}
      </div>

      <div className="min-w-0">
        <p className="font-semibold text-slate-900">
          {meta.code}
          <span className="ml-2 font-normal text-slate-500">{meta.name}</span>
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{sourceLabel}</p>
        {helperText && (
          <p className="mt-1.5 text-xs text-slate-400">{helperText}</p>
        )}
      </div>
    </div>
  );
}
