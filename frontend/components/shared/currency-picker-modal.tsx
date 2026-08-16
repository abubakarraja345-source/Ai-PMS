"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Search, X } from "lucide-react";
import {
  CURRENCIES,
  CurrencyMeta,
  SUPPORTED_CURRENCY_CODES,
  formatMoney,
} from "@/lib/currency";

const POPULAR_CODES = ["USD", "EUR", "GBP", "AED", "SAR", "PKR"];

interface CurrencyPickerModalProps {
  open: boolean;
  value: string;
  title?: string;
  description?: string;
  codes?: string[];
  onChange: (code: string) => void;
  onClose: () => void;
}

/**
 * A full centered modal for picking a currency — used for deliberate,
 * one-off actions (like changing the organization default) where a
 * dedicated moment of focus and a "Popular" shortlist earns its keep,
 * as opposed to the compact inline CurrencySelect combobox used inside
 * forms.
 */
export default function CurrencyPickerModal({
  open,
  value,
  title = "Change currency",
  description = "Choose the currency for this setting.",
  codes = SUPPORTED_CURRENCY_CODES,
  onChange,
  onClose,
}: CurrencyPickerModalProps) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const options = useMemo(
    () =>
      codes
        .map((code) => CURRENCIES[code])
        .filter((meta): meta is CurrencyMeta => Boolean(meta)),
    [codes]
  );

  const popular = useMemo(
    () => options.filter((meta) => POPULAR_CODES.includes(meta.code)),
    [options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (meta) =>
        meta.code.toLowerCase().includes(q) ||
        meta.name.toLowerCase().includes(q)
    );
  }, [options, query]);

  const showGrouped = query.trim() === "" && popular.length > 0;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlighted(0);
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function handleSelect(code: string) {
    onChange(code);
    onClose();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const meta = filtered[highlighted];
      if (meta) handleSelect(meta.code);
    }
  }

  if (!open) return null;

  function renderRow(meta: CurrencyMeta, index: number) {
    const isSelected = meta.code === value;

    return (
      <button
        type="button"
        key={meta.code}
        role="option"
        aria-selected={isSelected}
        onMouseEnter={() => setHighlighted(index)}
        onClick={() => handleSelect(meta.code)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
          index === highlighted ? "bg-muted" : ""
        }`}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-blue-600">
          {isSelected && <Check size={14} />}
        </span>
        <span className="w-6 shrink-0 text-center text-muted-foreground/80">
          {meta.symbol}
        </span>
        <span className="w-12 shrink-0 font-semibold text-foreground">
          {meta.code}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {meta.name}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground/80">
          {formatMoney(1250, meta.code)}
        </span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/80 hover:bg-muted hover:text-foreground/70"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Search size={16} className="shrink-0 text-muted-foreground/80" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleListKeyDown}
            placeholder="Search currency..."
            aria-label="Search currency"
            className="w-full text-sm outline-none placeholder:text-muted-foreground/80"
          />
        </div>

        <div role="listbox" className="overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground/80">
              No currency matches &ldquo;{query}&rdquo;
            </p>
          ) : showGrouped ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Popular
              </p>
              {popular.map((meta) =>
                renderRow(
                  meta,
                  filtered.findIndex((m) => m.code === meta.code)
                )
              )}

              <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                All currencies
              </p>
              {filtered
                .filter((meta) => !POPULAR_CODES.includes(meta.code))
                .map((meta) =>
                  renderRow(
                    meta,
                    filtered.findIndex((m) => m.code === meta.code)
                  )
                )}
            </>
          ) : (
            filtered.map((meta, index) => renderRow(meta, index))
          )}
        </div>
      </div>
    </div>
  );
}
