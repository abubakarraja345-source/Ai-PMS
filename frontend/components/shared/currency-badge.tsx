"use client";

import { getCurrencyMeta } from "@/lib/currency";

interface CurrencyBadgeProps {
  code: string | null | undefined;
  /** "compact" shows just the ISO code; "expanded" adds the symbol and name. */
  variant?: "compact" | "expanded";
  className?: string;
}

export default function CurrencyBadge({
  code,
  variant = "compact",
  className,
}: CurrencyBadgeProps) {
  const meta = getCurrencyMeta(code);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700 ${className ?? ""}`}
    >
      {variant === "expanded" && (
        <span className="text-slate-400">{meta.symbol}</span>
      )}
      {meta.code}
      {variant === "expanded" && (
        <span className="font-normal text-slate-400">· {meta.name}</span>
      )}
    </span>
  );
}
