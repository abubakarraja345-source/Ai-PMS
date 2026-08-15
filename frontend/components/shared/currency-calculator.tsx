"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, X, ArrowLeftRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CURRENCIES, SUPPORTED_CURRENCY_CODES, formatMoney } from "@/lib/currency";

/**
 * Floating action button (bottom-right, available across the whole
 * authenticated app) opening a small live currency-conversion
 * calculator — replaces the old per-organization "Multi-Currency
 * Conversion" settings section (base/display currency + exchange
 * rate mode), which is gone now. This is a general-purpose utility,
 * not tied to any organization's settings: always live, any of the
 * app's supported currencies to any other.
 */
export default function CurrencyCalculator() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [result, setResult] = useState<{ rate: number; converted: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const parsedAmount = Number(amount);

    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setResult(null);
      setError("");
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(
          `/api/organization/exchange-rates/convert?amount=${parsedAmount}&from=${from}&to=${to}`
        );

        if (!cancelled) setResult(response.data);
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setError(err instanceof Error ? err.message : "Conversion failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      // Debounced — a fresh call per keystroke would hammer the live
      // rate endpoint for no benefit.
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, amount, from, to]);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="glass-panel mb-3 w-80 rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Currency Calculator</h3>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close calculator"
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">Live rates, updated continuously.</p>

          <div className="mt-4">
            <label htmlFor="calc-amount" className="mb-1.5 block text-xs font-medium text-foreground/80">
              Amount
            </label>
            <input
              id="calc-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="calc-from" className="mb-1.5 block text-xs font-medium text-foreground/80">
                From
              </label>
              <select
                id="calc-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {SUPPORTED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={swap}
              aria-label="Swap currencies"
              title="Swap currencies"
              className="mb-0.5 shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeftRight size={14} />
            </button>

            <div className="flex-1">
              <label htmlFor="calc-to" className="mb-1.5 block text-xs font-medium text-foreground/80">
                To
              </label>
              <select
                id="calc-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {SUPPORTED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            {loading ? (
              <p className="text-sm text-muted-foreground">Converting...</p>
            ) : error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : result ? (
              <>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatMoney(result.converted, to)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  1 {from} = {result.rate.toFixed(4)} {to}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Enter an amount to convert.</p>
            )}
          </div>

          <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
            {CURRENCIES[from]?.name} → {CURRENCIES[to]?.name}
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open currency calculator"
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-black/20 transition hover:opacity-90"
      >
        <Calculator size={22} />
      </button>
    </div>
  );
}
