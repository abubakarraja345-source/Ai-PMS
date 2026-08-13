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
    "border border-border bg-muted text-foreground/80 px-2 py-0.5",
  expanded:
    "border border-border bg-muted text-foreground/80 px-2 py-0.5",
  financial:
    "border border-primary/20 bg-primary/10 text-primary px-2.5 py-1",
  muted: "border-none bg-transparent text-muted-foreground/80 px-0 py-0",
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
        <span className={variant === "financial" ? "text-primary/70" : "text-muted-foreground/80"}>
          {meta.symbol}
        </span>
      )}
      {meta.code}
      {showDetail && (
        <span
          className={`font-normal ${variant === "financial" ? "text-primary/70" : "text-muted-foreground/80"}`}
        >
          · {meta.name}
        </span>
      )}
    </span>
  );
}
