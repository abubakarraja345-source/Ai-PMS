"use client";

import { getCurrencyMeta } from "@/lib/currency";

interface CurrencyBadgeProps {
  code: string | null | undefined;
  /**
   * "compact" — bordered pill with just the ISO code (default).
   * "expanded" — adds the symbol and name.
   * "financial" — brand-tinted, for emphasis in financial contexts.
   * "muted" — borderless and low-contrast, for secondary/inherited context.
   */
  variant?: "compact" | "expanded" | "financial" | "muted";
  className?: string;
}

const VARIANT_STYLES: Record<
  NonNullable<CurrencyBadgeProps["variant"]>,
  string
> = {
  compact:
    "border border-slate-200 bg-slate-50 text-slate-700 px-2 py-0.5",
  expanded:
    "border border-slate-200 bg-slate-50 text-slate-700 px-2 py-0.5",
  financial:
    "border border-blue-100 bg-blue-50 text-blue-700 px-2.5 py-1",
  muted: "border-none bg-transparent text-slate-400 px-0 py-0",
};

export default function CurrencyBadge({
  code,
  variant = "compact",
  className,
}: CurrencyBadgeProps) {
  const meta = getCurrencyMeta(code);
  const showDetail = variant === "expanded" || variant === "financial";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md text-xs font-medium tabular-nums ${VARIANT_STYLES[variant]} ${className ?? ""}`}
    >
      {showDetail && (
        <span className={variant === "financial" ? "text-blue-400" : "text-slate-400"}>
          {meta.symbol}
        </span>
      )}
      {meta.code}
      {showDetail && (
        <span
          className={`font-normal ${variant === "financial" ? "text-blue-400" : "text-slate-400"}`}
        >
          · {meta.name}
        </span>
      )}
    </span>
  );
}
